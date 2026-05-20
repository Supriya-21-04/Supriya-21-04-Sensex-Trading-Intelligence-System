import { Link } from 'react-router-dom'

const Navbar = () => {
  return (
    <header className="topnav" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div className="topnav__brand">
        <div className="topnav__titles">
          <span className="topnav__title">SENSEX Intelligence System</span>
          <span className="topnav__subtitle">Use the scroll sections below to explore modules</span>
        </div>
      </div>
      <div className="topnav__links">
        <Link to="/" className="topnav__link" style={{ background: 'var(--color-accent, #6366f1)', color: 'white', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>🏠</span> Home
        </Link>
      </div>
    </header>
  )
}

export default Navbar
