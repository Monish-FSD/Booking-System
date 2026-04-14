import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const ALL_AMENITIES = [
  { key: 'ac', label: '❄️ AC' },
  { key: 'tv', label: '📺 TV' },
  { key: 'wifi', label: '📶 WiFi' },
  { key: 'minibar', label: '🍷 Minibar' },
  { key: 'balcony', label: '🌅 Balcony' },
  { key: 'bathtub', label: '🛁 Bathtub' },
  { key: 'safe', label: '🔒 Safe' },
  { key: 'gym', label: '💪 Gym Access' },
]

const EMPTY_FORM = {
  room_number: '', name: '', room_type: 'single', price_per_hour: '',
  amenities: [], description: '', is_available: true, max_occupancy: 1
}

export default function AdminRooms() {
  const [rooms, setRooms] = useState([])
  const [roomBookings, setRoomBookings] = useState({}) // Track which rooms have bookings
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editRoom, setEditRoom] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [search, setSearch] = useState('')

  useEffect(() => { fetchRooms() }, [])

  const fetchRooms = async () => {
    setLoading(true)
    try {
      // Fetch all rooms
      const { data: roomsData } = await supabase.from('rooms').select('*').order('room_number')
      setRooms(roomsData || [])

      // Fetch all confirmed and pending bookings to determine occupancy
      const { data: bookingsData } = await supabase
        .from('bookings')
        .select('room_id')
        .in('status', ['confirmed', 'pending'])

      // Create map of room_id -> booking count
      const bookingMap = {}
      if (bookingsData) {
        bookingsData.forEach(b => {
          bookingMap[b.room_id] = (bookingMap[b.room_id] || 0) + 1
        })
      }
      setRoomBookings(bookingMap)
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

  const openAdd = () => { setEditRoom(null); setForm(EMPTY_FORM); setError(''); setShowForm(true) }
  const openEdit = (room) => {
    setEditRoom(room)
    setForm({ ...room, amenities: room.amenities || [] })
    setError('')
    setShowForm(true)
  }

  const handleAmenityToggle = (key) => {
    setForm(prev => ({
      ...prev,
      amenities: prev.amenities.includes(key)
        ? prev.amenities.filter(a => a !== key)
        : [...prev.amenities, key]
    }))
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const payload = {
        room_number: Number(form.room_number),
        name: form.name,
        room_type: form.room_type,
        price_per_hour: Number(form.price_per_hour),
        amenities: form.amenities,
        description: form.description,
        is_available: form.is_available,
        max_occupancy: Number(form.max_occupancy),
      }

      if (editRoom) {
        const { error } = await supabase.from('rooms').update(payload).eq('id', editRoom.id)
        if (error) throw error
        setSuccess('Room updated successfully!')
      } else {
        const { error } = await supabase.from('rooms').insert(payload)
        if (error) throw error
        setSuccess('Room added successfully!')
      }

      setShowForm(false)
      fetchRooms()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err.message || 'Failed to save room')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    const { error } = await supabase.from('rooms').delete().eq('id', id)
    if (!error) { fetchRooms(); setSuccess('Room deleted.'); setTimeout(() => setSuccess(''), 3000) }
    setDeleteConfirm(null)
  }

  const handleToggleAvailability = async (room) => {
    await supabase.from('rooms').update({ is_available: !room.is_available }).eq('id', room.id)
    fetchRooms()
  }

  const filtered = rooms.filter(r =>
    r.name?.toLowerCase().includes(search.toLowerCase()) ||
    String(r.room_number).includes(search) ||
    r.room_type?.includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="admin-page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 className="admin-page-title">Manage Rooms</h1>
            <p className="admin-page-sub">{rooms.length} total rooms · {rooms.filter(r => !isRoomOccupied(r.id)).length} available</p>
          </div>
          <button className="btn btn-accent" onClick={openAdd}>+ Add New Room</button>
        </div>
      </div>

      {success && <div className="alert alert-success">{success}</div>}

      {/* Search */}
      <div style={{ marginBottom: '20px' }}>
        <input className="form-input" style={{ maxWidth: '320px' }} placeholder="🔍 Search rooms..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="loading-center"><div className="spinner"></div></div>
      ) : (
        <div className="table-wrap">
          <table className="booking-table">
            <thead>
              <tr>
                <th>Room #</th>
                <th>Name</th>
                <th>Type</th>
                <th>Amenities</th>
                <th>Price/hr</th>
                <th>Max Occ.</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan="8" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px' }}>No rooms found</td></tr>
              ) : filtered.map(room => (
                <tr key={room.id}>
                  <td><strong>{room.room_number}</strong></td>
                  <td>{room.name}</td>
                  <td style={{ textTransform: 'capitalize' }}>{room.room_type}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {(room.amenities || []).slice(0, 3).map(a => (
                        <span key={a} className="amenity-tag">{ALL_AMENITIES.find(x => x.key === a)?.label || a}</span>
                      ))}
                      {(room.amenities || []).length > 3 && <span className="amenity-tag">+{room.amenities.length - 3}</span>}
                    </div>
                  </td>
                  <td><strong>₹{room.price_per_hour}</strong></td>
                  <td>{room.max_occupancy} pax</td>
                  <td>
                    <span className={`badge ${isRoomOccupied(room.id) ? 'badge-danger' : 'badge-success'}`}>
                      {isRoomOccupied(room.id) ? 'Occupied' : 'Available'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button className="btn btn-sm btn-outline" onClick={() => openEdit(room)}>Edit</button>
                                          <button
        className="btn btn-sm"
        style={{
          background: isRoomOccupied(room.id) ? 'var(--success-bg)' : 'var(--warning-bg)',
          color: isRoomOccupied(room.id) ? 'var(--success)' : 'var(--warning)',
          border: 'none'
        }}
        onClick={() => handleToggleAvailability(room)}
      >
        {isRoomOccupied(room.id) ? 'Set Available' : 'Set Occupied'}
      </button>
                      <button className="btn btn-sm btn-danger" onClick={() => setDeleteConfirm(room.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Room Form Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowForm(false) }}>
          <div className="modal" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">{editRoom ? 'Edit Room' : 'Add New Room'}</h2>
                <p className="modal-subtitle">{editRoom ? `Editing Room ${editRoom.room_number}` : 'Fill in the room details'}</p>
              </div>
              <button className="modal-close" onClick={() => setShowForm(false)}>×</button>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-error">{error}</div>}
              <form onSubmit={handleSave}>
                <div className="room-form-grid" style={{ marginBottom: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Room Number *</label>
                    <input className="form-input" type="number" required value={form.room_number}
                      onChange={e => setForm(p => ({ ...p, room_number: e.target.value }))} placeholder="e.g. 101" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Room Name *</label>
                    <input className="form-input" required value={form.name}
                      onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Deluxe King Suite" />
                  </div>
                </div>

                <div className="room-form-grid" style={{ marginBottom: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Room Type *</label>
                    <select className="form-select" value={form.room_type} onChange={e => setForm(p => ({ ...p, room_type: e.target.value }))}>
                      <option value="single">Single Bed</option>
                      <option value="double">Double Bed</option>
                      <option value="suite">Suite</option>
                      <option value="deluxe">Deluxe</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Price Per Hour (₹) *</label>
                    <input className="form-input" type="number" required min="1" value={form.price_per_hour}
                      onChange={e => setForm(p => ({ ...p, price_per_hour: e.target.value }))} placeholder="e.g. 500" />
                  </div>
                </div>

                <div className="room-form-grid" style={{ marginBottom: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Max Occupancy</label>
                    <input className="form-input" type="number" min="1" max="10" value={form.max_occupancy}
                      onChange={e => setForm(p => ({ ...p, max_occupancy: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Availability</label>
                    <select className="form-select" value={form.is_available ? 'true' : 'false'}
                      onChange={e => setForm(p => ({ ...p, is_available: e.target.value === 'true' }))}>
                      <option value="true">Available</option>
                      <option value="false">Occupied / Maintenance</option>
                    </select>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label">Description</label>
                  <input className="form-input" value={form.description}
                    onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Brief room description..." />
                </div>

                <div style={{ marginBottom: '24px' }}>
                  <label className="form-label" style={{ marginBottom: '10px', display: 'block' }}>Amenities</label>
                  <div className="amenities-grid">
                    {ALL_AMENITIES.map(a => (
                      <div key={a.key} className={`amenity-check ${form.amenities.includes(a.key) ? 'checked' : ''}`}
                        onClick={() => handleAmenityToggle(a.key)}>
                        <input type="checkbox" readOnly checked={form.amenities.includes(a.key)} />
                        <span className="amenity-check-label">{a.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={saving}>
                    {saving ? 'Saving...' : editRoom ? 'Update Room' : 'Add Room'}
                  </button>
                  <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '400px' }}>
            <div className="modal-body" style={{ textAlign: 'center', padding: '40px 32px' }}>
              <div style={{ fontSize: '3rem', marginBottom: '16px' }}>⚠️</div>
              <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: '8px' }}>Delete Room?</h3>
              <p style={{ marginBottom: '24px' }}>This action cannot be undone. All booking history for this room will be affected.</p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button className="btn btn-danger" onClick={() => handleDelete(deleteConfirm)}>Yes, Delete</button>
                <button className="btn btn-outline" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
