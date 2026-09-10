import { Pencil } from "lucide-react"
import { EditorModeProvider } from "../editor/EditorModeContext"
import Header from "../../components/Header"
import Hero from "../../components/Hero"
import Intro from "../../components/Intro"
import Pillars from "../../components/Pillars"
import Portfolio from "../../components/Portfolio"
import Results from "../../components/Results"
import CtaBanner from "../../components/CtaBanner"
import Footer from "../../components/Footer"

// Renders the real public marketing site — same components, same styling —
// inside an EditorModeProvider so every EditableText/EditableImage inside
// them switches from plain output to double-click-to-edit. Nothing here is
// a rebuilt or approximated preview.
export default function WebsiteEditor() {
  return (
    <EditorModeProvider>
      <div className="-m-[20px] lg:-m-[32px]">
        <div className="sticky top-0 z-[200] flex items-center justify-center gap-[8px] bg-[#ff4b00] px-[16px] py-[8px] text-[12px] font-[700] uppercase tracking-[0.04em] text-white">
          <Pencil size={13} />
          Editor mode — double-click any text or image to edit it live
        </div>
        {/* Header.jsx uses position:fixed for the real site's viewport-pinned
            navbar. `transform` on this wrapper makes it the containing block
            for that fixed element instead, so it stays pinned to the top of
            this preview (and scrolls with the dashboard, not the browser
            window) rather than floating over the dashboard's own chrome. */}
        <div className="relative bg-paper text-ink" style={{ transform: "translateZ(0)" }}>
          <Header />
          <main>
            <Hero />
            <Intro />
            <Pillars />
            <Portfolio />
            <Results />
            <CtaBanner />
          </main>
          <Footer />
        </div>
      </div>
    </EditorModeProvider>
  )
}
