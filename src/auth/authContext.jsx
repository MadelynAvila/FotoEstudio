// authContext.js
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const AuthCtx = createContext(null);

const mapUserPayload = (rawUser) => {
  if (!rawUser || typeof rawUser !== 'object') return null;

  const normalizedUser = { ...rawUser };

  if (!normalizedUser.role) {
    const roleKeys = [
      'role',
      'rol',
      'tipo',
      'tipo_usuario',
      'tipoUsuario',
      'perfil',
      'profile',
      'user_type',
    ];

    for (const key of roleKeys) {
      if (rawUser[key]) {
        normalizedUser.role = rawUser[key];
        break;
      }
    }
  }

  if (!normalizedUser.name) {
    const nameKeys = [
      'name',
      'nombre',
      'full_name',
      'fullname',
      'usuario',
      'username',
    ];

    for (const key of nameKeys) {
      if (rawUser[key]) {
        normalizedUser.name = rawUser[key];
        break;
      }
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

  const logout = () => {
    setUser(null);
    localStorage.removeItem('session_user');
  };

  return (
    <AuthCtx.Provider value={{ user, login, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
