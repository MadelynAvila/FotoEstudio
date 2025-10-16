// authContext.js
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const AuthCtx = createContext(null);

const ROLE_KEYS = [
  'role',
  'rol',
  'tipo',
  'tipo_usuario',
  'tipoUsuario',
  'perfil',
  'profile',
  'user_type',
  'rol_nombre',
  'rolNombre',
  'nombre_rol',
];

const ROLE_NESTED_KEYS = [
  'nombre',
  'name',
  'role',
  'rol',
  'tipo',
  'tipo_usuario',
  'tipoUsuario',
  'slug',
];

const NAME_KEYS = [
  'name',
  'nombre',
  'nombrecompleto',
  'nombre_completo',
  'full_name',
  'fullname',
  'usuario',
  'username',
];

const getNestedValue = (value, keys) => {
  if (!value || typeof value !== 'object') return null;
  for (const key of keys) {
    if (value[key]) return value[key];
  }
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

  if (!normalizedUser.role) {
    const candidate = extractValue(rawUser, ROLE_KEYS)
      ?? sanitizeRole(rawUser.rol)
      ?? sanitizeRole(rawUser.role);
    const roleValue = sanitizeRole(candidate);
    if (roleValue) {
      normalizedUser.role = roleValue;
    }
  } else {
    const roleValue = sanitizeRole(normalizedUser.role);
    if (roleValue) {
      normalizedUser.role = roleValue;
    }
  }

  if (!normalizedUser.role && (rawUser.idrol ?? rawUser.id_rol ?? rawUser.rol_id)) {
    normalizedUser.roleId = rawUser.idrol ?? rawUser.id_rol ?? rawUser.rol_id;
  }

  if (!normalizedUser.name) {
    const candidate = extractValue(rawUser, NAME_KEYS);
    const nameValue = sanitizeName(candidate) ?? sanitizeName(rawUser.usuario);
    if (nameValue) {
      normalizedUser.name = nameValue;
    }
  } else {
    const nameValue = sanitizeName(normalizedUser.name);
    if (nameValue) {
      normalizedUser.name = nameValue;
    }
  }

  return normalizedUser;
};

const isMissingFunctionError = (error, fnName) => {
  if (!error) return false;
  const message = (error.message ?? '').toLowerCase();
  const code = error.code ?? '';
  return code === 'PGRST204'
    || message.includes(`function public.${fnName}`)
    || message.includes(`function ${fnName}`)
    || message.includes('does not exist');
};

const AUTH_USER_SELECT = `
  id,
  username,
  correo,
  contrasena_hash,
  estado,
  idrol,
  rol:rol(id, nombre, descripcion),
  cliente:cliente(id, nombrecompleto, telefono, correo),
  fotografo:fotografo(id, nombrecompleto, telefono, correo, especialidad, estado)
`;

const hashPasswordWithDatabase = async (password) => {
  const plain = password ?? '';
  if (!plain) throw new Error('La contraseña no puede estar vacía.');

  const { data: salt, error: saltError } = await supabase.rpc('gen_salt', { type: 'bf' });
  if (saltError || !salt) {
    throw new Error('No se pudo generar la contraseña de manera segura.');
  }

  const { data: hashed, error: hashError } = await supabase.rpc('crypt', {
    password: plain,
    salt,
  });

  if (hashError || !hashed) {
    throw new Error('No se pudo proteger la contraseña.');
  }

  return hashed;
};

