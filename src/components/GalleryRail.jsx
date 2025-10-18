import { useCallback, useEffect, useMemo, useState } from 'react'

const SLIDE_INTERVAL = 5000

const galleryImages = [
  {
    src: 'https://images.unsplash.com/photo-1516726817505-f5ed825624d8?q=80&w=1600&auto=format&fit=crop',
    alt: 'Retrato femenino con iluminación cálida',
  },
  {
    src: 'https://images.unsplash.com/photo-1520975916090-3105956dac38?q=80&w=1600&auto=format&fit=crop',
    alt: 'Novios durante sesión fotográfica al aire libre',
  },
  {
    src: 'https://images.unsplash.com/photo-1519400197429-404ae1a1e184?q=80&w=1600&auto=format&fit=crop',
    alt: 'Fotografía de moda con tonos tierra',
  },
  {
    src: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?q=80&w=1600&auto=format&fit=crop',
    alt: 'Retrato artístico en estudio con luz lateral',
  },
  {
    src: 'https://images.unsplash.com/photo-1487412912498-0447578fcca8?q=80&w=1600&auto=format&fit=crop',
    alt: 'Editorial de producto con composición minimalista',
  },
]

export default function GalleryRail() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedImage, setSelectedImage] = useState(null)
  const slides = useMemo(() => galleryImages, [])
  const totalSlides = slides.length

  const goToSlide = useCallback(
    (index) => {
      const nextIndex = (index + totalSlides) % totalSlides
      setCurrentIndex(nextIndex)
    },
    [totalSlides],
  )

  const handleNext = useCallback(() => {
    goToSlide(currentIndex + 1)
  }, [currentIndex, goToSlide])

  const handlePrevious = useCallback(() => {
    goToSlide(currentIndex - 1)
  }, [currentIndex, goToSlide])

  useEffect(() => {
    const interval = setInterval(() => {
      goToSlide(currentIndex + 1)
    }, SLIDE_INTERVAL)

    return () => clearInterval(interval)
  }, [currentIndex, goToSlide])

  useEffect(() => {
    if (!selectedImage) return undefined

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setSelectedImage(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedImage])

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

          <div className="relative overflow-hidden rounded-[2.5rem] border border-[color:var(--border)] bg-white shadow-soft">
            <div
              className="flex transition-transform duration-700 ease-out"
              style={{ transform: `translateX(-${currentIndex * 100}%)` }}
            >
              {slides.map((image, index) => (
                <button
                  key={image.src}
                  type="button"
                  className="group relative min-w-full focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-umber/25"
                  onClick={() => setSelectedImage(image)}
                >
                  <figure className="aspect-[5/3] w-full overflow-hidden bg-sand sm:aspect-[5/2]">
                    <img
                      src={image.src}
                      alt={image.alt}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                      loading={index === 0 ? 'eager' : 'lazy'}
                    />
                  </figure>
                </button>
              ))}
            </div>

            <div className="pointer-events-none absolute inset-y-0 left-0 right-0 flex items-center justify-between px-4">
              <div className="h-24 w-24 bg-gradient-to-r from-white to-transparent opacity-80 md:h-32 md:w-32" aria-hidden></div>
              <div className="h-24 w-24 bg-gradient-to-l from-white to-transparent opacity-80 md:h-32 md:w-32" aria-hidden></div>
            </div>

            <div className="absolute inset-y-0 left-0 flex items-center">
              <button
                type="button"
                onClick={handlePrevious}
                className="m-4 flex h-12 w-12 items-center justify-center rounded-full border border-[color:var(--border)] bg-white/90 text-umber shadow-sm transition hover:-translate-x-0.5 hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-umber/20"
                aria-label="Ver imagen anterior"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
                  <path d="M14.7 5.3a1 1 0 0 1 0 1.4L10.42 11l4.3 4.3a1 1 0 0 1-1.42 1.4l-5-5a1 1 0 0 1 0-1.4l5-5a1 1 0 0 1 1.4 0Z" fill="currentColor" />
                </svg>
              </button>
            </div>

            <div className="absolute inset-y-0 right-0 flex items-center">
              <button
                type="button"
                onClick={handleNext}
                className="m-4 flex h-12 w-12 items-center justify-center rounded-full border border-[color:var(--border)] bg-white/90 text-umber shadow-sm transition hover:translate-x-0.5 hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-umber/20"
                aria-label="Ver imagen siguiente"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
                  <path d="M9.3 18.7a1 1 0 0 1 0-1.4L13.58 13l-4.3-4.3A1 1 0 0 1 10.7 7.3l5 5a1 1 0 0 1 0 1.4l-5 5a1 1 0 0 1-1.4 0Z" fill="currentColor" />
                </svg>
              </button>
            </div>

            <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 gap-2">
              {slides.map((image, index) => (
                <button
                  key={image.src}
                  type="button"
                  aria-label={`Ir a la imagen ${index + 1}`}
                  className={`h-2.5 w-2.5 rounded-full transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-umber/20 ${
                    currentIndex === index
                      ? 'bg-umber shadow-[0_0_0_4px_rgba(68,58,53,0.15)]'
                      : 'bg-slate-300/70 hover:bg-slate-400'
                  }`}
                  onClick={() => goToSlide(index)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {selectedImage && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-[#181310]/70 p-6 backdrop-blur"
          role="dialog"
          aria-modal="true"
          onClick={() => setSelectedImage(null)}
        >
          <div
            className="relative w-full max-w-4xl overflow-hidden rounded-[2rem] border border-white/20 bg-white/95 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setSelectedImage(null)}
              className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-slate-600 transition hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-umber/20"
              aria-label="Cerrar imagen ampliada"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
                <path
                  d="M16.24 7.76a1 1 0 0 0-1.41-1.41L12 9.17 9.17 6.35A1 1 0 0 0 7.76 7.76L10.59 10.6 7.76 13.4a1 1 0 0 0 1.41 1.42L12 12l2.83 2.82a1 1 0 1 0 1.41-1.41L13.41 10.6l2.83-2.83Z"
                  fill="currentColor"
                />
              </svg>
            </button>
            <img src={selectedImage.src} alt={selectedImage.alt} className="h-full w-full object-cover" />
          </div>
        </div>
      )}
    </section>
  )
}
