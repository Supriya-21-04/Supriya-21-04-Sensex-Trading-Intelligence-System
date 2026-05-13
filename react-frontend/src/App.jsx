import { Routes, Route, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar'
import QuantPadModuleShell from './components/QuantPadModuleShell'
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
          <Route path="/quantpad" element={<QuantPadModuleShell />}>
            <Route index element={<QuantDashboard />} />
            <Route path="backtest" element={<QuantBacktestAnalyzer />} />
            <Route path="signals" element={<QuantSignalTester />} />
            <Route path="pine" element={<QuantPineGenerator />} />
            <Route path="strategies" element={<QuantStrategyLibrary />} />
          </Route>
        </Routes>
      </main>
    </div>
  )
}

export default App
