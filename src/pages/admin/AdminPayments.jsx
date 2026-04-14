import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function AdminPayments() {
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterMethod, setFilterMethod] = useState('all')
  const [filterType, setFilterType] = useState('all')
  const [summaryTab, setSummaryTab] = useState('today')
  const [summary, setSummary] = useState({ today: 0, month: 0, year: 0, total: 0, count: 0 })

  useEffect(() => {
    fetchAll()
    const channel = supabase
      .channel('admin-payments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => fetchAll())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  const fetchAll = async () => {
    setLoading(true)
    await Promise.all([fetchPayments(), fetchSummary()])
    setLoading(false)
  }

  const fetchPayments = async () => {
    const { data, error } = await supabase
      .from('payments')
      .select('*, bookings(booking_date, start_time, end_time, total_hours, rooms(name, room_number))')
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Payments fetch error:', error.message)
      return
    }

    // Fetch profiles separately and map them
    if (data && data.length > 0) {
      const userIds = data.map(p => p.user_id)
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds)

      // Create profile map
      const profileMap = {}
      if (profilesData) {
        profilesData.forEach(p => {
          profileMap[p.id] = p
        })
      }

      // Attach profiles to payments
      const enrichedPayments = data.map(payment => ({
        ...payment,
        profiles: profileMap[payment.user_id] || null
      }))

      setPayments(enrichedPayments)
    } else {
      setPayments(data || [])
    }
  }

  const fetchSummary = async () => {
    const today = new Date().toISOString().split('T')[0]
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
    const yearStart = `${new Date().getFullYear()}-01-01`

    const [allRes, todayRes, monthRes, yearRes] = await Promise.all([
      supabase.from('payments').select('amount').eq('status', 'completed'),
      supabase.from('payments').select('amount').eq('status', 'completed').gte('created_at', today),
      supabase.from('payments').select('amount').eq('status', 'completed').gte('created_at', monthStart),
      supabase.from('payments').select('amount').eq('status', 'completed').gte('created_at', yearStart),
    ])

    const sum = arr => (arr || []).reduce((s, p) => s + Number(p.amount), 0)
    setSummary({
      total: sum(allRes.data),
      today: sum(todayRes.data),
      month: sum(monthRes.data),
      year: sum(yearRes.data),
      count: (allRes.data || []).length
    })
  }

  const filtered = payments
    .filter(p => filterMethod === 'all' || p.payment_method === filterMethod)
    .filter(p => filterType === 'all' || p.payment_type === filterType)
    .filter(p => {
      if (!search) return true
      const s = search.toLowerCase()
      return (
        p.profiles?.full_name?.toLowerCase().includes(s) ||
        p.profiles?.email?.toLowerCase().includes(s) ||
        p.transaction_id?.toLowerCase().includes(s) ||
        p.bookings?.rooms?.name?.toLowerCase().includes(s)
      )
    })

  const summaryCards = [
    { key: 'today', label: "Today's Revenue", icon: '☀️', value: summary.today },
    { key: 'month', label: 'This Month', icon: '📅', value: summary.month },
    { key: 'year', label: 'This Year', icon: '📆', value: summary.year },
    { key: 'total', label: 'All Time', icon: '💎', value: summary.total },
  ]

  return (
    <div>
      <div className="admin-page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 className="admin-page-title">Payments & Revenue</h1>
            <p className="admin-page-sub">Track all transactions and revenue</p>
          </div>
          <button className="btn btn-outline btn-sm" onClick={fetchAll}>🔄 Refresh</button>
        </div>
      </div>

      <div className="stats-grid" style={{ marginBottom: '28px' }}>
        {summaryCards.map(c => (
          <div key={c.key} className="stat-card" style={{ cursor: 'pointer', border: summaryTab === c.key ? '2px solid var(--accent)' : '1px solid var(--border)' }}
            onClick={() => setSummaryTab(c.key)}>
            <div className="stat-icon">{c.icon}</div>
            <div className="stat-label">{c.label}</div>
            <div className="stat-value" style={{ fontSize: '1.6rem' }}>₹{c.value.toLocaleString()}</div>
          </div>
        ))}
        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-label">Total Transactions</div>
          <div className="stat-value">{summary.count}</div>
          <div className="stat-sub">Completed payments</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">💳</div>
          <div className="stat-label">Avg. Transaction</div>
          <div className="stat-value" style={{ fontSize: '1.6rem' }}>
            ₹{summary.count > 0 ? Math.round(summary.total / summary.count).toLocaleString() : 0}
          </div>
          <div className="stat-sub">Per booking</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px', alignItems: 'center' }}>
        <input className="form-input" style={{ maxWidth: '280px' }} placeholder="🔍 Search by guest, transaction ID..."
          value={search} onChange={e => setSearch(e.target.value)} />
        <div style={{ display: 'flex', gap: '6px' }}>
          {['all', 'card', 'upi', 'netbanking'].map(m => (
            <button key={m} className={`filter-chip ${filterMethod === m ? 'active' : ''}`} onClick={() => setFilterMethod(m)}>
              {m === 'all' ? 'All Methods' : m.toUpperCase()}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          {['all', 'one_time', 'recurring'].map(t => (
            <button key={t} className={`filter-chip ${filterType === t ? 'active' : ''}`} onClick={() => setFilterType(t)}>
              {t === 'all' ? 'All Types' : t === 'one_time' ? 'One-Time' : 'Recurring'}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: '12px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        {filtered.length} transaction{filtered.length !== 1 ? 's' : ''} · Total: ₹{filtered.reduce((s, p) => s + Number(p.amount), 0).toLocaleString()}
      </div>

      {loading ? (
        <div className="loading-center"><div className="spinner"></div></div>
      ) : (
        <div className="table-wrap">
          <table className="booking-table">
            <thead>
              <tr>
                <th>Transaction ID</th><th>Guest</th><th>Room</th><th>Date & Time</th>
                <th>Method</th><th>Type</th><th>Amount</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan="8" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>No payments found</td></tr>
              ) : filtered.map(p => (
                <tr key={p.id}>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{p.transaction_id || '—'}</td>
                  <td>
                    <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>{p.profiles?.full_name || '—'}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.profiles?.email || '—'}</div>
                  </td>
                  <td>
                    <div>{p.bookings?.rooms?.name || '—'}</div>
                    {p.bookings?.booking_date && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {p.bookings.booking_date} · {p.bookings.start_time}–{p.bookings.end_time}
                      </div>
                    )}
                  </td>
                  <td style={{ fontSize: '0.82rem' }}>
                    {new Date(p.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                      {new Date(p.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </td>
                  <td>
                    <span className="badge badge-info">
                      {p.payment_method === 'card' ? '💳 Card' : p.payment_method === 'upi' ? '📱 UPI' : '🏦 Net Banking'}
                    </span>
                    {p.card_last4 && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>••••{p.card_last4}</div>}
                  </td>
                  <td>
                    <span className={`badge ${p.payment_type === 'recurring' ? 'badge-warning' : 'badge-info'}`}>
                      {p.payment_type === 'recurring' ? '🔄 Recurring' : '💳 One-Time'}
                    </span>
                  </td>
                  <td><strong style={{ color: 'var(--success)', fontSize: '1rem' }}>₹{Number(p.amount).toLocaleString()}</strong></td>
                  <td>
                    <span className={`badge ${p.status === 'completed' ? 'badge-success' : p.status === 'failed' ? 'badge-danger' : 'badge-warning'}`}>
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
