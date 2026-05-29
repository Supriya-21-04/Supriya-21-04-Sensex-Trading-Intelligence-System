import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import axios from 'axios'

const Navbar = () => {
  const location = useLocation()
  const [tickerData, setTickerData] = useState(null)

  useEffect(() => {
    fetchTicker()
    const interval = setInterval(fetchTicker, 30000) // update every 30s
    return () => clearInterval(interval)
  }, [])

  const fetchTicker = async () => {
    try {
      const res = await axios.get('/api/realtime')
      if (res.data.status === 'success') {
        setTickerData(res.data.data)
      }
    } catch (err) {
      console.error('Error fetching ticker:', err)
    }
  }

  const formatPrice = (n) => {
    if (typeof n !== 'number') return '—'
    return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const getActiveCls = (path) => {
    return location.pathname === path ? 'topnav__link topnav__link--active' : 'topnav__link'
  }

  const isToolActive = () => {
    const paths = ['/backtest', '/signals', '/pine', '/strategies']
    return paths.includes(location.pathname)
  }

  const isChangePositive = tickerData ? tickerData.change >= 0 : true

  return (
    <header className="topnav">
      <div className="topnav__left">
        <Link to="/" className="topnav__logo-link">
          <div className="topnav__brand">
            <span className="topnav__icon"></span>
            <div className="topnav__titles">
              <span className="topnav__title">SENSEX Intelligence</span>
              <span className="topnav__subtitle">Real-time Trading & Research System</span>
            </div>
          </div>
        </Link>

        {tickerData && (
          <div className="topnav__ticker">
            <span className="ticker-label">SENSEX</span>
            <span className="ticker-price">₹{formatPrice(tickerData.price)}</span>
            <span className={`ticker-change ${isChangePositive ? 'ticker-change--up' : 'ticker-change--down'}`}>
              {isChangePositive ? '▲' : '▼'} {formatPrice(Math.abs(tickerData.change))} ({tickerData.change_percent.toFixed(2)}%)
            </span>
          </div>
        )}
      </div>

      <div className="topnav__links">
        <Link to="/" className={getActiveCls('/')}>
          Home
        </Link>
      </div>
    </header>
  )
}

export default Navbar
