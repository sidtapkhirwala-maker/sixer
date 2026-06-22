import { useEffect, useState } from 'react'
import supabase from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

export function useDisplayName(): string | null {
  const { user } = useAuth()
  const [displayName, setDisplayName] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      setDisplayName(null)
      return
    }

    let mounted = true

    supabase
      .from('user_profiles')
      .select('display_name')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => {
        if (mounted && data) setDisplayName((data as { display_name: string }).display_name)
      })

    const channel = supabase
      .channel(`user_profile_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_profiles',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newName = (payload.new as { display_name?: string }).display_name
          if (mounted && newName) setDisplayName(newName)
        }
      )
      .subscribe()

    return () => {
      mounted = false
      void supabase.removeChannel(channel)
    }
  }, [user?.id])

  return displayName
}
