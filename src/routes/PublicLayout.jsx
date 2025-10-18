import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { Outlet } from 'react-router-dom'

export default function PublicLayout(){
  return (
    <div className="min-h-screen flex flex-col bg-sand text-slate-700">
      <Navbar />
      <main className="flex-1 pt-6 md:pt-10">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
