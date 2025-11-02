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
    <footer
      className="mt-8 text-[#f5eee4]"
      style={{
        backgroundImage: "url('/img/footer-texture.svg')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div className="bg-[#1f1814]/90">
        <div className="container-1120 flex flex-col gap-8 py-8 md:flex-row md:justify-between">
          <div className="max-w-xl space-y-6">
            <div className="flex items-center gap-3">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#f8efe2]/10 ring-1 ring-white/10">
                <img src="/img/logo-mark.svg" alt="Logotipo Aguín Fotografía" className="h-8 w-8" />
              </span>
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.35em] text-[#d4c5b5]/80">Aguín Fotografía</p>
                <p className="text-3xl font-display text-[#f4d9b5]">Historias con luz cálida y alma editorial</p>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-[#e7d6c2]/80">
              Un estudio dedicado a diseñar experiencias fotográficas sensibles, contemporáneas y profundamente humanas. Cada sesión se construye a tu medida para que la imagen final cuente la historia que deseas compartir.
            </p>
            <div className="flex gap-3">
              {socialLinks.map(link => (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-white/5 text-[#f4d9b5] transition duration-300 hover:-translate-y-1 hover:border-amber-300/60 hover:text-amber-200"
                  aria-label={link.label}
                >
                  <img src={link.icon} alt="" className="h-5 w-5" aria-hidden />
                </a>
              ))}
            </div>
          </div>

          <div className="grid gap-8 text-sm md:grid-cols-2 md:gap-12">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.35em] text-[#d4c5b5]/70">Explora</p>
              <nav className="grid gap-3">
                {exploreLinks.map(link => (
                  <a
                    key={link.label}
                    href={link.href}
                    className="transition hover:text-[#f4d9b5]"
                  >
                    {link.label}
                  </a>
                ))}
              </nav>
            </div>
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.35em] text-[#d4c5b5]/70">Legal</p>
              <nav className="grid gap-3">
                {legalLinks.map(link => (
                  <a
                    key={link.label}
                    href={link.href}
                    className="transition hover:text-[#f4d9b5]"
                  >
                    {link.label}
                  </a>
                ))}
              </nav>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10 bg-[#1a140f]/90">
        <div className="container-1120 flex flex-col items-center gap-2 py-6 text-center text-xs text-[#d4c5b5]/80 md:flex-row md:justify-between md:text-left">
          <span>© {year} Aguín Fotografía. Todos los derechos reservados.</span>
          <span className="text-[13px]">Diseño minimalista para una experiencia serena.</span>
        </div>
      </div>
    </footer>
  )
}
