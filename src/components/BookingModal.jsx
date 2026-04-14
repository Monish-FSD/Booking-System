import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const FULL_DAY_END = '23:59:59'
const PURPOSE_OPTIONS = ['Business', 'Leisure', 'Event', 'Meeting', 'Other']
const PAYMENT_METHODS = [
  { id: 'mock',       label: 'Mock Pay',    sub: 'Demo only',  icon: '💳' },
  { id: 'upi',        label: 'UPI',         sub: 'Simulated',  icon: '📱' },
  { id: 'netbanking', label: 'Net Banking', sub: 'Simulated',  icon: '🏦' },
  { id: 'card',       label: 'Card',        sub: 'Simulated',  icon: '🔥' },
]

const pad2 = n => String(n).padStart(2, '0')
const formatTimeValue = v => (v.length === 5 ? `${v}:00` : v)
const timeToSeconds = t => {
  const [h, m, s = '00'] = t.split(':').map(Number)
  return h * 3600 + m * 60 + s
}
const getDatesInRange = (start, end) => {
  const dates = []
  let cur = new Date(start)
  const last = new Date(end)
  while (cur <= last) {
    dates.push(cur.toISOString().split('T')[0])
    cur.setDate(cur.getDate() + 1)
  }
  return dates
}
const buildSegments = (startDate, startHour, endDate, endHour) => {
  const dates = getDatesInRange(startDate, endDate)
  return dates.flatMap(date => {
    const isFirst = date === startDate
    const isLast  = date === endDate
    const start   = isFirst ? startHour : '00:00'
    const end     = isLast  ? endHour   : FULL_DAY_END
    const secs    = timeToSeconds(formatTimeValue(start))
    const eSecs   = timeToSeconds(end === FULL_DAY_END ? end : formatTimeValue(end))
    const hrs     = (eSecs - secs) / 3600
    if (hrs <= 0) return []
    return [{ booking_date: date, start_time: formatTimeValue(start), end_time: end === FULL_DAY_END ? end : formatTimeValue(end), total_hours: hrs }]
  })
}
const fmtDT = (date, hour) => {
  const [y, m, d] = date.split('-')
  const [hh, mm] = hour.split(':')
  const h = parseInt(hh)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${d}-${m}-${y} ${pad2(h12)}:${mm} ${ampm}`
}
const txnId = () => 'TXN' + Date.now() + Math.random().toString(36).slice(2, 6).toUpperCase()

function Stepper({ current }) {
  const steps = ['Time', 'Details', 'Payment']
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '18px 24px 0' }}>
      {steps.map((label, i) => {
        const idx  = i + 1
        const done   = idx < current
        const active = idx === current
        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 26, height: 26, borderRadius: '50%',
                border: '2px solid',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, flexShrink: 0,
                background: done ? '#22c55e' : active ? '#4f46e5' : 'transparent',
                borderColor: done ? '#22c55e' : active ? '#4f46e5' : '#d1d5db',
                color: done || active ? '#fff' : '#9ca3af',
              }}>
                {done ? '✓' : idx}
              </div>
              <span style={{ fontSize: 14, fontWeight: active ? 600 : 400, color: active ? '#4f46e5' : done ? '#22c55e' : '#9ca3af' }}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div style={{ flex: 1, height: 2, background: done ? '#22c55e' : '#e5e7eb', margin: '0 10px' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', letterSpacing: '0.07em', marginBottom: 8, textTransform: 'uppercase' }}>
        {label}
      </div>
      {children}
    </div>
  )
}

function DateTimeInput({ date, onDate, minDate, time, onTime, displayStr }) {
  const [open, setOpen] = useState(false)
  const inputStyle = {
    width: '100%', boxSizing: 'border-box',
    border: '1.5px solid #e5e7eb', borderRadius: 10,
    padding: '11px 14px', fontSize: 14, color: '#111',
    outline: 'none', background: '#fafafa', fontFamily: 'inherit',
  }
  return (
    <div style={{ position: 'relative' }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          border: '1.5px solid #e5e7eb', borderRadius: 10,
          padding: '11px 14px', fontSize: 14, color: '#111',
          cursor: 'pointer', background: '#fafafa', userSelect: 'none',
        }}
      >
        <span>{displayStr}</span>
        <span style={{ color: '#9ca3af' }}>📅</span>
      </div>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 12,
          padding: 16, zIndex: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
        }}>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, color: '#6b7280', marginBottom: 4, display: 'block' }}>DATE</label>
            <input type="date" style={inputStyle} value={date} min={minDate} onChange={e => onDate(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: '#6b7280', marginBottom: 4, display: 'block' }}>TIME</label>
            <input type="time" style={inputStyle} value={time} onChange={e => onTime(e.target.value)} />
          </div>
          <button
            onClick={() => setOpen(false)}
            style={{
              marginTop: 10, padding: '8px 16px', fontSize: 13, borderRadius: 10,
              background: 'linear-gradient(135deg,#4f46e5,#6366f1)', color: '#fff',
              border: 'none', cursor: 'pointer', fontWeight: 700,
            }}
          >
            Done
          </button>
        </div>
      )}
    </div>
  )
}

function SummaryBox({ rows, total }) {
  return (
    <div style={{ background: '#f9fafb', borderRadius: 12, padding: '14px 16px', marginBottom: 18 }}>
      {rows.map(r => (
        <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
          <span style={{ color: '#6b7280', fontSize: 14 }}>{r.label}</span>
          <span style={{ fontWeight: 500, fontSize: 14, color: '#111' }}>{r.value}</span>
        </div>
      ))}
      <div style={{ height: 1, background: '#f0f0f0', margin: '8px 0' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
        <span style={{ color: '#6b7280', fontSize: 14 }}>Total</span>
        <span style={{ fontWeight: 700, fontSize: 14, color: '#111' }}>{total}</span>
      </div>
    </div>
  )
}

function Row({ label, value, bold, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
      <span style={{ color: '#6b7280', fontSize: 14 }}>{label}</span>
      <span style={{ fontWeight: bold ? 700 : 500, fontSize: 14, color: color || '#111' }}>{value}</span>
    </div>
  )
}

function Err({ children }) {
  return (
    <div style={{ background: '#fef2f2', color: '#dc2626', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 14 }}>
      {children}
    </div>
  )
}

export default function BookingModal({ room, onClose, onSuccess }) {
  const { user } = useAuth()
  const todayStr = new Date().toISOString().split('T')[0]
  const nowH = new Date()
  const defaultStartH = `${pad2(nowH.getHours())}:${pad2(nowH.getMinutes())}`
  const defaultEndH   = `${pad2((nowH.getHours() + 1) % 24)}:${pad2(nowH.getMinutes())}`

  const [step,      setStep]      = useState(1)
  const [startDate, setStartDate] = useState(todayStr)
  const [endDate,   setEndDate]   = useState(todayStr)
  const [startHour, setStartHour] = useState(defaultStartH)
  const [endHour,   setEndHour]   = useState(defaultEndH)
  const [guestName, setGuestName] = useState('')
  const [phone,     setPhone]     = useState('')
  const [purpose,   setPurpose]   = useState(PURPOSE_OPTIONS[0])
  const [payMethod, setPayMethod] = useState('mock')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [txn,       setTxn]       = useState('')
  const [bookingId, setBookingId] = useState(null)

  const segments   = useMemo(() => buildSegments(startDate, startHour, endDate, endHour), [startDate, startHour, endDate, endHour])
  const totalHours = segments.reduce((s, x) => s + x.total_hours, 0)
  const totalAmt   = Math.round(totalHours * room.price_per_hour)

  const handleTimeNext = () => {
    const start = new Date(`${startDate}T${startHour}`)
    const end   = new Date(`${endDate}T${endHour}`)
    if (start >= end) { setError('Check-out must be after check-in'); return }
    setError(''); setStep(2)
  }

  const handleDetailsNext = () => {
    if (!guestName.trim()) { setError('Enter guest name'); return }
    if (!/^\d{10}$/.test(phone.trim())) { setError('Enter a valid 10-digit phone number'); return }
    setError(''); setStep(3)
  }

  const handlePay = useCallback(async () => {
    setLoading(true); setError('')
    try {
      if (!user?.id) throw new Error('Login required')
      const dates = [...new Set(segments.map(s => s.booking_date))]
      const { data: existing, error: fetchErr } = await supabase
        .from('bookings')
        .select('booking_date,start_time,end_time')
        .eq('room_id', room.id)
        .in('booking_date', dates)
        .in('status', ['confirmed', 'pending'])
      if (fetchErr) throw fetchErr
      for (const seg of segments) {
        const sS = timeToSeconds(seg.start_time)
        const sE = timeToSeconds(seg.end_time)
        for (const c of (existing || []).filter(d => d.booking_date === seg.booking_date)) {
          const cS = timeToSeconds(c.start_time)
          const cE = timeToSeconds(c.end_time)
          if (sS < cE && sE > cS) throw new Error(`Slot already booked on ${seg.booking_date}`)
        }
      }
      await new Promise(r => setTimeout(r, 1500))
      const { data: bookings, error: bookErr } = await supabase
        .from('bookings')
        .insert(segments.map(s => ({
          user_id:      user.id,
          room_id:      room.id,
          ...s,
          total_amount: Math.round(s.total_hours * room.price_per_hour),
          status:       'confirmed',
          guest_name:   guestName,
          phone,
          purpose,
        })))
        .select()
      if (bookErr) throw bookErr
      await supabase.from('payments').insert(
        bookings.map(b => ({
          booking_id:     b.id,
          user_id:        user.id,
          amount:         b.total_amount,
          payment_method: payMethod,
          status:         'completed',
        }))
      )
      setBookingId(bookings[0].id)
      setTxn(txnId())
      setStep(4)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [user?.id, room, segments, guestName, phone, purpose, payMethod])

  useEffect(() => {
    if (step !== 4) return
    const t = setTimeout(() => onSuccess?.(), 3000)
    return () => clearTimeout(t)
  }, [step, onSuccess])

  const inputStyle = {
    width: '100%', boxSizing: 'border-box',
    border: '1.5px solid #e5e7eb', borderRadius: 10,
    padding: '11px 14px', fontSize: 14, color: '#111',
    outline: 'none', background: '#fafafa', fontFamily: 'inherit',
  }
  const primaryBtn = {
    width: '100%', padding: '13px', borderRadius: 12,
    background: 'linear-gradient(135deg,#4f46e5,#6366f1)',
    color: '#fff', fontWeight: 700, fontSize: 15,
    border: 'none', cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(79,70,229,0.35)',
  }
  const backBtn = {
    padding: '13px 20px', borderRadius: 12,
    background: '#f3f4f6', color: '#374151',
    fontWeight: 600, fontSize: 14,
    border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
  }
  const payBtn = {
    flex: 1, padding: '13px', borderRadius: 12,
    background: 'linear-gradient(135deg,#16a34a,#22c55e)',
    color: '#fff', fontWeight: 700, fontSize: 15,
    border: 'none', cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(22,163,74,0.35)',
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 16, backdropFilter: 'blur(2px)',
      }}
      onClick={e => { if (e.target === e.currentTarget && step !== 4) onClose() }}
    >
      <div style={{
        background: '#fff', borderRadius: 20, width: '100%', maxWidth: 440,
        boxShadow: '0 24px 60px rgba(0,0,0,0.18)', overflow: 'hidden',
      }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '20px 24px 0' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 17, color: '#111' }}>
              Room #{room.room_number} · {room.name}
            </div>
            <div style={{ color: '#4f46e5', fontWeight: 600, fontSize: 14, marginTop: 2 }}>
              ₹{room.price_per_hour}/hr
            </div>
          </div>
          {step !== 4 && (
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#9ca3af', padding: 4 }}
            >✕</button>
          )}
        </div>

        {/* Stepper */}
        {step <= 3 && <Stepper current={step} />}

        {/* Body */}
        <div style={{ padding: '20px 24px 24px' }}>

          {/* ── Step 1: Time ── */}
          {step === 1 && (
            <>
              <Field label="CHECK-IN DATE & TIME">
                <DateTimeInput
                  date={startDate} onDate={setStartDate} minDate={todayStr}
                  time={startHour} onTime={setStartHour}
                  displayStr={fmtDT(startDate, startHour)}
                />
              </Field>
              <Field label="CHECK-OUT DATE & TIME">
                <DateTimeInput
                  date={endDate} onDate={setEndDate} minDate={startDate}
                  time={endHour} onTime={setEndHour}
                  displayStr={fmtDT(endDate, endHour)}
                />
              </Field>
              {error && <Err>{error}</Err>}
              <SummaryBox
                rows={[
                  { label: 'Duration', value: `${totalHours} hrs` },
                  { label: 'Rate',     value: `₹${room.price_per_hour}/hr` },
                ]}
                total={`₹${totalAmt.toLocaleString('en-IN')}`}
              />
              <button style={primaryBtn} onClick={handleTimeNext}>Continue →</button>
            </>
          )}

          {/* ── Step 2: Details ── */}
          {step === 2 && (
            <>
              <Field label="GUEST NAME">
                <input style={inputStyle} placeholder="Full name" value={guestName} onChange={e => setGuestName(e.target.value)} />
              </Field>
              <Field label="PHONE NUMBER">
                <input style={inputStyle} placeholder="10-digit mobile number" value={phone} maxLength={10} onChange={e => setPhone(e.target.value.replace(/\D/g, ''))} />
              </Field>
              <Field label="PURPOSE OF STAY">
                <select style={{ ...inputStyle, appearance: 'auto' }} value={purpose} onChange={e => setPurpose(e.target.value)}>
                  {PURPOSE_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </select>
              </Field>
              {error && <Err>{error}</Err>}
              <SummaryBox
                rows={[{ label: `Room #${room.room_number}`, value: `${totalHours} hrs` }]}
                total={`₹${totalAmt.toLocaleString('en-IN')}`}
              />
              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <button style={backBtn} onClick={() => { setError(''); setStep(1) }}>← Back</button>
                <button style={{ ...primaryBtn, flex: 1 }} onClick={handleDetailsNext}>Continue →</button>
              </div>
            </>
          )}

          {/* ── Step 3: Payment ── */}
          {step === 3 && (
            <>
              <div style={{ background: '#f9fafb', borderRadius: 12, padding: '14px 16px', marginBottom: 20 }}>
                <Row label="Guest"  value={guestName} />
                <Row label={`Room #${room.room_number}`} value={`${totalHours} hrs`} />
                <div style={{ height: 1, background: '#f0f0f0', margin: '8px 0' }} />
                <Row label="Amount Due" value={`₹${totalAmt.toLocaleString('en-IN')}`} bold />
              </div>

              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', letterSpacing: '0.07em', marginBottom: 8, textTransform: 'uppercase' }}>
                  PAYMENT METHOD
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {PAYMENT_METHODS.map(m => (
                    <button
                      key={m.id}
                      onClick={() => setPayMethod(m.id)}
                      style={{
                        border: payMethod === m.id ? '2px solid #4f46e5' : '1.5px solid #e5e7eb',
                        borderRadius: 12, padding: '14px 12px',
                        background: payMethod === m.id ? '#eef2ff' : '#fafafa',
                        cursor: 'pointer', textAlign: 'center',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                      }}
                    >
                      <div style={{ fontSize: 22 }}>{m.icon}</div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{m.label}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>{m.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              <p style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', marginBottom: 16 }}>
                🔒 Demo mode — no real charges will be made
              </p>

              {error && <Err>{error}</Err>}

              <div style={{ display: 'flex', gap: 12 }}>
                <button style={backBtn} onClick={() => { setError(''); setStep(2) }}>← Back</button>
                <button style={{ ...payBtn, opacity: loading ? 0.7 : 1 }} onClick={handlePay} disabled={loading}>
                  {loading ? '⏳ Processing...' : `Pay ₹${totalAmt.toLocaleString('en-IN')} →`}
                </button>
              </div>
            </>
          )}

          {/* ── Step 4: Confirmed ── */}
          {step === 4 && (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{ fontSize: 56, marginBottom: 12 }}>🎉</div>
              <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6, color: '#111' }}>Booking Confirmed!</h2>
              <p style={{ color: '#6b7280', marginBottom: 20 }}>Your room is reserved. See you soon!</p>
              <div style={{
                display: 'inline-block', background: '#f3f4f6', borderRadius: 8,
                padding: '6px 14px', fontSize: 12, fontFamily: 'monospace', color: '#374151', marginBottom: 20,
              }}>
                TXN: {txn}
              </div>
              <div style={{ background: '#f9fafb', borderRadius: 12, padding: '14px 20px', display: 'inline-block', minWidth: 220, textAlign: 'left' }}>
                <Row label="Room"     value={`#${room.room_number}`} />
                <Row label="Duration" value={`${totalHours} hrs`} />
                <div style={{ marginTop: 8 }}>
                  <Row label="Paid" value={`₹${totalAmt.toLocaleString('en-IN')}`} bold color="#22c55e" />
                </div>
              </div>
              <button style={{ ...primaryBtn, marginTop: 24 }} onClick={onSuccess}>Done ✓</button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}