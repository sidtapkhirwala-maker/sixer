import { Link } from 'react-router-dom'

const KOFI_URL     = 'https://ko-fi.com/sidtapkhirwala'
const FEEDBACK_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSdI0pWysynbQux3S8i_eZZwIsa6EElxU-QxKXZOzfavT7rrdQ/viewform?usp=header'

export default function Footer() {
  return (
    <footer className="border-t border-cream/10 bg-navy mt-12">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 md:py-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 md:gap-6">

          {/* Brand */}
          <div className="flex flex-col">
            <span className="font-display text-xl leading-none tracking-tight select-none">
              <span className="text-cream">SIX</span>
              <span className="text-saffron">ER</span>
            </span>
            <span className="font-body text-[10px] md:text-xs tracking-widest text-cream/40 mt-0.5 uppercase">
              PICK THE XI. CHASE 16-0.
            </span>
          </div>

          {/* Links */}
          <nav className="flex flex-wrap items-center gap-x-3 gap-y-1 font-body text-xs md:text-sm text-cream/60">
            <Link to="/how-to-play" className="hover:text-saffron transition-colors">How to Play</Link>
            <span className="text-cream/20">·</span>
            <Link to="/privacy" className="hover:text-saffron transition-colors">Privacy</Link>
            <span className="text-cream/20">·</span>
            <Link to="/terms" className="hover:text-saffron transition-colors">Terms</Link>
            <span className="text-cream/20">·</span>
            <Link to="/leaderboard" className="hover:text-saffron transition-colors">Leaderboards</Link>
            <span className="text-cream/20">·</span>
            <a href={FEEDBACK_URL} target="_blank" rel="noopener noreferrer" className="hover:text-saffron transition-colors">Feedback</a>
            <span className="text-cream/20">·</span>
            <a href={KOFI_URL} target="_blank" rel="noopener noreferrer" className="hover:text-saffron transition-colors">Buy me a coffee ☕</a>
          </nav>

          {/* Copyright */}
          <p className="font-body text-[10px] md:text-xs text-cream/40 leading-tight md:text-right md:max-w-[200px]">
            © 2026 Sixer · Independent fan project, not affiliated with the BCCI, IPL, or any franchise.
          </p>

        </div>
      </div>
    </footer>
  )
}
