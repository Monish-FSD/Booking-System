import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAdminAuth } from '../../hooks/useAdminAuth'

const NAV_ITEMS = [
  { path: '/admin', label: 'Dashboard', icon: '📊' },
  { path: '/admin/rooms', label: 'Manage Rooms', icon: '🏨' },
  { path: '/admin/bookings', label: 'All Bookings', icon: '📋' },
  { path: '/admin/payments', label: 'Payments & Revenue', icon: '💰' },
]

export default function AdminLayout() {
  const { adminLogout } = useAdminAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = () => {
    adminLogout()
    navigate('/admin/login')
  }

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', background: 'var(--accent)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>🏨</div>
            <div>
              <div className="admin-sidebar-brand">Stay<span>Ease</span></div>
              <div className="admin-sidebar-sub">Admin Panel</div>
            </div>
          </div>
        </div>

        <nav className="admin-nav">
          {NAV_ITEMS.map(item => (
            <button
              key={item.path}
              className={`admin-nav-item ${location.pathname === item.path ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              <span className="admin-nav-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div style={{ padding: '16px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <button className="admin-nav-item" onClick={handleLogout} style={{ width: '100%', color: '#ff8080' }}>
            <span className="admin-nav-icon">🚪</span>
            Logout
          </button>
          <div style={{ marginTop: '12px', fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>
            Logged in as admin@hotel.com
          </div>
        </div>
      </aside>

      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  )
}
