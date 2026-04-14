import { useState, useEffect } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import RoomCard from '../../components/RoomCard'
import BookingModal from '../../components/BookingModal'

const AMENITY_ICONS = { ac: '❄️', tv: '📺', wifi: '📶', minibar: '🍷', balcony: '🌅', bathtub: '🛁', safe: '🔒', gym: '💪' }

export default function HomePage() {
  const { openAuth } = useOutletContext()
  const { user } = useAuth()

  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedRoom, setSelectedRoom] = useState(null)
  const [showBooking, setShowBooking] = useState(false)
  const [roomBookings, setRoomBookings] = useState({}) // Track bookings per room

  // Filters
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterType, setFilterType] = useState('all')
  const [filterAmenity, setFilterAmenity] = useState('all')
  const [sortBy, setSortBy] = useState('room_number')

  useEffect(() => { fetchRooms() }, [])

  const fetchRooms = async () => {
    setLoading(true)
    try {
      // Fetch all rooms
      const { data: roomsData, error: roomsError } = await supabase
        .from('rooms')
        .select('*')
        .order('room_number')
      
      if (roomsError) throw roomsError

      // Fetch all confirmed and pending bookings
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select('room_id')
        .in('status', ['confirmed', 'pending'])

      if (bookingsError) throw bookingsError

      // Create a map of room_id -> booking count
      const bookingMap = {}
      if (bookingsData) {
        bookingsData.forEach(b => {
          bookingMap[b.room_id] = (bookingMap[b.room_id] || 0) + 1
        })
      }

      setRoomBookings(bookingMap)
      setRooms((roomsData || []).map(room => ({
        ...room,
        is_available: !(bookingMap[room.id] > 0)
      })))
    } catch (err) {
      console.error('Error fetching rooms:', err)
    } finally {
      setLoading(false)
    }
  }

  const isRoomOccupied = (roomId) => {
    // A room is occupied if it has any confirmed or pending bookings
    return (roomBookings[roomId] || 0) > 0
  }

  const handleBookClick = (room) => {
    if (!user) {
      openAuth()
      return
    }
    setSelectedRoom(room)
    setShowBooking(true)
  }

  const filteredRooms = rooms
    .filter(r => {
      if (filterStatus === 'available') return !isRoomOccupied(r.id)
      if (filterStatus === 'occupied') return isRoomOccupied(r.id)
      return true
    })
    .filter(r => filterType === 'all' || r.room_type === filterType)
    .filter(r => filterAmenity === 'all' || (r.amenities && r.amenities.includes(filterAmenity)))
    .sort((a, b) => {
      if (sortBy === 'price_asc') return a.price_per_hour - b.price_per_hour
      if (sortBy === 'price_desc') return b.price_per_hour - a.price_per_hour
      return a.room_number - b.room_number
    })

  return (
    <div>
      {/* Hero */}
      <div className="hero">
        <div className="hero-content">
          <h1>Find Your Perfect <span>Room</span></h1>
          <p>Browse our collection of premium rooms. Book by the hour with instant confirmation and secure payment.</p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <div style={{ background: 'rgba(255,255,255,0.1)', padding: '10px 20px', borderRadius: '100px', color: 'rgba(255,255,255,0.9)', fontSize: '0.85rem' }}>
              🏨 50 Premium Rooms
            </div>
            <div style={{ background: 'rgba(255,255,255,0.1)', padding: '10px 20px', borderRadius: '100px', color: 'rgba(255,255,255,0.9)', fontSize: '0.85rem' }}>
              ⚡ Instant Booking
            </div>
            <div style={{ background: 'rgba(255,255,255,0.1)', padding: '10px 20px', borderRadius: '100px', color: 'rgba(255,255,255,0.9)', fontSize: '0.85rem' }}>
              🔒 Secure Payment
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <div className="filter-group">
          <span className="filter-label">Status:</span>
          {['all', 'available', 'occupied'].map(s => (
            <button key={s} className={`filter-chip ${filterStatus === s ? 'active' : ''}`} onClick={() => setFilterStatus(s)}>
              {s === 'all' ? 'All Rooms' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        <div className="filter-group">
          <span className="filter-label">Type:</span>
          {['all', 'single', 'double', 'suite', 'deluxe'].map(t => (
            <button key={t} className={`filter-chip ${filterType === t ? 'active' : ''}`} onClick={() => setFilterType(t)}>
              {t === 'all' ? 'All Types' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        <div className="filter-group">
          <span className="filter-label">Amenity:</span>
          <select className="filter-select" value={filterAmenity} onChange={e => setFilterAmenity(e.target.value)}>
            <option value="all">All Amenities</option>
            <option value="ac">AC</option>
            <option value="tv">TV</option>
            <option value="wifi">WiFi</option>
            <option value="balcony">Balcony</option>
            <option value="bathtub">Bathtub</option>
            <option value="minibar">Minibar</option>
          </select>
        </div>

        <div className="filter-group" style={{ marginLeft: 'auto' }}>
          <span className="filter-label">Sort:</span>
          <select className="filter-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="room_number">Room Number</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
          </select>
        </div>
      </div>

      {/* Rooms */}
      <div className="rooms-section page-container">
        <div className="section-header">
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem' }}>
            {filterStatus === 'available' ? 'Available Rooms' : filterStatus === 'occupied' ? 'Occupied Rooms' : 'All Rooms'}
          </h2>
          <span className="section-count">{filteredRooms.length} room{filteredRooms.length !== 1 ? 's' : ''} found</span>
        </div>

        {loading ? (
          <div className="loading-center">
            <div className="spinner"></div>
            <span className="loading-text">Loading rooms...</span>
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🏨</div>
            <h3>No rooms found</h3>
            <p className="empty-text">Try adjusting your filters to see more results.</p>
          </div>
        ) : (
          <div className="rooms-grid">
            {filteredRooms.map(room => (
              <RoomCard key={room.id} room={room} onBook={() => handleBookClick(room)} />
            ))}
          </div>
        )}
      </div>

      {showBooking && selectedRoom && (
        <BookingModal
          room={selectedRoom}
          onClose={() => { setShowBooking(false); setSelectedRoom(null) }}
          onSuccess={() => { setShowBooking(false); setSelectedRoom(null); fetchRooms() }}
        />
      )}
    </div>
  )
}
