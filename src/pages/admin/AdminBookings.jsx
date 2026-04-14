import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function AdminBookings() {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterDate, setFilterDate] = useState('')

  useEffect(() => {
    fetchBookings()
    const channel = supabase
      .channel('admin-bookings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => fetchBookings())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  const fetchBookings = async () => {
    setLoading(true)
    try {
      // Get all bookings with related data
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select('*, rooms(name, room_number, room_type)')
        .order('created_at', { ascending: false })

      // Fetch profiles separately
      if (bookingsData && bookingsData.length > 0) {
        const userIds = bookingsData.map(b => b.user_id)
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

        // Fetch payments separately
        const bookingIds = bookingsData.map(b => b.id)
        const { data: paymentsData, error: paymentsError } = await supabase
          .from('payments')
          .select('id, booking_id, amount, payment_method, payment_type, status, transaction_id')
          .in('booking_id', bookingIds)

        if (paymentsError) throw paymentsError

        // Map payments to bookings
        const paymentsMap = {}
        if (paymentsData) {
          paymentsData.forEach(p => {
            if (!paymentsMap[p.booking_id]) {
              paymentsMap[p.booking_id] = []
            }
            paymentsMap[p.booking_id].push(p)
          })
        }

        // Attach profiles and payments to bookings
        const enrichedBookings = bookingsData.map(b => ({
          ...b,
          profiles: profileMap[b.user_id] || null,
          payments: paymentsMap[b.id] || []
        }))

        setBookings(enrichedBookings)
      } else {
        setBookings(bookingsData || [])
      }
    } catch (err) {
      console.error('Bookings fetch error:', err)
      setBookings([])
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = async (id) => {
    await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', id)
    
    // Check if there are any other confirmed bookings for this room
    const booking = bookings.find(b => b.id === id)
    if (booking) {
      const { data: otherBookings } = await supabase
        .from('bookings')
        .select('id')
        .eq('room_id', booking.room_id)
        .in('status', ['confirmed', 'pending'])
        .neq('id', id)
      
      // If no other bookings, mark room as available
      if (!otherBookings || otherBookings.length === 0) {
        await supabase.from('rooms').update({ is_available: true }).eq('id', booking.room_id)
      }
    }
    
    fetchBookings()
  }

  const filtered = bookings
    .filter(b => filterStatus === 'all' || b.status === filterStatus)
    .filter(b => !filterDate || b.booking_date === filterDate)
    .filter(b => {
      if (!search) return true
      const s = search.toLowerCase()
      return (
        b.profiles?.full_name?.toLowerCase().includes(s) ||
        b.profiles?.email?.toLowerCase().includes(s) ||
        b.rooms?.name?.toLowerCase().includes(s) ||
        String(b.rooms?.room_number).includes(s) ||
        b.id.toLowerCase().includes(s)
      )
    })

  const statusColor = { confirmed: 'badge-success', cancelled: 'badge-danger', pending: 'badge-warning' }

  return (
    <div>
      <div className="admin-page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 className="admin-page-title">All Bookings</h1>
            <p className="admin-page-sub">View and manage all customer bookings</p>
          </div>
          <button className="btn btn-outline btn-sm" onClick={fetchBookings}>🔄 Refresh</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px', alignItems: 'center' }}>
        <input className="form-input" style={{ maxWidth: '280px' }} placeholder="🔍 Search by guest, room, booking ID..."
          value={search} onChange={e => setSearch(e.target.value)} />
        <input type="date" className="form-input" style={{ maxWidth: '180px' }} value={filterDate} onChange={e => setFilterDate(e.target.value)} />
        <div style={{ display: 'flex', gap: '6px' }}>
          {['all', 'confirmed', 'pending', 'cancelled'].map(s => (
            <button key={s} className={`filter-chip ${filterStatus === s ? 'active' : ''}`} onClick={() => setFilterStatus(s)}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        {filterDate && <button className="btn btn-sm btn-outline" onClick={() => setFilterDate('')}>Clear Date</button>}
      </div>

      <div style={{ marginBottom: '12px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        Showing {filtered.length} of {bookings.length} bookings
      </div>

      {loading ? (
        <div className="loading-center"><div className="spinner"></div></div>
      ) : (
        <div className="table-wrap">
          <table className="booking-table">
            <thead>
              <tr>
                <th>Booking ID</th><th>Guest</th><th>Room</th><th>Date</th>
                <th>Time Slot</th><th>Duration</th><th>Amount</th><th>Payment</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan="10" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>No bookings found</td></tr>
              ) : filtered.map(b => (
                <tr key={b.id}>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>#{b.id.slice(0, 8).toUpperCase()}</td>
                  <td>
                    <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>{b.profiles?.full_name || '—'}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{b.profiles?.email || '—'}</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: '600' }}>Room {b.rooms?.room_number}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{b.rooms?.name}</div>
                  </td>
                  <td>{b.booking_date}</td>
                  <td>{b.start_time} – {b.end_time}</td>
                  <td>{b.total_hours} hr{b.total_hours > 1 ? 's' : ''}</td>
                  <td><strong>₹{b.total_amount}</strong></td>
                  <td>
                    {b.payments && b.payments.length > 0 ? (
                      <div style={{ fontSize: '0.78rem' }}>
                        {b.payments.map((p, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: i < b.payments.length - 1 ? '4px' : '0' }}>
                            <span className={`badge ${p.status === 'completed' ? 'badge-success' : 'badge-warning'}`} style={{ minWidth: '70px', textAlign: 'center' }}>
                              {p.status}
                            </span>
                            <span style={{ color: 'var(--text-muted)' }}>{p.payment_method?.toUpperCase()}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>—</span>
                    )}
                  </td>
                  <td><span className={`badge ${statusColor[b.status] || 'badge-info'}`}>{b.status}</span></td>
                  <td>
                    {b.status === 'confirmed' && (
                      <button className="btn btn-sm btn-danger" onClick={() => handleCancel(b.id)}>Cancel</button>
                    )}
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
