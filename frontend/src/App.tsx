import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home        from '@/pages/Home'
import Draft       from '@/pages/Draft'
import Results     from '@/pages/Results'
import HowToPlay   from '@/pages/HowToPlay'
import Privacy     from '@/pages/Privacy'
import Terms      from '@/pages/Terms'
import Debug       from '@/pages/Debug'
import AuthCallback  from '@/pages/AuthCallback'
import Onboarding   from '@/pages/Onboarding'
import Leaderboard  from '@/pages/Leaderboard'
import Profile      from '@/pages/Profile'
import Daily        from '@/pages/Daily'
import RunView      from '@/pages/RunView'
import ScrollToTop from "./components/ScrollToTop"

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route path="/"             element={<Home />}         />
        <Route path="/draft"        element={<Draft />}        />
        <Route path="/results"      element={<Results />}      />
        <Route path="/how-to-play"  element={<HowToPlay />}   />
        <Route path="/privacy"      element={<Privacy />}      />
        <Route path="/terms"        element={<Terms />}        />
        <Route path="/debug"        element={<Debug />}        />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/onboarding"   element={<Onboarding />}  />
        <Route path="/leaderboard"  element={<Leaderboard />} />
        <Route path="/profile"      element={<Profile />}     />
        <Route path="/daily"        element={<Daily />}       />
        <Route path="/run/:run_id"  element={<RunView />}     />
      </Routes>
    </BrowserRouter>
  )
}
