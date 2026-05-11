import { Routes, Route, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import News from './pages/News'
import PaperTrading from './pages/PaperTrading'
import Settings from './pages/Settings'
import QuantDashboard from '../../pramukh/Quantpad/src/pages/Dashboard'
import QuantBacktestAnalyzer from '../../pramukh/Quantpad/src/pages/BacktestAnalyzer'
import QuantSignalTester from '../../pramukh/Quantpad/src/pages/SignalTester'
import QuantPineGenerator from '../../pramukh/Quantpad/src/pages/PineGenerator'
import QuantStrategyLibrary from '../../pramukh/Quantpad/src/pages/StrategyLibrary'

function App() {
  const location = useLocation()
  const isPramukhRoute = location.pathname.startsWith('/quantpad')

  return (
    <div className={`app ${isPramukhRoute ? 'app--pramukh' : ''}`}>
      <Navbar />
      <main className={`main-content ${isPramukhRoute ? 'main-content--pramukh' : ''}`}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/news" element={<News />} />
          <Route path="/paper-trading" element={<PaperTrading />} />
          <Route path="/pipeline" element={<Settings />} />
          <Route path="/quantpad" element={<QuantDashboard />} />
          <Route path="/quantpad/backtest" element={<QuantBacktestAnalyzer />} />
          <Route path="/quantpad/signals" element={<QuantSignalTester />} />
          <Route path="/quantpad/pine" element={<QuantPineGenerator />} />
          <Route path="/quantpad/strategies" element={<QuantStrategyLibrary />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
