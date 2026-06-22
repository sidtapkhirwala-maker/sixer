import { useState, type FormEvent } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

interface GuestNameModalProps {
  onConfirm: (name: string) => void
}

export default function GuestNameModal({ onConfirm }: GuestNameModalProps) {
  const [name, setName]   = useState('')
  const [error, setError] = useState('')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    setError('')

    if (trimmed.length < 2 || trimmed.length > 24) {
      setError('Must be 2–24 characters.')
      return
    }
    if (!/^[a-zA-Z0-9 ._-]+$/.test(trimmed)) {
      setError('Letters, numbers, spaces, dots, underscores, hyphens only.')
      return
    }
    onConfirm(trimmed)
  }

  return (
    <Dialog open>
      <DialogContent
        onInteractOutside={e => e.preventDefault()}
        onEscapeKeyDown={e => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>What's your name?</DialogTitle>
          <DialogDescription>
            Enter a handle to save your score to Leaderboards.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. CricketWizard"
            maxLength={24}
            autoFocus
            className="bg-navy border border-subtle rounded-lg px-4 py-3 font-body text-sm text-cream placeholder:text-muted focus:outline-none focus:border-saffron transition-colors"
          />
          {error && <p className="font-body text-xs text-saffron">{error}</p>}
          <button
            type="submit"
            disabled={name.trim().length < 2}
            className="bg-saffron text-navy font-display text-lg py-3 rounded-lg disabled:opacity-40 transition-opacity"
          >
            LET'S GO
          </button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
