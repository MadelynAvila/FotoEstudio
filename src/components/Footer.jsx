const exploreLinks = [
  { label: 'Inicio', href: '/' },
  { label: 'Servicios', href: '/servicios' },
  { label: 'Paquetes', href: '/paquetes' },
  { label: 'Contacto', href: '/#contacto' },
]

const legalLinks = [
  { label: 'Política de Privacidad', href: '/politica-privacidad' },
  { label: 'Términos de uso', href: '/terminos' },
]

const socialLinks = [
  { label: 'Instagram', href: 'https://www.instagram.com/aguin_ph', icon: '/img/icon-instagram.svg' },
  { label: 'Facebook', href: 'https://www.facebook.com/aguinfotografia', icon: '/img/icon-facebook.svg' },
]

export default function Footer(){
  const year = new Date().getFullYear()

  return (
    <footer className="mt-24 border-t border-[color:var(--border)] bg-[#f9f6f2] text-slate-600">
      <div className="container-1120 flex flex-col gap-12 py-16 md:flex-row md:justify-between">
        <div className="max-w-xl space-y-6">
          <div className="flex items-center gap-3">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm">
              <img src="/img/logo-mark.svg" alt="Logotipo Aguín Fotografía" className="h-8 w-8" />
            </span>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Aguín Fotografía</p>
              <p className="text-3xl font-display text-umber">Historias con luz cálida y alma editorial</p>
            </div>
          </div>
          <p className="text-sm leading-relaxed text-slate-500">
            Un estudio dedicado a diseñar experiencias fotográficas sensibles, contemporáneas y profundamente humanas. Cada sesión se construye a tu medida para que la imagen final cuente la historia que deseas compartir.
          </p>
          <div className="flex gap-3">
            {socialLinks.map(link => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="flex h-12 w-12 items-center justify-center rounded-full border border-[color:var(--border)] bg-white text-umber shadow-sm transition duration-300 hover:-translate-y-1 hover:border-amber-400/60 hover:text-amber-700"
                aria-label={link.label}
              >
                <img src={link.icon} alt="" className="h-5 w-5" aria-hidden />
              </a>
            ))}
          </div>
        </div>

        <div className="grid gap-8 text-sm md:grid-cols-2 md:gap-12">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Explora</p>
            <nav className="grid gap-3">
              {exploreLinks.map(link => (
                <a
                  key={link.label}
                  href={link.href}
                  className="transition hover:text-umber"
                >
                  {link.label}
                </a>
              ))}
            </nav>
          </div>
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Legal</p>
            <nav className="grid gap-3">
              {legalLinks.map(link => (
                <a
                  key={link.label}
                  href={link.href}
                  className="transition hover:text-umber"
                >
                  {link.label}
                </a>
              ))}
            </nav>
          </div>
        </div>
      </div>

      <div className="border-t border-[color:var(--border)] bg-white/70">
        <div className="container-1120 flex flex-col items-center gap-2 py-6 text-center text-xs text-slate-400 md:flex-row md:justify-between md:text-left">
          <span>© {year} Aguín Fotografía. Todos los derechos reservados.</span>
          <span className="text-[13px] text-slate-400">Diseño minimalista para una experiencia serena.</span>
        </div>
      </div>
    </footer>
  )
}
