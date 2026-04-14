import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

export default function BookingHistoryPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(null)

  useEffect(() => {
    if (!user) { navigate('/'); return }
    fetchBookings()
  }, [user])

  const fetchBookings = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('bookings')
      .select(`*, rooms(name, room_number, room_type), payments(amount, payment_method, payment_type, status, transaction_id, created_at)`)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (!error) setBookings(data || [])
    setLoading(false)
  }

  const handleCancel = async (bookingId, roomId) => {
    setCancelling(bookingId)
    try {
      await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', bookingId)
      
      // Check if there are any other confirmed bookings for this room
      const { data: otherBookings } = await supabase
        .from('bookings')
        .select('id')
        .eq('room_id', roomId)
        .in('status', ['confirmed', 'pending'])
        .neq('id', bookingId)
      
      // If no other bookings, mark room as available
      if (!otherBookings || otherBookings.length === 0) {
        await supabase.from('rooms').update({ is_available: true }).eq('id', roomId)
      }
      
      fetchBookings()
    } catch (err) {
      console.error('Cancel booking error:', err)
    } finally {
      setCancelling(null)
    }
  }

  const statusColor = { confirmed: 'badge-success', cancelled: 'badge-danger', pending: 'badge-warning' }

  return (
    <div style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', marginBottom: '8px' }}>My Bookings</h1>
        <p>Your complete booking and payment history</p>
      </div>

      {loading ? (
        <div className="loading-center"><div className="spinner"></div></div>
      ) : bookings.length === 0 ? (
        <div className="empty-state card card-body">
          <div className="empty-icon">📋</div>
          <h3>No bookings yet</h3>
          <p className="empty-text">You haven't made any bookings. Go browse our rooms!</p>
          <button className="btn btn-primary" style={{ marginTop: '16px' }} onClick={() => navigate('/')}>Browse Rooms</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {bookings.map(b => (
            <div key={b.id} className="card card-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem' }}>{b.rooms?.name}</h3>
                    <span className={`badge ${statusColor[b.status] || 'badge-info'}`}>{b.status}</span>
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                    <span>🏨 Room {b.rooms?.room_number}</span>
                    <span>📅 {b.booking_date}</span>
                    <span>⏰ {b.start_time} – {b.end_time}</span>
                    <span>🕐 {b.total_hours} hr{b.total_hours > 1 ? 's' : ''}</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', color: 'var(--primary)', fontWeight: '700' }}>₹{b.total_amount}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Booking #{b.id.slice(0, 8).toUpperCase()}</div>
                </div>
              </div>

              {b.payments && b.payments.length > 0 && (
                <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)', display: 'flex', gap: '24px', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                    {b.payments.map((p, i) => (
                      <div key={i} style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        <span className={`badge ${p.status === 'completed' ? 'badge-success' : 'badge-warning'}`} style={{ marginRight: '8px' }}>
                          {p.status === 'completed' ? '✓ Paid' : p.status}
                        </span>
                        {p.payment_method?.toUpperCase()} · {p.payment_type === 'recurring' ? '🔄 Recurring' : '💳 One-time'} · TXN: {p.transaction_id}
                      </div>
                    ))}
                  </div>
                  {b.status === 'confirmed' && (
                    <button 
                      className="btn btn-sm btn-danger" 
                      onClick={() => handleCancel(b.id, b.room_id)}
                      disabled={cancelling === b.id}
                    >
                      {cancelling === b.id ? 'Cancelling...' : 'Cancel Booking'}
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
