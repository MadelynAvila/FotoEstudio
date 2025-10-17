// authContext.js
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const BCRYPT_BASE64_CHARS = './ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

const encodeBcryptBase64 = (bytes) => {
  let result = '';
  let offset = 0;
  const len = bytes.length;
  while (offset < len) {
    let c1 = bytes[offset++];
    result += BCRYPT_BASE64_CHARS[(c1 >> 2) & 0x3f];
    c1 = (c1 & 0x03) << 4;
    if (offset >= len) {
      result += BCRYPT_BASE64_CHARS[c1 & 0x3f];
      break;
    }

    let c2 = bytes[offset++];
    c1 |= (c2 >> 4) & 0x0f;
    result += BCRYPT_BASE64_CHARS[c1 & 0x3f];
    c1 = (c2 & 0x0f) << 2;

    if (offset >= len) {
      result += BCRYPT_BASE64_CHARS[c1 & 0x3f];
      break;
    }

    c2 = bytes[offset++];
    c1 |= (c2 >> 6) & 0x03;
    result += BCRYPT_BASE64_CHARS[c1 & 0x3f];
    result += BCRYPT_BASE64_CHARS[c2 & 0x3f];
  }
  return result;
};

const generateLocalBcryptSalt = (cost = 10) => {
  const normalizedCost = Math.min(Math.max(cost, 4), 31);
  const target = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(target);
  } else {
    throw new Error('Generador aleatorio no disponible.');
  }
  const encoded = encodeBcryptBase64(target).slice(0, 22);
  return `$2b$${normalizedCost.toString().padStart(2, '0')}$${encoded}`;
};

const AuthCtx = createContext(null);

const ROLE_KEYS = [
  'role','rol','tipo','tipo_usuario','tipoUsuario','perfil','profile','user_type',
  'rol_nombre','rolNombre','nombre_rol',
];

const ROLE_NESTED_KEYS = ['nombre','name','role','rol','tipo','tipo_usuario','tipoUsuario','slug'];

const NAME_KEYS = ['name','nombre','nombrecompleto','nombre_completo','full_name','fullname','usuario','username'];

const getNestedValue = (value, keys) => {
  if (!value || typeof value !== 'object') return null;
  for (const key of keys) if (value[key]) return value[key];
  return null;
};

const extractValue = (source, keys) => {
  for (const key of keys) {
    const current = source?.[key];
    if (current !== undefined && current !== null && current !== '') return current;
  }
  return null;
};

const sanitizeRole = (value) => {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string' || typeof value === 'number') return value;
  const nested = getNestedValue(value, ROLE_NESTED_KEYS);
  if (nested === undefined || nested === null) return null;
  if (typeof nested === 'string' || typeof nested === 'number') return nested;
  return null;
};

const sanitizeName = (value) => {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    const nested = getNestedValue(value, NAME_KEYS);
    if (typeof nested === 'string') return nested;
  }
  return null;
};

const mapUserPayload = (rawUser) => {
  if (!rawUser || typeof rawUser !== 'object') return null;
  const normalizedUser = { ...rawUser };

  // role
  if (!normalizedUser.role) {
    const candidate = extractValue(rawUser, ROLE_KEYS)
      ?? sanitizeRole(rawUser.rol)
      ?? sanitizeRole(rawUser.role);
    const roleValue = sanitizeRole(candidate);
    if (roleValue) normalizedUser.role = roleValue;
  } else {
    const roleValue = sanitizeRole(normalizedUser.role);
    if (roleValue) normalizedUser.role = roleValue;
  }
  if (!normalizedUser.role && (rawUser.idrol ?? rawUser.id_rol ?? rawUser.rol_id)) {
    normalizedUser.roleId = rawUser.idrol ?? rawUser.id_rol ?? rawUser.rol_id;
  }

  // name
  if (!normalizedUser.name) {
    const candidate = extractValue(rawUser, NAME_KEYS);
    const nameValue = sanitizeName(candidate) ?? sanitizeName(rawUser.usuario);
    if (nameValue) normalizedUser.name = nameValue;
  } else {
    const nameValue = sanitizeName(normalizedUser.name);
    if (nameValue) normalizedUser.name = nameValue;
  }

  return normalizedUser;
};

