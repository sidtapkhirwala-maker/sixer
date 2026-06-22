import { Link } from 'react-router-dom'
import { User } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useDisplayName } from '@/hooks/useDisplayName'
import { signInWithGoogle, signOut } from '@/lib/auth'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'

const AVATAR_PALETTE = ['#FF6B1A', '#00C896', '#9D71E8', '#F4C430', '#29BEFD', '#F43256']

function avatarBg(userId: string): string {
  const hash = [...userId].reduce((s, c) => s + c.charCodeAt(0), 0)
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length]
}

export default function Header() {
  const { user, loading } = useAuth()
  const displayName = useDisplayName()

  return (
    <header className="sticky top-0 z-50 w-full bg-navy border-b border-subtle h-[56px] md:h-[60px] flex items-center">
      <div className="max-w-7xl mx-auto px-4 w-full flex items-center justify-between">
        <Link to="/" className="flex items-center select-none">
          <span className="font-display text-[28px] leading-none tracking-tight">
            <span className="text-cream">SIX</span>
            <span className="text-saffron">ER</span>
          </span>
        </Link>

        <nav className="flex items-center gap-4 md:gap-6">
          <Link
            to="/how-to-play"
            className="font-body text-sm text-muted hover:text-saffron transition-colors"
          >
            How to Play
          </Link>
          <Link
            to="/privacy"
            className="font-body text-sm text-muted hover:text-saffron transition-colors"
          >
            Privacy
          </Link>
          <Link
            to="/leaderboard"
            className="font-body text-sm text-muted hover:text-saffron transition-colors"
          >
            Leaderboards
          </Link>

          {!loading && (
            user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    style={{ backgroundColor: avatarBg(user.id) }}
                    className="w-8 h-8 rounded-full text-navy font-display text-sm flex items-center justify-center select-none hover:opacity-90 transition-opacity"
                  >
                    {(
                      displayName
                      ?? (user.user_metadata?.full_name as string | undefined)
                      ?? user.email
                      ?? '?'
                    ).charAt(0).toUpperCase()}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>
                    {displayName ?? (user.user_metadata?.full_name as string | undefined) ?? user.email}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/profile">Profile</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => signOut()}>
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Account menu"
                    className={[
                      // Mobile: 32px circular icon button (matches avatar footprint)
                      'w-8 h-8 rounded-full flex items-center justify-center',
                      'border border-subtle text-cream',
                      'hover:border-saffron hover:text-saffron transition-colors',
                      // Desktop: expand into a text pill
                      'md:w-auto md:h-auto md:px-3 md:py-1.5 md:gap-1.5',
                      'md:font-body md:font-bold md:uppercase md:tracking-wider md:text-[10px]',
                    ].join(' ')}
                  >
                    <User className="w-4 h-4 md:hidden" strokeWidth={2} />
                    <span className="hidden md:inline">SIGN IN</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Welcome to Sixer</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => signInWithGoogle()}>
                    Sign in with Google
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/leaderboard">View leaderboards</Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )
          )}
        </nav>
      </div>
    </header>
  )
}
