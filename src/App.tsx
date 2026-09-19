import { useEffect } from 'react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ThemeProvider } from './lib/theme'
import { requestPersist } from './lib/backup'
import { isNative, healthCheck, syncHealth } from './lib/native'
import { calendarCheck, syncDeviceCalendar } from './lib/calendar'
import { getSettings } from './lib/settings'
import Today from './pages/Today'
import Finance from './pages/Finance'
import Photos from './pages/Photos'
import Notes from './pages/Notes'
import Habits from './pages/Habits'
import Mood from './pages/Mood'
import Goals from './pages/Goals'
import Health from './pages/Health'
import Wishlist from './pages/Wishlist'
import Events from './pages/Events'
import CalendarPage from './pages/Calendar'
import SettingsPage from './pages/Settings'

export default function App() {
  useEffect(() => {
    void requestPersist()
    if (!isNative) return
    let busy = false
    const sync = async () => {
      if (busy) return
      busy = true
      try {
        const s = await getSettings()
        if (s.healthConnected && (await healthCheck())) await syncHealth(30)
        if (s.calendarConnected && (await calendarCheck())) await syncDeviceCalendar()
      } catch {
        /* ignore */
      } finally {
        busy = false
      }
    }
    void sync()
    const onVis = () => document.visibilityState === 'visible' && void sync()
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  return (
    <ThemeProvider>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Today />} />
            <Route path="finance" element={<Finance />} />
            <Route path="photos" element={<Photos />} />
            <Route path="notes" element={<Notes />} />
            <Route path="habits" element={<Habits />} />
            <Route path="mood" element={<Mood />} />
            <Route path="goals" element={<Goals />} />
            <Route path="health" element={<Health />} />
            <Route path="wishlist" element={<Wishlist />} />
            <Route path="events" element={<Events />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </HashRouter>
    </ThemeProvider>
  )
}
