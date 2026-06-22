import type { ReactNode } from 'react'
import Header from './Header'

interface SlimLayoutProps {
  children: ReactNode
}

export default function SlimLayout({ children }: SlimLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-navy">
      <Header />
      <main className="flex-1 flex flex-col">{children}</main>
    </div>
  )
}
