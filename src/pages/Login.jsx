import { useState, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/authContext';

export default function Login() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();

  const canSubmitLogin = useMemo(() => {
    return identifier.trim().length > 0 && password.length > 0 && !isSubmitting;
  }, [identifier, password, isSubmitting]);

  const onSubmitLogin = async (e) => {
    e.preventDefault();
    if (!canSubmitLogin) return;

    setError('');
    setIsSubmitting(true);
    try {
      const res = await login(identifier.trim(), password);
      if (res.ok) {
        const to = (loc.state && loc.state.from) || '/admin';
        nav(to, { replace: true });
        return;
      }
      setError(res.error || 'No se pudo iniciar sesión.');
    } catch (err) {
      console.error(err);
      setError('Error inesperado. Intenta otra vez.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-sand via-dune to-amber-100">
      <div className="absolute inset-0 opacity-60 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-amber-300/30 via-transparent to-transparent" />
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-20">
        <form onSubmit={onSubmitLogin} className="card w-full max-w-md space-y-6 p-10 shadow-2xl shadow-black/15">
          <div className="space-y-2 text-center">
            <h1 className="font-display leading-snug text-umber">Iniciar sesión</h1>
            <p className="text-sm text-umber/70">Accede con tu usuario o correo electrónico para continuar.</p>
          </div>

          <label className="grid gap-1 text-sm font-medium text-umber/80">
            Usuario o correo
            <input
              className="border border-sand focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Ingresa tu usuario o correo"
              autoComplete="username"
              inputMode="email"
            />
          </label>

          <label className="grid gap-1 text-sm font-medium text-umber/80">
            Contraseña
            <input
              type="password"
              className="border border-sand focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Contraseña"
              autoComplete="current-password"
            />
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button className="btn btn-primary w-full justify-center" disabled={!canSubmitLogin}>
            {isSubmitting ? 'Ingresando…' : 'Ingresar'}
          </button>

          <p className="text-xs text-umber/70 text-center">
            Puedes usar tu <b>nombre de usuario</b> o tu <b>correo electrónico</b>.
          </p>

          <div className="text-center text-sm text-umber">
            ¿Aún no tienes cuenta?{' '}
            <Link to="/registrarse" className="font-semibold text-amber-600 hover:text-amber-500">
              Registrarse
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
