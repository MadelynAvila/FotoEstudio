const navigation = [
  { label: 'Inicio', href: '/' },
  { label: 'Servicios', href: '/servicios' },
  { label: 'Paquetes', href: '/paquetes' },
  { label: 'Contacto', href: '/#contacto' },
]

const legalLinks = [
  { label: 'Política de Privacidad', href: '/politica-privacidad' },
  { label: 'Términos de Uso', href: '/terminos' },
]

const socialLinks = [
  { label: 'Instagram', href: 'https://www.instagram.com/aguin_ph', icon: '/img/icon-instagram.svg' },
  { label: 'Facebook', href: 'https://www.facebook.com/aguinfotografia', icon: '/img/icon-facebook.svg' },
]

export default function Footer(){
  const year = new Date().getFullYear()

  return (
    <footer className="relative mt-16 text-white">
      <div className="absolute inset-0">
        <img src="/img/footer-texture.svg" alt="" aria-hidden className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-[#181310]/70" aria-hidden></div>
      </div>
      <div className="relative">
        <div className="container-1120 py-16 grid gap-12 lg:grid-cols-[minmax(0,1.2fr)_repeat(2,minmax(0,1fr))]">
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <img src="/img/logo-mark.svg" alt="Aguín Fotografía" className="h-14 w-14 rounded-3xl shadow-lg shadow-black/30" />
              <div className="space-y-1">
                <p className="uppercase tracking-[0.35em] text-xs text-amber-200/80">Estudio fotográfico</p>
                <p className="text-3xl font-display">Aguín Fotografía</p>
              </div>
            </div>
            <p className="max-w-lg text-sm leading-relaxed text-amber-100/80">
              Capturamos la esencia de tus momentos con un enfoque artístico y una estética cálida, creando imágenes que cuentan historias auténticas.
            </p>
            <div className="flex flex-wrap items-center gap-3 text-sm text-amber-100/80">
              <span className="pill bg-white/10 border-white/20 text-amber-50">contacto@aguinfotografia.com</span>
              <span className="pill bg-white/10 border-white/20 text-amber-50">+502 0000 0000</span>
            </div>
            <div className="flex items-center gap-4">
              {socialLinks.map(link => (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-white/10 transition hover:bg-white/20"
                  aria-label={link.label}
                >
                  <img src={link.icon} alt="" className="h-6 w-6" aria-hidden />
                </a>
              ))}
            </div>
          </div>
          <div className="grid gap-4 text-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-300/70">Explora</p>
            <nav className="grid gap-2 text-amber-100/80">
              {navigation.map(link => (
                <a key={link.label} href={link.href} className="hover:text-white">
                  {link.label}
                </a>
              ))}
            </nav>
          </div>
          <div className="grid gap-4 text-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-300/70">Legal</p>
            <nav className="grid gap-2 text-amber-100/80">
              {legalLinks.map(link => (
                <a key={link.label} href={link.href} className="hover:text-white">
                  {link.label}
                </a>
              ))}
            </nav>
          </div>
        </div>
      </div>
      <div className="relative border-t border-white/10">
        <div className="container-1120 py-6 text-center text-xs text-amber-100/70">
          © {year} Aguín Fotografía. Todos los derechos reservados.
        </div>
      </div>
    </footer>
  )
}
