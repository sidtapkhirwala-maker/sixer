import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import supabase from '@/lib/supabase'

export default function Onboarding() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [name, setName]         = useState('')
  const [error, setError]       = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!loading && !user) {
      navigate('/', { replace: true })
    }
  }, [loading, user, navigate])

  useEffect(() => {
    if (!user) return
    supabase
      .from('user_profiles')
      .select('display_name')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) navigate('/', { replace: true })
      })
  }, [user, navigate])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    setError('')

    if (trimmed.length < 2 || trimmed.length > 24) {
      setError('Name must be 2–24 characters.')
      return
    }
    if (!/^[a-zA-Z0-9 ._-]+$/.test(trimmed)) {
      setError('Only letters, numbers, spaces, dots, underscores, and hyphens.')
      return
    }
    if (!user) return

    setSubmitting(true)
    const { error: dbErr } = await supabase
      .from('user_profiles')
      .insert({ user_id: user.id, display_name: trimmed })

    if (dbErr) {
      setError('Something went wrong. Try a different name.')
      setSubmitting(false)
      return
    }
    navigate('/', { replace: true })
  }

  if (loading) return null

  return (
    <div className="min-h-screen bg-navy flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-saffron" />
          <span className="font-body text-xs uppercase tracking-widest text-saffron">Leaderboards</span>
        </div>
        <h1 className="font-display text-4xl text-cream mb-2">Choose your handle</h1>
        <p className="font-body text-sm text-muted mb-8">
          This is how you'll appear on the leaderboard.
        </p>
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
            disabled={submitting || name.trim().length < 2}
            className="bg-saffron text-navy font-display text-lg py-3 rounded-lg disabled:opacity-40 transition-opacity"
          >
            {submitting ? 'Saving…' : 'LOCK IT IN'}
          </button>
        </form>
      </div>
    </div>
  )
}
