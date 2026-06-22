import supabase from './supabase'

export async function signInWithGoogle(): Promise<void> {
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/auth/callback` },
  })
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut()
}
