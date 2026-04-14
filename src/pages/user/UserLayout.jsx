import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import AuthModal from '../../components/AuthModal'

export default function UserLayout() {
  const { user, signOut } = useAuth()
  const [showAuth, setShowAuth] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  const handleSignOut = async () => {
    try { await signOut() } catch {}
    navigate('/')
  }

  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'
  const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div>
      <nav className="navbar">
        <Link to="/" className="navbar-brand">
          <div className="navbar-logo">S</div>
          <span className="navbar-title">Stay<span>Ease</span></span>
        </Link>

        <div className="navbar-actions">
          {user && (
            <Link to="/bookings" className={`navbar-link ${location.pathname === '/bookings' ? 'active' : ''}`}>
              My Bookings
            </Link>
          )}

          {user ? (
            <div className="navbar-user">
              <div className="navbar-avatar">{initials}</div>
              <span style={{ color: 'rgba(255,255,255,0.9)' }}>{displayName}</span>
              <button className="btn btn-outline btn-sm" style={{ borderColor: 'rgba(255,255,255,0.3)', color: '#fff' }} onClick={handleSignOut}>
                Logout
              </button>
            </div>
          ) : (
            <button className="btn btn-accent btn-sm" onClick={() => setShowAuth(true)}>
              Login / Sign Up
            </button>
          )}
        </div>
      </nav>

      <Outlet context={{ openAuth: () => setShowAuth(true) }} />

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </div>
  )
}
