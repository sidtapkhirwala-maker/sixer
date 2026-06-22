import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import supabase from '@/lib/supabase'

export default function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    let active = true

    async function finish(userId: string) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('display_name')
        .eq('user_id', userId)
        .maybeSingle()
      if (active) navigate(profile ? '/' : '/onboarding', { replace: true })
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return
      if (session?.user.id) {
        finish(session.user.id)
      } else {
        // Fallback: wait for the auth state to settle (implicit-flow tokens)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, sess) => {
          if (event === 'SIGNED_IN' && sess?.user.id && active) {
            subscription.unsubscribe()
            finish(sess.user.id)
          }
        })
      }
    })

    return () => { active = false }
  }, [navigate])

  return (
    <div className="min-h-screen flex items-center justify-center bg-navy">
      <p className="font-body text-sm text-muted animate-pulse">Signing you in…</p>
    </div>
  )
}
