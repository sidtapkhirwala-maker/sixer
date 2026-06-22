import { useState, useEffect, useCallback } from 'react'
import { toPng } from 'html-to-image'
import { X, Download, Share2 } from 'lucide-react'
import { SharePoster } from '@/components/SharePoster'
import type { SharePosterProps } from '@/components/SharePoster'

interface SharePosterModalProps extends SharePosterProps {
  isOpen: boolean
  onClose: () => void
}

const POSTER_W = 1080
const POSTER_H = 1350

export function SharePosterModal({ isOpen, onClose, ...posterProps }: SharePosterModalProps) {
  const [scale, setScale] = useState(0.5)
  const [capturing, setCapturing] = useState(false)

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
    })
  }, [])

  const handleDownload = useCallback(async () => {
    if (capturing) return
    setCapturing(true)
    try {
      const dataUrl = await getPng()
      if (!dataUrl) return
      const link = document.createElement('a')
      link.download = `sixer-${posterProps.record}-${Date.now()}.png`
      link.href = dataUrl
      link.click()
    } finally {
      setCapturing(false)
    }
  }, [capturing, getPng, posterProps.record])

  const handleShare = useCallback(async () => {
    if (capturing) return
    setCapturing(true)
    try {
      const dataUrl = await getPng()
      if (!dataUrl) return

      const blob  = await (await fetch(dataUrl)).blob()
      const file  = new File([blob], 'sixer-poster.png', { type: 'image/png' })
      const shareData = {
        files: [file],
        title: `I built a ${posterProps.record} team on Sixer`,
        text:  `${posterProps.record} · Sixer Score ${posterProps.sixerScore.toFixed(2)} · Tier ${posterProps.tier}\n\nPick the XI. Chase 16-0.\n\nhttps://playsixer.vercel.app`,
      }

      if (navigator.canShare && navigator.canShare(shareData)) {
        try { await navigator.share(shareData) } catch { /* user cancelled */ }
      } else {
        // Fallback: download
        const link = document.createElement('a')
        link.download = `sixer-${posterProps.record}-${Date.now()}.png`
        link.href = dataUrl
        link.click()
      }
    } finally {
      setCapturing(false)
    }
  }, [capturing, getPng, posterProps.record, posterProps.sixerScore, posterProps.tier])

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
      <div className="flex gap-3 mt-4" style={{ width: displayW }}>
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
          disabled={capturing}
          className={[
            'flex-1 flex items-center justify-center gap-2 py-3 rounded-lg',
            'bg-pitch text-navy font-body font-bold text-sm uppercase tracking-wider',
            'hover:opacity-90 transition-opacity disabled:opacity-50',
          ].join(' ')}
        >
          <Share2 size={16} />
          <span>{capturing ? 'Saving…' : 'Share'}</span>
        </button>
      </div>
    </div>
  )
}
