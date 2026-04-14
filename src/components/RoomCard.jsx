const AMENITY_ICONS = {
  ac: { icon: '❄️', label: 'AC' },
  tv: { icon: '📺', label: 'TV' },
  wifi: { icon: '📶', label: 'WiFi' },
  minibar: { icon: '🍷', label: 'Minibar' },
  balcony: { icon: '🌅', label: 'Balcony' },
  bathtub: { icon: '🛁', label: 'Bathtub' },
  safe: { icon: '🔒', label: 'Safe' },
  gym: { icon: '💪', label: 'Gym Access' },
}

const TYPE_ICONS = {
  single: '🛏️',
  double: '🛋️',
  suite: '👑',
  deluxe: '✨',
}

const TYPE_LABELS = {
  single: 'Single Bed',
  double: 'Double Bed',
  suite: 'Suite',
  deluxe: 'Deluxe Room',
}

export default function RoomCard({ room, onBook }) {
  const amenities = room.amenities || []

  return (
    <div className={`room-card ${!room.is_available ? 'occupied' : ''}`}>
      <div className="room-image">
        <div className="room-image-overlay"></div>
        <div className="room-image-icon">{TYPE_ICONS[room.room_type] || '🏨'}</div>
        <div className="room-number">Room {room.room_number}</div>
        <div className="room-status-badge">
          <span className={`badge ${room.is_available ? 'badge-success' : 'badge-danger'}`}>
            {room.is_available ? '✓ Available' : '✗ Occupied'}
          </span>
        </div>
      </div>

      <div className="room-body">
        <h3 className="room-title">{room.name}</h3>
        <div className="room-type">{TYPE_LABELS[room.room_type] || room.room_type} · Floor {Math.ceil(room.room_number / 10)}</div>

        <div className="room-amenities">
          {amenities.slice(0, 5).map(key => (
            <span key={key} className="amenity-tag">
              {AMENITY_ICONS[key]?.icon} {AMENITY_ICONS[key]?.label || key}
            </span>
          ))}
          {amenities.length > 5 && (
            <span className="amenity-tag">+{amenities.length - 5} more</span>
          )}
        </div>

        <div className="room-footer">
          <div className="room-price">
            <div>
              <span className="room-price-amount">₹{room.price_per_hour}</span>
              <span className="room-price-unit"> / hour</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              ₹{room.price_per_hour * 24} / day
            </div>
          </div>

          <button
            className={`btn btn-sm ${room.is_available ? 'btn-primary' : 'btn-outline'}`}
            onClick={onBook}
            disabled={!room.is_available}
            style={!room.is_available ? { cursor: 'not-allowed', opacity: 0.5 } : {}}
          >
            {room.is_available ? 'Book Now' : 'Unavailable'}
          </button>
        </div>
      </div>
    </div>
  )
}
