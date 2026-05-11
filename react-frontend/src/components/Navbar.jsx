import { Link, useLocation } from 'react-router-dom'

const Navbar = () => {
  const location = useLocation()

  const navItems = [
    { path: '/', label: '🏠 Home & Overview' },
    { path: '/news', label: '📰 News & Mood' },
    { path: '/paper-trading', label: '🎲 Paper Trading Demo' },
    { path: '/settings', label: '⚙️ Settings & Tools' },
  ]

  return (
    <header className="topnav">
      <div className="topnav__brand">
        <div className="topnav__titles">
          <span className="topnav__title">SENSEX Intelligence System</span>
        </div>
      </div>
      <nav className="topnav__links" aria-label="Primary">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={
              location.pathname === item.path
                ? 'topnav__link topnav__link--active'
                : 'topnav__link'
            }
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  )
}

export default Navbar
