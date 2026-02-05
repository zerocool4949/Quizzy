import { Routes, Route } from 'react-router-dom'
import Home from './components/Home'
import Lobby from './components/Lobby'
import Game from './components/Game'
import Admin from './components/Admin'
import ErrorBoundary from './components/ErrorBoundary'

export default function App() {
  return (
    <ErrorBoundary>
      <div className="min-h-screen text-white">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/join/:code" element={<Home />} />
          <Route path="/lobby/:code" element={<Lobby />} />
          <Route path="/game/:code" element={<Game />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </div>
    </ErrorBoundary>
  )
}
