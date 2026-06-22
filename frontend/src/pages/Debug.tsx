import { useEffect, useState } from 'react'
import Layout from '@/components/layout/Layout'
import supabase from '@/lib/supabase'

export default function Debug() {
  const [count, setCount] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('draftable_pool')
      .select('*', { count: 'exact', head: true })
      .then(({ count: c, error: e }) => {
        if (e) setError(e.message)
        else setCount(c)
      })
  }, [])

  return (
    <Layout>
      <div className="max-w-[720px] mx-auto px-4 py-16">
        <h1 className="font-display text-4xl text-cream mb-6">Debug</h1>

        {error && (
          <p className="font-body text-red-400 font-bold mb-4">
            Supabase error: {error}
          </p>
        )}

        {count !== null && (
          <p className="font-body text-2xl text-cream font-bold">
            Connected to Supabase: {count} rows in draftable_pool
          </p>
        )}

        {count === null && !error && (
          <p className="font-body text-muted">Connecting to Supabase…</p>
        )}

        <p className="font-body text-sm text-muted italic mt-4">
          If you see 2671, the whole stack is working.
        </p>
      </div>
    </Layout>
  )
}
