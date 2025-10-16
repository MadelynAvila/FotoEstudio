import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/authContext';

const initialState = {
  fullName: '',
  username: '',
  password: '',
  confirmPassword: '',
  phone: '',
  includeEmail: false,
  email: '',
};

export default function Register() {
  const [formData, setFormData] = useState(initialState);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { registerClient } = useAuth();
  const navigate = useNavigate();

  const canSubmit = useMemo(() => {
    const { fullName, username, password, confirmPassword, includeEmail, email } = formData;

    if (!fullName.trim() || !username.trim() || password.length < 6) return false;
    if (password !== confirmPassword) return false;
    if (includeEmail && !email.trim()) return false;

    return !isSubmitting;
  }, [formData, isSubmitting]);

  const onChangeField = (field) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setFormData((prev) => ({
      ...prev,
      [field]: value,
      ...(field === 'includeEmail' && !event.target.checked ? { email: '' } : {}),
    }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!canSubmit) return;

    setError('');
    setSuccess('');
    setIsSubmitting(true);

    try {
      const res = await registerClient({
        fullName: formData.fullName,
        username: formData.username,
        password: formData.password,
        phone: formData.phone,
        email: formData.email,
        includeEmail: formData.includeEmail,
      });

      if (res.ok) {
        setSuccess('¡Cuenta creada correctamente! Ya puedes gestionar tus reservas.');
        setFormData(initialState);
        navigate('/reservar', { replace: true });
        return;
      }

      setError(res.error || 'No se pudo completar el registro.');
    } catch (err) {
      console.error(err);
      setError('Error inesperado. Intenta nuevamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-amber-50 via-rose-50/70 to-stone-100">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-amber-200/50 via-transparent to-transparent" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,_var(--tw-gradient-stops))] from-rose-100/60 via-transparent to-transparent" />
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-20">
        <form
          onSubmit={onSubmit}
          className="w-full max-w-2xl space-y-6 rounded-3xl border border-amber-100 bg-white/90 p-10 shadow-[0_35px_60px_-30px_rgba(120,82,38,0.4)] backdrop-blur"
        >
          <div className="space-y-2 text-center">
            <h1 className="text-3xl font-display text-stone-800">Crear cuenta</h1>
            <p className="text-sm text-stone-600">Regístrate para reservar sesiones y gestionar tus actividades como cliente.</p>
          </div>

          <label className="grid gap-1 text-sm font-medium text-stone-700">
            Nombre completo
            <input
              className="w-full rounded-xl2 border border-amber-200/80 px-3 py-2 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200/70"
              value={formData.fullName}
              onChange={onChangeField('fullName')}
              placeholder="Ej. Ana Pérez"
              autoComplete="name"
            />
          </label>

          <label className="grid gap-1 text-sm font-medium text-stone-700">
            Usuario
            <input
              className="w-full rounded-xl2 border border-amber-200/80 px-3 py-2 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200/70"
              value={formData.username}
              onChange={onChangeField('username')}
              placeholder="Elige un usuario único"
              autoComplete="username"
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-1 text-sm font-medium text-stone-700">
              Contraseña
              <input
                type="password"
                className="w-full rounded-xl2 border border-amber-200/80 px-3 py-2 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200/70"
                value={formData.password}
                onChange={onChangeField('password')}
                placeholder="Mínimo 6 caracteres"
                autoComplete="new-password"
              />
            </label>

            <label className="grid gap-1 text-sm font-medium text-stone-700">
              Confirmar contraseña
              <input
                type="password"
                className="w-full rounded-xl2 border border-amber-200/80 px-3 py-2 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200/70"
                value={formData.confirmPassword}
                onChange={onChangeField('confirmPassword')}
                placeholder="Repite tu contraseña"
                autoComplete="new-password"
              />
            </label>
          </div>

          <label className="grid gap-1 text-sm font-medium text-stone-700">
            Teléfono (opcional)
            <input
              className="w-full rounded-xl2 border border-amber-200/80 px-3 py-2 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200/70"
              value={formData.phone}
              onChange={onChangeField('phone')}
              placeholder="Ej. +502 1234-5678"
              autoComplete="tel"
            />
          </label>

          <div className="space-y-3 rounded-xl2 border border-amber-100/80 bg-amber-50/40 p-4">
            <label className="flex items-start gap-3 text-sm font-medium text-stone-700">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-amber-300 text-amber-500 focus:ring-amber-400/80"
                checked={formData.includeEmail}
                onChange={onChangeField('includeEmail')}
              />
              <span>Quiero agregar mi correo electrónico para recuperar acceso fácilmente.</span>
            </label>

            {formData.includeEmail && (
              <input
                type="email"
                className="w-full rounded-xl2 border border-amber-200/80 bg-white px-3 py-2 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200/70"
                value={formData.email}
                onChange={onChangeField('email')}
                placeholder="correo@ejemplo.com"
                autoComplete="email"
              />
            )}
          </div>

          {error && <p className="text-sm font-medium text-red-600">{error}</p>}
          {success && <p className="text-sm font-medium text-emerald-600">{success}</p>}

          <button className="btn btn-primary w-full justify-center" disabled={!canSubmit}>
            {isSubmitting ? 'Registrando…' : 'Registrarme'}
          </button>

          <div className="text-center text-sm text-stone-600">
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" className="font-semibold text-amber-600 hover:text-amber-500">
              Inicia sesión
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
