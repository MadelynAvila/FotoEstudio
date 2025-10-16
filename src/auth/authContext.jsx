// authContext.js
import { createContext, useContext, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

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

      const u = data[0];
      setUser(u);
      // Si quieres persistir:
      localStorage.setItem('session_user', JSON.stringify(u));

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
