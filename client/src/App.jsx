import { Routes, Route } from 'react-router-dom'
import Home from './components/Home'
import Lobby from './components/Lobby'
import Game from './components/Game'

export default function App() {
  return (
    <div className="min-h-screen text-white">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/join/:code" element={<Home />} />
        <Route path="/lobby/:code" element={<Lobby />} />
        <Route path="/game/:code" element={<Game />} />
      </Routes>
    </div>
  )
}
