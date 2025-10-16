export default function Footer(){
  return (
    <footer className="border-t border-[var(--border)] bg-sand text-[#8a816f]">
      <div className="container-1120 grid gap-5 md:grid-cols-3 py-5">
        <div>
          <div className="flex items-center gap-2 font-bold mb-1">
            <img src="/logo192.png" className="h-8 w-8 rounded-full"/>
            <span>Aguín Fotografía</span>
          </div>
          <div className="text-sm">
            <div className="font-semibold">Políticas</div>
            <a href="#" className="hover:underline">Privacidad</a><br />
            <a href="#" className="hover:underline">Cookies</a>
          </div>
        </div>
        <div className="text-sm">
          <div className="font-semibold">Contacto</div>
          Tel: XXXX-XXXX<br />
          Email: contacto@estudio.com
        </div>
        <div className="text-sm">
          <div className="font-semibold">Síguenos</div>
          <div className="flex gap-2"> <a href="#">@</a> <a href="#">F</a> </div>
        </div>
      </div>
      <div className="text-center text-xs py-3">© 2025 Aguín Fotografía</div>
    </footer>
  )
}
