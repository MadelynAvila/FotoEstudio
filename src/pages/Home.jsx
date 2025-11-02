import GalleryRail from '../components/GalleryRail'

const highlights = [
  {
    title: 'Dirección artística integral',
    description: 'Curamos cada detalle de iluminación, vestuario y actitud para proyectar tu esencia con elegancia y confianza.',
  },
  {
    title: 'Experiencias personalizadas',
    description: 'Creamos ambientes a medida, guiando cada pose y emoción para lograr fotografías naturales y memorables.',
  },
  {
    title: 'Entrega profesional',
    description: 'Postproducción cuidada, galerías privadas y formatos listos para impresión o difusión digital.',
  },
]

export default function Home(){
  return (
    <div className="space-y-8">
      <section id="inicio" className="page-section pt-8">
        <div className="container-1120 grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] items-center">
          <div className="space-y-4">
            <span className="section-eyebrow">Aguín Fotografía</span>
            <h1 className="leading-tight">
              Historias visuales que honran tu esencia
            </h1>
            <p className="section-subtitle max-w-xl">
              Sesiones fotográficas con dirección artística, luz cálida y estilo editorial para retratar momentos que trascienden.
            </p>
            <div className="flex flex-wrap gap-3">
              <a className="btn btn-primary" href="/reservar">Reservar sesión</a>
              <a className="btn btn-ghost border border-[color:var(--border)]" href="/portafolio">Ver portafolio</a>
            </div>
          </div>
          <div className="relative">
            <figure className="relative overflow-hidden rounded-[2.75rem] border border-[color:var(--border)] shadow-soft aspect-[4/5] md:aspect-[5/6]">
              <img src="/img/hero-texture.svg" alt="Fondo artístico" className="absolute inset-0 h-full w-full object-cover" />
              <img
                src="https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=1200&auto=format&fit=crop"
                alt="Sesión fotográfica en estudio"
                className="absolute inset-0 h-full w-full object-cover mix-blend-multiply opacity-80"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-white/5 via-transparent to-[#443A35]/75"></div>
              <figcaption className="relative h-full p-8 flex flex-col justify-end text-white gap-3">
                <span className="text-xs uppercase tracking-[0.4em] text-amber-200/80">Retratos editoriales</span>
                <p className="text-2xl font-display leading-snug">Iluminación sofisticada y edición fina para resultados de impacto.</p>
              </figcaption>
            </figure>
          </div>
        </div>
      </section>

      <section className="page-section pt-0">
        <div className="section-shell">
          <div className="section-heading">
            <span className="section-eyebrow">Experiencia Aguín</span>
            <h2 className="leading-snug">Una atmósfera creada para inspirarte</h2>
            <p className="section-subtitle">
              Desde la preproducción hasta la entrega final, te acompañamos con un proceso cuidado, transparente y lleno de inspiración.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {highlights.map(item => (
              <article key={item.title} className="card">
                <div className="card-body space-y-3">
                  <h3 className="text-xl font-semibold text-umber">{item.title}</h3>
                  <p className="text-sm leading-relaxed text-slate-600">{item.description}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <GalleryRail />
    </div>
  )
}
