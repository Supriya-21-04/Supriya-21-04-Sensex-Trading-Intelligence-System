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
    <nav style={styles.nav}>
      <div style={styles.logo}>
        <img 
          src="https://www.bseindia.com/images/BSE_Logo.png" 
          alt="BSE Logo" 
          style={styles.logoImg} 
        />
        <span style={styles.title}>Intelligence System</span>
      </div>
      <div style={styles.links}>
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            style={{
              ...styles.link,
              ...(location.pathname === item.path ? styles.activeLink : {}),
            }}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  )
}

const styles = {
  nav: {
    backgroundColor: '#11141c',
    padding: '15px 30px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '1px solid #3e4250',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
  },
  logoImg: {
    width: '60px',
    height: 'auto',
  },
  title: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#ffffff',
  },
  links: {
    display: 'flex',
    gap: '25px',
  },
  link: {
    color: '#808495',
    textDecoration: 'none',
    fontSize: '16px',
    transition: 'color 0.2s',
  },
  activeLink: {
    color: '#2e7bcf',
    fontWeight: '600',
  },
}

export default Navbar