const isMissingFunctionError = (error, fnName) => {
  if (!error) return false;
  const message = (error.message ?? '').toLowerCase();
  const code = error.code ?? '';
  return (
    code === 'PGRST204' ||
    message.includes(`function public.${fnName}`) ||
    message.includes(`function ${fnName}`) ||
    message.includes('does not exist')
  );
};

const AUTH_USER_SELECT = `
  id,
  username,
  correo,
  telefono,
  contrasena_hash,
  idrol,
  idestado,
  rol:rol!usuario_idrol_fkey(id, nombre, descripcion),
  estado:estado_usuario!usuario_idestado_fkey(id, nombre_estado, descripcion_estado),
  cliente:cliente!cliente_idusuario_fkey(idcliente, Descuento)
`;

const hashPasswordWithDatabase = async (password) => {
  const plain = password ?? '';
  if (!plain) throw new Error('La contraseña no puede estar vacía.');

  let salt = null;
  let saltError = null;

  try {
    const response = await supabase.rpc('gen_salt', { type: 'bf' });
    salt = response.data ?? null;
    saltError = response.error ?? null;
  } catch (err) {
    saltError = err;
  }

  if (!salt) {
    if (saltError) {
      console.warn('[auth] Supabase no pudo generar un salt bcrypt, se usará uno local:', saltError);
    }
    try {
      salt = generateLocalBcryptSalt();
    } catch (localError) {
      console.error('[auth] Error generando salt bcrypt local:', localError);
      throw new Error('No se pudo generar la contraseña de manera segura.');
    }
  }

  try {
    const { data: hashed, error: hashError } = await supabase.rpc('crypt', { password: plain, salt });
    if (hashError || !hashed) throw hashError ?? new Error('hash nulo');
    return hashed;
  } catch (err) {
    console.error('[auth] No se pudo proteger la contraseña con Supabase:', err);
    throw new Error('No se pudo proteger la contraseña.');
  }
};

