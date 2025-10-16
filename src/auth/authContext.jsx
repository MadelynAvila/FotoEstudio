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
        console.error('[login_usuario] error:', error);
        return { ok: false, error: 'Error del servidor. Intente de nuevo.' };
      }

      if (!data || data.length === 0) {
        return { ok: false, error: 'Credenciales inválidas o usuario inactivo.' };
      }

      const u = mapUserPayload(data[0]);
      setUser(u);
      // Si quieres persistir:
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

    try {
      const { data, error } = await supabase.rpc('registrar_cliente', {
        p_nombre,
        p_username,
        p_password,
        p_correo,
        p_telefono,
      });

      if (error) {
        console.error('[registrar_cliente] error:', error);
        const msg = error?.message ?? 'Error del servidor. Intente más tarde.';
        return { ok: false, error: msg };
      }

      if (!data) {
        return { ok: false, error: 'No se pudo registrar el cliente.' };
      }

      const payload = Array.isArray(data) ? data[0] : data?.user ?? data?.usuario ?? data;
      const normalized = mapUserPayload(payload);

      if (normalized && !normalized.role) {
        normalized.role = 'cliente';
      }

      if (normalized) {
        setUser(normalized);
        localStorage.setItem('session_user', JSON.stringify(normalized));
      }

      return { ok: true, user: normalized ?? null };
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
