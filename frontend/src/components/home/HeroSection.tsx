import { Link } from 'react-router-dom'
import ModeCTA from './ModeCTA'
import DailyCTA from './DailyCTA'
import ScoreTicker from './ScoreTicker'

export default function HeroSection() {
  return (
    <section className="relative min-h-screen flex flex-col">
      {/* Background: navy + radial gradient + grid */}
      <div
        className="absolute inset-0 bg-navy"
        style={{
          backgroundImage: [
            'radial-gradient(ellipse 100% 55% at 50% 0%, rgba(20,25,56,0.85) 0%, rgba(10,14,39,0) 70%)',
            'repeating-linear-gradient(0deg,   transparent, transparent 59px, rgba(255,255,255,0.04) 59px, rgba(255,255,255,0.04) 60px)',
            'repeating-linear-gradient(90deg,  transparent, transparent 59px, rgba(255,255,255,0.04) 59px, rgba(255,255,255,0.04) 60px)',
          ].join(', '),
        }}
      />

      {/* Main content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 pt-16 md:pt-24 pb-8 md:pb-12">
        <div className="w-full max-w-[720px] mx-auto flex flex-col items-center gap-6 text-center">

          {/* Badge */}
          <div className="flex items-center gap-2 bg-surface/50 border border-pitch/30 rounded-full px-4 py-2">
            <span className="w-2 h-2 rounded-full bg-pitch shrink-0 inline-block" />
            <span className="font-body text-xs text-muted tracking-widest uppercase">
              PLAY IN 2 MINUTES
            </span>
          </div>

          {/* SIXER logo */}
          <h1 className="font-display text-[80px] md:text-[140px] leading-none tracking-tight">
            <span className="text-cream">SIX</span>
            <span className="text-saffron">ER</span>
          </h1>

          {/* Tagline */}
          <p className="font-display text-xl md:text-2xl leading-snug">
            <span className="text-cream">PICK THE </span>
            <span className="text-saffron">XI</span>
            <span className="text-cream">. CHASE </span>
            <span className="text-pitch">16-0</span>
            <span className="text-cream">. SIXER.</span>
          </p>

          {/* Subhead */}
          <p className="font-body text-base text-muted max-w-[540px]">
            Draft 11 IPL legends. Run the gauntlet. Can you go 16-0?
          </p>

          {/* Mode CTAs */}
          <div className="flex flex-col md:flex-row flex-wrap gap-4 md:gap-6 w-full justify-center mt-2">
            <ModeCTA mode="classic" />
            <ModeCTA mode="criciq" />
            <DailyCTA />
          </div>

          {/* How to play link */}
          <Link
            to="/how-to-play"
            className="font-body text-sm text-muted hover:text-cream hover:underline transition-colors"
          >
            New here? See how it works →
          </Link>

        </div>
      </div>

      {/* Score ticker — pinned to bottom of hero */}
      <ScoreTicker />
    </section>
  )
}
