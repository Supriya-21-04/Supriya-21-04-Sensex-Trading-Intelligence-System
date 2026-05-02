import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import News from './pages/News'
import PaperTrading from './pages/PaperTrading'
import Settings from './pages/Settings'

function App() {
  return (
    <div className="app">
      <Navbar />
      <main style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/news" element={<News />} />
          <Route path="/paper-trading" element={<PaperTrading />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