const verifyPasswordWithDatabase = async (password, storedHash, userId) => {
  if (!password || !storedHash) return false;

  // hashes creados con gen_salt('bf') empiezan con $2 (bcrypt)
  if (storedHash.startsWith('$2')) {
    const { data, error } = await supabase.rpc('crypt', { password, salt: storedHash });
    if (error || !data) {
      console.error('[auth] Error verificando contraseña:', error);
      return false;
    }
    return data === storedHash;
  }

  // Si la contraseña quedó guardada en texto plano (creada manualmente),
  // validamos y la re-protegemos en el acto para normalizar la base de datos.
  if (storedHash === password && userId) {
    try {
      const hashedPassword = await hashPasswordWithDatabase(password);
      const { error: updateError } = await supabase
        .from('usuario')
        .update({ contrasena_hash: hashedPassword })
        .eq('id', userId);
      if (updateError) {
        console.error('[auth] No se pudo normalizar la contraseña sin hash:', updateError);
      }
    } catch (err) {
      console.error('[auth] Error re-hasheando contraseña en texto plano:', err);
    }
    return true;
  }

  return false;
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('session_user');
      if (!stored) return;
      const parsed = JSON.parse(stored);
      const normalized = mapUserPayload(parsed);
      setUser(normalized);
    } catch (err) {
      console.error('[auth] No se pudo restaurar la sesión:', err);
      localStorage.removeItem('session_user');
    }
  }, []);

  const fallbackLogin = async (identifier, password) => {
    try {
      const sanitizedIdentifier = (identifier ?? '').trim();
      let userRecord = null;

      if (!sanitizedIdentifier) {
        return { ok: false, status: 401, error: 'Credenciales inválidas' };
      }

      const byUsername = await supabase
        .from('usuario')
        .select(AUTH_USER_SELECT)
        .eq('username', sanitizedIdentifier)
        .maybeSingle();

      if (byUsername.error) {
        console.error('[login:fallback] error buscando por usuario:', byUsername.error);
        return { ok: false, error: 'Error del servidor. Intente de nuevo.' };
      }
      userRecord = byUsername.data;

      if (!userRecord) {
        const byEmail = await supabase
          .from('usuario')
          .select(AUTH_USER_SELECT)
          .eq('correo', sanitizedIdentifier)
          .maybeSingle();
        if (byEmail.error) {
          console.error('[login:fallback] error buscando por correo:', byEmail.error);
          return { ok: false, error: 'Error del servidor. Intente de nuevo.' };
        }
        userRecord = byEmail.data;
      }

      if (!userRecord) {
        return { ok: false, status: 401, error: 'Credenciales inválidas' };
      }
      const estadoActual = userRecord.estado?.nombre_estado ?? userRecord.estado ?? ''
      if (estadoActual && estadoActual.toLowerCase() !== 'activo') {
        return { ok: false, status: 401, error: 'Credenciales inválidas' };
      }

      const match = await verifyPasswordWithDatabase(password, userRecord.contrasena_hash, userRecord.id);
      if (!match) return { ok: false, status: 401, error: 'Credenciales inválidas' };

      const { contrasena_hash: CONTRASENA_HASH_UNUSED, ...safePayload } = {
        ...userRecord,
        role: userRecord.rol?.nombre ?? userRecord.role ?? userRecord.rol,
        rol: userRecord.rol?.nombre ?? userRecord.rol,
        nombre: userRecord.username,
        nombrecompleto: userRecord.username,
      };

      const normalized = mapUserPayload(safePayload) ?? safePayload;
      if (normalized && !normalized.role && (userRecord.rol?.nombre ?? null)) {
        normalized.role = userRecord.rol.nombre;
      }
      if (normalized && !normalized.name && normalized.nombrecompleto) {
        normalized.name = normalized.nombrecompleto;
      }

      if (normalized) {
        setUser(normalized);
        localStorage.setItem('session_user', JSON.stringify(normalized));
      } else {
        setUser(null);
        localStorage.removeItem('session_user');
      }
      return { ok: true, user: normalized ?? null };
    } catch (err) {
      console.error('[login:fallback] unexpected error:', err);
      return { ok: false, error: 'Error del servidor. Intente de nuevo.' };
    }
  };

  const login = async (identifier, password) => {
    const p_login = (identifier ?? '').trim();
    const p_password = password ?? '';

    if (!p_login || !p_password) {
      return { ok: false, error: 'Ingrese usuario/correo y contraseña.' };
    }

    try {
      const { data, error } = await supabase.rpc('login_usuario', { p_login, p_password });

      if (error) {
        if (isMissingFunctionError(error, 'login_usuario')) {
          return fallbackLogin(p_login, p_password);
        }

        const message = String(error.message ?? '').toLowerCase();
        if (error.code === 'PGRST116' || message.includes('credenciales') || message.includes('invalid')) {
          return { ok: false, status: 401, error: 'Credenciales inválidas' };
        }

        console.error('[login_usuario] error:', error);
        return { ok: false, error: 'Error del servidor. Intente de nuevo.' };
      }

      if (!data || data.length === 0) {
        return { ok: false, status: 401, error: 'Credenciales inválidas' };
      }

      const u = mapUserPayload(data[0]);
      setUser(u);
      if (u) localStorage.setItem('session_user', JSON.stringify(u));
      else localStorage.removeItem('session_user');

      return { ok: true, user: u };
    } catch (err) {
      console.error(err);
      return { ok: false, error: 'Error de red. Intente nuevamente.' };
    }
  };

  const registerClient = async ({
    fullName,
    username,
    password,
    phone,
    email,
    includeEmail,
  }) => {
    const p_nombre = (fullName ?? '').trim();
    const p_username = (username ?? '').trim();
    const p_password = password ?? '';
    const p_telefono = (phone ?? '').trim() || null;
    const p_correo = includeEmail ? ((email ?? '').trim() || null) : null;

    if (!p_nombre || !p_username || !p_password) {
      return { ok: false, error: 'Nombre completo, usuario y contraseña son obligatorios.' };
    }

    // traductor de errores de constraints
    const translateConstraintError = (message) => {
      if (!message) return null;
      const lower = message.toLowerCase();
      if (lower.includes('usuario_username_key')) return 'El nombre de usuario ya está en uso. Elige otro diferente.';
      if (lower.includes('usuario_correo_key') || lower.includes('cliente_correo_key')) return 'El correo electrónico ya está registrado.';
      if (lower.includes('cliente_idusuario_key')) return 'Este usuario ya está asociado a un cliente.';
      return null;
    };

    // Fallback manual (inserciones directas)
    const manualRegister = async () => {
      let hashedPassword;
      try {
        hashedPassword = await hashPasswordWithDatabase(p_password);
      } catch (err) {
        console.error('[registrar_cliente] hash error:', err);
        return { ok: false, error: err.message ?? 'No se pudo proteger la contraseña.' };
      }

      try {
        // buscar rol cliente
        const roleResult = await supabase.from('rol').select('id').eq('nombre', 'cliente').maybeSingle();
        if (roleResult.error) {
          console.error('[registrar_cliente] rol error:', roleResult.error);
          return { ok: false, error: 'No se pudo validar el rol de cliente. Intente más tarde.' };
        }
        const roleId = roleResult.data?.id;
        if (!roleId) return { ok: false, error: 'No se encontró el rol de cliente. Contacta al administrador.' };

        // crear usuario
        const userInsert = await supabase
          .from('usuario')
          .insert({
            username: p_username,
            correo: p_correo,
            contrasena_hash: hashedPassword,
            estado: 'activo',
            idrol: roleId,
          })
          .select('id, username, correo, estado, idrol')
          .single();

        if (userInsert.error || !userInsert.data) {
          console.error('[registrar_cliente] usuario error:', userInsert.error);
          const friendly = translateConstraintError(userInsert.error?.message);
          return { ok: false, error: friendly ?? 'No se pudo crear la cuenta de usuario.' };
        }
        const createdUser = userInsert.data;

        // crear cliente
        const clientInsert = await supabase
          .from('cliente')
          .insert({
            nombrecompleto: p_nombre,
            telefono: p_telefono,
            correo: p_correo,
            idusuario: createdUser.id,
          })
          .select('id, nombrecompleto, telefono, correo, idusuario')
          .single();

        if (clientInsert.error || !clientInsert.data) {
          console.error('[registrar_cliente] cliente error:', clientInsert.error);
          // rollback del usuario
          await supabase.from('usuario').delete().eq('id', createdUser.id);
          const friendly = translateConstraintError(clientInsert.error?.message);
          return { ok: false, error: friendly ?? 'No se pudo registrar el cliente.' };
        }

        // intenta login
        const loginResult = await login(p_username, p_password);
        if (loginResult?.ok) return loginResult;

        // fallback de sesión local
        const fallbackPayload =
          mapUserPayload({
            ...createdUser,
            role: 'cliente',
            nombre: clientInsert.data.nombrecompleto,
            nombrecompleto: clientInsert.data.nombrecompleto,
            cliente: clientInsert.data,
          }) ??
          {
            ...createdUser,
            role: 'cliente',
            name: clientInsert.data.nombrecompleto,
          };

        if (fallbackPayload) {
          setUser(fallbackPayload);
          localStorage.setItem('session_user', JSON.stringify(fallbackPayload));
        } else {
          setUser(null);
          localStorage.removeItem('session_user');
        }
        return { ok: true, user: fallbackPayload ?? null };
      } catch (err) {
        console.error('[registrar_cliente/manual] unexpected:', err);
        return { ok: false, error: 'Error de red. Intente nuevamente.' };
      }
    };

    // Flujo principal: RPC
    try {
      const { data, error } = await supabase.rpc('registrar_cliente', {
        p_nombre,
        p_username,
        p_password,
        p_correo,
        p_telefono,
      });

      if (error) {
        if (isMissingFunctionError(error, 'registrar_cliente')) {
          // si no existe la función, usamos fallback
          return await manualRegister();
        }
        console.error('[registrar_cliente] error:', error);
        const friendly = translateConstraintError(error?.message);
        return { ok: false, error: friendly ?? (error?.message ?? 'Error del servidor. Intente más tarde.') };
      }

      if (!data) return { ok: false, error: 'No se pudo registrar el cliente.' };

      const payload = Array.isArray(data) ? data[0] : data?.user ?? data?.usuario ?? data;
      const normalized = mapUserPayload(payload) ?? payload;
      if (normalized && !normalized.role) normalized.role = 'cliente';

      if (normalized) {
        setUser(normalized);
        localStorage.setItem('session_user', JSON.stringify(normalized));
      } else {
        setUser(null);
        localStorage.removeItem('session_user');
      }

      return { ok: true, user: normalized ?? null };
    } catch (err) {
      // si el catch trae “function ... does not exist”, también hacemos fallback
      const msg = String(err?.message ?? '').toLowerCase();
      if (msg.includes('does not exist') && msg.includes('registrar_cliente')) {
        return await manualRegister();
      }
      console.error('[registrar_cliente] unexpected:', err);
      return { ok: false, error: 'Error de red. Intente nuevamente.' };
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('session_user');
  };

  return (
    <AuthCtx.Provider value={{ user, login, registerClient, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthCtx);

