import { useState, useEffect, useCallback } from 'react'
import { toPng } from 'html-to-image'
import { X, Download, Share2 } from 'lucide-react'
import { SharePoster } from '@/components/SharePoster'
import type { SharePosterProps } from '@/components/SharePoster'
import { generateDailyShareText } from '@/lib/dailyShare'

interface SharePosterModalProps extends SharePosterProps {
  isOpen: boolean
  onClose: () => void
  run_id?: string
}

const POSTER_W = 1080
const POSTER_H = 1350

// Detect mobile / touch-first device. navigator.share() is
// reliable on mobile but throws AbortError immediately on
// desktop Chrome without showing a share sheet. We restrict
// Web Share to mobile and always download on desktop.
function isMobileDevice(): boolean {
  // Modern API (Chromium-based browsers): explicit mobile flag
  if (typeof navigator !== 'undefined' && 'userAgentData' in navigator) {
    const ua = (navigator as { userAgentData?: { mobile?: boolean } }).userAgentData
    if (ua?.mobile != null) return ua.mobile
  }
  // Fallback: UA sniff for mobile/tablet patterns
  if (typeof navigator !== 'undefined' && navigator.userAgent) {
    return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  }
  return false
}

export function SharePosterModal({ isOpen, onClose, run_id, ...posterProps }: SharePosterModalProps) {
  const [scale,      setScale]      = useState(0.5)
  const [capturing,  setCapturing]  = useState(false)
  const [copied,     setCopied]     = useState(false)
  const [shareError, setShareError] = useState<string | null>(null)

  // Recompute scale whenever the modal opens or the viewport resizes
  useEffect(() => {
    function compute() {
      const scaleH = (window.innerHeight * 0.80) / POSTER_H
      const scaleW = (window.innerWidth  * 0.88) / POSTER_W
      setScale(Math.min(scaleH, scaleW))
    }
    compute()
    window.addEventListener('resize', compute)
    return () => window.removeEventListener('resize', compute)
  }, [])

  // Lock body scroll while open
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden'
    else         document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  const getPng = useCallback(async (): Promise<string | null> => {
    const node = document.getElementById('sixer-poster-capture')
    if (!node) return null
    return toPng(node, {
      width: POSTER_W,
      height: POSTER_H,
      pixelRatio: 2,
      cacheBust: true,
      backgroundColor: '#0A0E27',
      // Skip all @font-face / font CSS inlining. Google Fonts CSS
      // is loaded cross-origin and toPng cannot read cssRules due
      // to CORS — which throws "SecurityError: Failed to read the
      // 'cssRules' property from 'CSSStyleSheet'". Fonts are
      // already rendered in the live DOM and will appear correctly
      // in the canvas conversion from the browser font cache.
      skipFonts: true,
    })
  }, [])

  const handleDownload = useCallback(async () => {
    if (capturing) return
    setCapturing(true)
    try {
      const dataUrl = await getPng()
      if (!dataUrl) {
        console.error('Download: getPng returned null')
        return
      }
      const link = document.createElement('a')
      link.download = `sixer-${posterProps.record}-${Date.now()}.png`
      link.href = dataUrl
      link.click()
    } catch (err) {
      console.error('Download failed:', err)
    } finally {
      setCapturing(false)
    }
  }, [capturing, getPng, posterProps.record])

  const handleShare = useCallback(async () => {
    if (capturing) return

    const isMobile = isMobileDevice()

    try {
      // ── Daily ──────────────────────────────────────────────────────────────
      if (posterProps.mode === 'daily') {
        // Mobile: emoji-grid Web Share (unchanged)
        if (isMobile && typeof navigator.share === 'function') {
          const shareText = generateDailyShareText({
            dailyNumber: posterProps.dailyNumber ?? 0,
            record:      posterProps.record,
            sixerScore:  posterProps.sixerScore,
            tier:        posterProps.tier,
            xi:          posterProps.xi,
          })
          try {
            await navigator.share({ text: shareText })
          } catch (err) {
            const e = err as { name?: string }
            if (e?.name !== 'AbortError') console.error('Daily Web Share failed:', err)
          }
          return
        }

        // Desktop: emoji grid → clipboard
        const shareText = generateDailyShareText({
          dailyNumber: posterProps.dailyNumber ?? 0,
          record:      posterProps.record,
          sixerScore:  posterProps.sixerScore,
          tier:        posterProps.tier,
          xi:          posterProps.xi,
        })
        await navigator.clipboard.writeText(shareText)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
        return
      }

      // ── Classic / CricIQ ───────────────────────────────────────────────────
      const [w, l]    = posterProps.record.split(/[–—-]/).map(s => s.trim())
      const modeLabel = posterProps.mode === 'criciq' ? 'CricIQ' : 'Classic'
      const runUrl    = run_id ? `https://playsixer.vercel.app/run/${run_id}` : 'https://playsixer.vercel.app'
      const shareText =
        `I built a ${w}-${l} team on Sixer - ${modeLabel}\n` +
        `Sixer Score ${posterProps.sixerScore.toFixed(2)} · Tier ${posterProps.tier}\n\n` +
        `Pick the XI. Chase 16-0.\n${runUrl}`

      // Mobile: PNG file share (unchanged)
      if (isMobile) {
        setCapturing(true)
        const dataUrl = await getPng()
        if (!dataUrl) { console.error('Share: getPng returned null'); return }
        const blob = await (await fetch(dataUrl)).blob()
        const file = new File([blob], 'sixer-poster.png', { type: 'image/png' })
        const fileShareData = {
          files: [file],
          title: `I built a ${w}-${l} team on Sixer`,
          text:  shareText,
        }
        if (typeof navigator.canShare === 'function' && navigator.canShare(fileShareData)) {
          try {
            await navigator.share(fileShareData)
          } catch (err) {
            const e = err as { name?: string }
            if (e?.name !== 'AbortError') console.error('Mobile Web Share failed:', err)
          }
          return
        }
        // Mobile but no file-share support: try text-only Web Share
        if (typeof navigator.share === 'function') {
          try {
            await navigator.share({ text: shareText })
            return
          } catch (err) {
            const e = err as { name?: string }
            if (e?.name === 'AbortError') return
          }
        }
        // Mobile last resort: clipboard
        await navigator.clipboard.writeText(shareText)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
        return
      }

      // Desktop: clipboard directly — no Web Share
      await navigator.clipboard.writeText(shareText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)

    } catch (err) {
      console.error('Share failed:', err)
      setShareError("Couldn't copy. Try again.")
      setTimeout(() => setShareError(null), 3000)
    } finally {
      setCapturing(false)
    }
  }, [capturing, getPng, posterProps, run_id])

  if (!isOpen) return null

  const displayW = Math.round(POSTER_W * scale)
  const displayH = Math.round(POSTER_H * scale)

  return (
    <div
      style={{ zIndex: 100 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Close button */}
      <div className="flex justify-end mb-3" style={{ width: displayW }}>
        <button
          type="button"
          onClick={onClose}
          className="text-cream/60 hover:text-saffron transition-colors p-1"
          aria-label="Close poster"
        >
          <X size={22} />
        </button>
      </div>

      {/* Scaled poster wrapper — outer div controls layout size, inner div is full-res */}
      <div
        style={{
          width: displayW,
          height: displayH,
          flexShrink: 0,
          overflow: 'hidden',
          borderRadius: 8,
          boxShadow: '0 0 60px rgba(0,0,0,0.6)',
        }}
      >
        <div
          style={{
            width: POSTER_W,
            height: POSTER_H,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
        >
          <SharePoster {...posterProps} />
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-col gap-2 mt-4" style={{ width: displayW }}>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => void handleDownload()}
            disabled={capturing}
            className={[
              'flex-1 flex items-center justify-center gap-2 py-3 rounded-lg',
              'bg-saffron text-navy font-body font-bold text-sm uppercase tracking-wider',
              'hover:opacity-90 transition-opacity disabled:opacity-50',
            ].join(' ')}
          >
            <Download size={16} />
            <span>{capturing ? 'Saving…' : 'Download Poster'}</span>
          </button>

          <button
            type="button"
            onClick={() => void handleShare()}
            disabled={capturing || (posterProps.mode !== 'daily' && !isMobileDevice() && !run_id)}
            title={!isMobileDevice() && !run_id ? 'Submitting your run…' : undefined}
            className={[
              'flex-1 flex items-center justify-center gap-2 py-3 rounded-lg',
              'bg-pitch text-navy font-body font-bold text-sm uppercase tracking-wider',
              'hover:opacity-90 transition-opacity disabled:opacity-50',
            ].join(' ')}
          >
            <Share2 size={16} />
            <span>{copied ? '✓ COPIED — PASTE ANYWHERE' : capturing ? 'Saving…' : posterProps.mode === 'daily' ? 'SHARE GRID' : 'Share'}</span>
          </button>
        </div>

        {shareError && (
          <p className="font-body text-xs text-red-400 text-center">{shareError}</p>
        )}
      </div>
    </div>
  )
}
