import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function AdminDashboard() {
  const [stats, setStats] = useState({ totalRooms: 0, availableRooms: 0, occupiedRooms: 0, totalBookings: 0, totalRevenue: 0, todayRevenue: 0, monthRevenue: 0 })
  const [revenueTab, setRevenueTab] = useState('monthly')
  const [revenueData, setRevenueData] = useState([])
  const [recentBookings, setRecentBookings] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchAll() }, [])
  useEffect(() => { fetchRevenueChart() }, [revenueTab])

  const fetchAll = async () => {
    setLoading(true)
    await Promise.all([fetchStats(), fetchRecentBookings(), fetchRevenueChart()])
    setLoading(false)
  }

  const fetchStats = async () => {
    const today = new Date().toISOString().split('T')[0]
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]

    const [roomsRes, bookingsRes, paymentsRes, todayRes, monthRes] = await Promise.all([
      supabase.from('rooms').select('id'),
      supabase.from('bookings').select('id, room_id, status', { count: 'exact' }),
      supabase.from('payments').select('amount').eq('status', 'completed'),
      supabase.from('payments').select('amount').eq('status', 'completed').gte('created_at', today),
      supabase.from('payments').select('amount').eq('status', 'completed').gte('created_at', monthStart),
    ])

    const rooms = roomsRes.data || []
    const bookings = bookingsRes.data || []
    const payments = paymentsRes.data || []
    const todayPayments = todayRes.data || []
    const monthPayments = monthRes.data || []

    const activeRoomIds = new Set(
      bookings
        .filter(b => b.status === 'confirmed' || b.status === 'pending')
        .map(b => b.room_id)
    )

    setStats({
      totalRooms: rooms.length,
      availableRooms: Math.max(rooms.length - activeRoomIds.size, 0),
      occupiedRooms: activeRoomIds.size,
      totalBookings: bookingsRes.count || 0,
      totalRevenue: payments.reduce((s, p) => s + Number(p.amount), 0),
      todayRevenue: todayPayments.reduce((s, p) => s + Number(p.amount), 0),
      monthRevenue: monthPayments.reduce((s, p) => s + Number(p.amount), 0),
    })
  }
  //Recent bookings limit 10 
  const fetchRecentBookings = async () => {
    const { data: bookingData, error: bookingError } = await supabase
      .from('bookings')
      .select('*, rooms(name, room_number), payments(amount, payment_method, payment_type, status, transaction_id, created_at)')
      .order('created_at', { ascending: false })
      .limit(10) //limit = 10

    if (bookingError) {
      console.error('Recent bookings fetch error:', bookingError)
      setRecentBookings([])
      return
    }

    const bookings = bookingData || []
    const userIds = [...new Set(bookings.map(b => b.user_id).filter(Boolean))]
    let profileMap = {}

    if (userIds.length > 0) {
      const { data: profilesData, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds)

      if (profileError) {
        console.error('Profiles fetch error for recent bookings:', profileError)
      } else if (profilesData) {
        profileMap = profilesData.reduce((acc, profile) => {
          acc[profile.id] = profile
          return acc
        }, {})
      }
    }

    const enrichedBookings = bookings.map(b => ({
      ...b,
      profiles: profileMap[b.user_id] || null,
    }))

    setRecentBookings(enrichedBookings)
  }

  const fetchRevenueChart = async () => {
    const now = new Date()

    if (revenueTab === 'daily') {
      // Last 7 days
      const days = []
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now)
        d.setDate(d.getDate() - i)
        const dateStr = d.toISOString().split('T')[0]
        const nextD = new Date(d)
        nextD.setDate(nextD.getDate() + 1)
        const { data } = await supabase.from('payments').select('amount').eq('status', 'completed')
          .gte('created_at', dateStr).lt('created_at', nextD.toISOString().split('T')[0])
        const total = (data || []).reduce((s, p) => s + Number(p.amount), 0)
        days.push({ label: d.toLocaleDateString('en', { weekday: 'short' }), value: total })
      }
      setRevenueData(days)
    } else if (revenueTab === 'monthly') {
      // Last 6 months
      const months = []
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const start = d.toISOString().split('T')[0]
        const end = new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString().split('T')[0]
        const { data } = await supabase.from('payments').select('amount').eq('status', 'completed')
          .gte('created_at', start).lt('created_at', end)
        const total = (data || []).reduce((s, p) => s + Number(p.amount), 0)
        months.push({ label: d.toLocaleDateString('en', { month: 'short' }), value: total })
      }
      setRevenueData(months)
    } else {
      // Last 5 years
      const years = []
      for (let i = 4; i >= 0; i--) {
        const yr = now.getFullYear() - i
        const { data } = await supabase.from('payments').select('amount').eq('status', 'completed')
          .gte('created_at', `${yr}-01-01`).lt('created_at', `${yr + 1}-01-01`)
        const total = (data || []).reduce((s, p) => s + Number(p.amount), 0)
        years.push({ label: String(yr), value: total })
      }
      setRevenueData(years)
    }
  }

  const maxRevenue = Math.max(...revenueData.map(d => d.value), 1)

  const statCards = [
    { icon: '🏨', label: 'Total Rooms', value: stats.totalRooms, sub: `${stats.availableRooms} available` },
    { icon: '📋', label: 'Total Bookings', value: stats.totalBookings, sub: 'All time' },
    { icon: '💰', label: "Today's Revenue", value: `₹${stats.todayRevenue.toLocaleString()}`, sub: 'Payments received today' },
    { icon: '📅', label: 'This Month', value: `₹${stats.monthRevenue.toLocaleString()}`, sub: 'Month to date' },
    { icon: '💎', label: 'Total Revenue', value: `₹${stats.totalRevenue.toLocaleString()}`, sub: 'All time earnings' },
    { icon: '🔴', label: 'Occupied Rooms', value: stats.occupiedRooms || 0, sub: 'Currently booked' },
  ]

  if (loading) return <div className="loading-center"><div className="spinner"></div></div>

  return (
    <div>
      <div className="admin-page-header">
        <h1 className="admin-page-title">Dashboard</h1>
        <p className="admin-page-sub">Welcome back, Admin. Here's your hotel overview.</p>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        {statCards.map((s, i) => (
          <div key={i} className="stat-card">
            <div className="stat-icon">{s.icon}</div>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">{s.value}</div>
            <div className="stat-sub">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Revenue Chart */}
      <div className="card" style={{ marginBottom: '28px' }}>
        <div className="card-body">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontFamily: 'var(--font-display)' }}>Revenue Overview</h3>
            <div className="revenue-tabs">
              {['daily', 'monthly', 'yearly'].map(t => (
                <button key={t} className={`revenue-tab ${revenueTab === t ? 'active' : ''}`} onClick={() => setRevenueTab(t)}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="revenue-bar-chart">
            {revenueData.map((d, i) => (
              <div key={i} className="revenue-bar-wrap">
                <div className="revenue-bar-val">₹{d.value > 999 ? (d.value / 1000).toFixed(1) + 'k' : d.value}</div>
                <div className="revenue-bar" style={{ height: `${(d.value / maxRevenue) * 100}%` }}></div>
                <div className="revenue-bar-label">{d.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Bookings */}
      <div className="card">
        <div className="card-body" style={{ paddingBottom: '0' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: '20px' }}>Recent Bookings</h3>
        </div>
        <div className="table-wrap" style={{ boxShadow: 'none', border: 'none', borderRadius: '0' }}>
          <table className="booking-table">
            <thead>
              <tr>
                <th>Booking ID</th>
                <th>Guest</th>
                <th>Room</th>
                <th>Date</th>
                <th>Time</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentBookings.length === 0 ? (
                <tr><td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px' }}>No bookings yet</td></tr>
              ) : recentBookings.map(b => (
                <tr key={b.id}>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>#{b.id.slice(0, 8).toUpperCase()}</td>
                  <td>{b.profiles?.full_name || b.profiles?.email || '—'}</td>
                  <td>Room {b.rooms?.room_number} – {b.rooms?.name}</td>
                  <td>{b.booking_date}</td>
                  <td>{b.start_time} – {b.end_time}</td>
                  <td><strong>₹{b.total_amount}</strong></td>
                  <td><span className={`badge ${b.status === 'confirmed' ? 'badge-success' : b.status === 'cancelled' ? 'badge-danger' : 'badge-warning'}`}>{b.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
