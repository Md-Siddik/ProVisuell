import { Outlet } from "react-router-dom"
import Header from "../components/Header"
import Footer from "../components/Footer"
import ChatWidget from "../components/ChatWidget"
import StartOrderModal from "../components/StartOrderModal"

// Wraps every public-facing route (marketing site, login/signup, the
// customer's own pages) so the navbar and footer are always present no
// matter which of those routes is open. The Owner/Administrator dashboard
// intentionally does NOT use this — it has its own sidebar+topbar shell.
export default function PublicLayout() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <Header />
      <Outlet />
      <Footer />
      <ChatWidget />
      <StartOrderModal />
    </div>
  )
}