const verifyPasswordWithDatabase = async (password, storedHash) => {
  if (!password || !storedHash) return false;

  const { data, error } = await supabase.rpc('crypt', {
    password,
    salt: storedHash,
  });

  if (error || !data) {
    console.error('[auth] Error verificando contraseña:', error);
    return false;
  }

  return data === storedHash;
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
      let userRecord = null;

      const byUsername = await supabase
        .from('usuario')
        .select(AUTH_USER_SELECT)
        .eq('username', identifier)
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
          .eq('correo', identifier)
          .maybeSingle();

        if (byEmail.error) {
          console.error('[login:fallback] error buscando por correo:', byEmail.error);
          return { ok: false, error: 'Error del servidor. Intente de nuevo.' };
        }

        userRecord = byEmail.data;
      }

      if (!userRecord) {
        return { ok: false, error: 'Credenciales inválidas o usuario inactivo.' };
      }

      if ((userRecord.estado ?? '').toLowerCase() !== 'activo') {
        return { ok: false, error: 'Credenciales inválidas o usuario inactivo.' };
      }

      const match = await verifyPasswordWithDatabase(password, userRecord.contrasena_hash);
      if (!match) {
        return { ok: false, error: 'Credenciales inválidas o usuario inactivo.' };
      }

      const { contrasena_hash, ...safePayload } = {
        ...userRecord,
        role: userRecord.rol?.nombre ?? userRecord.role ?? userRecord.rol,
        rol: userRecord.rol?.nombre ?? userRecord.rol,
        nombre: userRecord?.cliente?.nombrecompleto
          ?? userRecord?.fotografo?.nombrecompleto
          ?? userRecord.username,
        nombrecompleto: userRecord?.cliente?.nombrecompleto
          ?? userRecord?.fotografo?.nombrecompleto,
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
    const p_password = (password ?? '');

    if (!p_login || !p_password) {
      return { ok: false, error: 'Ingrese usuario/correo y contraseña.' };
    }

    try {
      const { data, error } = await supabase
        .rpc('login_usuario', { p_login, p_password });

      if (error) {
        if (isMissingFunctionError(error, 'login_usuario')) {
          return fallbackLogin(p_login, p_password);
        }

        console.error('[login_usuario] error:', error);
        return { ok: false, error: 'Error del servidor. Intente de nuevo.' };
      }

      if (!data || data.length === 0) {
        return { ok: false, error: 'Credenciales inválidas o usuario inactivo.' };
      }

      const u = mapUserPayload(data[0]);
      setUser(u);
      if (u) {
        localStorage.setItem('session_user', JSON.stringify(u));
      } else {
        localStorage.removeItem('session_user');
      }

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

    let hashedPassword;
    try {
      hashedPassword = await hashPasswordWithDatabase(p_password);
    } catch (err) {
      console.error('[registrar_cliente] hash error:', err);
      return { ok: false, error: err.message ?? 'No se pudo proteger la contraseña.' };
    }

    const translateConstraintError = (message) => {
      if (!message) return null;
      const lower = message.toLowerCase();
      if (lower.includes('usuario_username_key')) {
        return 'El nombre de usuario ya está en uso. Elige otro diferente.';
      }
      if (lower.includes('usuario_correo_key') || lower.includes('cliente_correo_key')) {
        return 'El correo electrónico ya está registrado.';
      }
      if (lower.includes('cliente_idusuario_key')) {
        return 'Este usuario ya está asociado a un cliente.';
      }
      return null;
    };

    try {
      const roleResult = await supabase
        .from('rol')
        .select('id')
        .eq('nombre', 'cliente')
        .maybeSingle();

      if (roleResult.error) {
        console.error('[registrar_cliente] rol error:', roleResult.error);
        return { ok: false, error: 'No se pudo validar el rol de cliente. Intente más tarde.' };
      }

      const roleId = roleResult.data?.id;
      if (!roleId) {
        return { ok: false, error: 'No se encontró el rol de cliente. Contacta al administrador.' };
      }

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
        await supabase.from('usuario').delete().eq('id', createdUser.id);
        const friendly = translateConstraintError(clientInsert.error?.message);
        return { ok: false, error: friendly ?? 'No se pudo registrar el cliente.' };
      }

      const loginResult = await login(p_username, p_password);
      if (loginResult?.ok) {
        return loginResult;
      }

      const fallbackPayload = mapUserPayload({
        ...createdUser,
        role: 'cliente',
        nombre: clientInsert.data.nombrecompleto,
        nombrecompleto: clientInsert.data.nombrecompleto,
        cliente: clientInsert.data,
      }) ?? {
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
