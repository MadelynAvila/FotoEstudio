export default function GalleryRail(){
  const images = [
    'https://images.unsplash.com/photo-1516726817505-f5ed825624d8?q=80&w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1520975916090-3105956dac38?q=80&w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1519400197429-404ae1a1e184?q=80&w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?q=80&w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1487412912498-0447578fcca8?q=80&w=800&auto=format&fit=crop',
  ]

  return (
    <section className="py-6">
      <div className="container-1120">
        <h2 className="text-center text-2xl font-display mb-3">Galería de imágenes</h2>
        <div className="relative">
          <div className="flex gap-3 overflow-x-auto p-3 border rounded-xl2 bg-white" style={{scrollSnapType:'x mandatory'}}>
            {images.map((src,i)=> (
              <figure key={i} className="min-w-[220px] h-[180px] rounded-xl2 overflow-hidden bg-sand border" style={{scrollSnapAlign:'start'}}>
                <img src={src} alt={`Muestra ${i+1}`} className="w-full h-full object-cover grayscale" />
              </figure>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
