export default function GalleryRail() {
  const images = [
    'https://images.unsplash.com/photo-1516726817505-f5ed825624d8?q=80&w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1520975916090-3105956dac38?q=80&w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1519400197429-404ae1a1e184?q=80&w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?q=80&w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1487412912498-0447578fcca8?q=80&w=800&auto=format&fit=crop',
  ];

  return (
    <section className="page-section pt-0">
      <div className="section-shell">
        <div className="section-heading text-center mx-auto">
          <span className="section-eyebrow mx-auto">Portafolio en movimiento</span>
          <h2 className="text-3xl md:text-4xl">Una pincelada de nuestro estilo</h2>
          <p className="section-subtitle mx-auto text-center">
            Retratos editoriales, lifestyle y fotografía de producto con una estética cálida y contemporánea.
          </p>
        </div>

        <div className="relative">
          <div className="pointer-events-none absolute inset-0 rounded-[2.5rem] border border-white/40 bg-white/40 backdrop-blur" aria-hidden></div>
          <div
            className="relative flex gap-5 overflow-x-auto rounded-[2.5rem] p-6 border border-[color:var(--border)] bg-white shadow-soft"
            style={{ scrollSnapType: 'x mandatory' }}
          >
            {images.map((src, i) => (
              <figure
                key={i}
                className="min-w-[240px] sm:min-w-[260px] h-[200px] sm:h-[220px] rounded-[2rem] overflow-hidden bg-sand border border-[color:var(--border)]"
                style={{ scrollSnapAlign: 'start' }}
              >
                <img src={src} alt={`Muestra ${i + 1}`} className="w-full h-full object-cover" />
              </figure>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
