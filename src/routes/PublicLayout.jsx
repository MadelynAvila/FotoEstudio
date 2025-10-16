import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { Outlet } from 'react-router-dom'

export default function PublicLayout(){
  return (
    <div className="min-h-screen grid grid-rows[auto,1fr,auto] bg-white">
      <Navbar />
      <main className="py-3">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
