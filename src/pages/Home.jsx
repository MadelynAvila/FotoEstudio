import GalleryRail from '../components/GalleryRail'

export default function Home(){
  return (
    <section id="inicio">
      {/* Hero */}
      <div className="py-6">
        <div className="container-1120 grid md:grid-cols-[1.2fr,1fr] gap-8 items-start">
          <div>
            <div className="uppercase tracking-[.2em] muted">Aguín Fotografía</div>
            <h1 className="text-4xl font-display">Fotografía de estudio</h1>
            <p className="muted max-w-xl">Creatividad + técnica para que tu historia se vea auténtica.</p>
            <a className="btn btn-primary mt-3" href="/reservar">Reservar ahora</a>
          </div>
          <figure className="rounded-xl2 overflow-hidden shadow-soft min-h-[320px]">
            <img className="w-full h-full object-cover grayscale" src="https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=1000&auto=format&fit=crop"/>
          </figure>
        </div>
      </div>

      {/* Galería bajo el héroe */}
      <GalleryRail />
    </section>
  )
}
