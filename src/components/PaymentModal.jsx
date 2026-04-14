// import { useState, useCallback } from 'react'

// export default function PaymentModal({ room, totalHours, totalAmount, startDate, startHour, endDate, endHour, onBack, onPay, loading, serverError }) {
//   const [paymentType, setPaymentType] = useState('one_time')
//   const [method, setMethod] = useState('card')
//   const [card, setCard] = useState({ number: '', name: '', expiry: '', cvv: '' })
//   const [error, setError] = useState('')
//   const [processing, setProcessing] = useState(false)

//   const handleCardChange = e => {
//     let { name, value } = e.target
//     if (name === 'number') value = value.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim()
//     if (name === 'expiry') value = value.replace(/\D/g, '').slice(0, 4).replace(/(\d{2})(\d)/, '$1/$2')
//     if (name === 'cvv') value = value.replace(/\D/g, '').slice(0, 3)
//     setCard(prev => ({ ...prev, [name]: value }))
//   }

//   const [upiId, setUpiId] = useState('')

//   const handlePay = useCallback(async () => {
//     setError('')
//     if (method === 'card') {
//       if (card.number.replace(/\s/g, '').length < 16) { setError('Enter a valid 16-digit card number'); return }
//       if (!card.name.trim()) { setError('Enter cardholder name'); return }
//       if (card.expiry.length < 5) { setError('Enter a valid expiry date'); return }
//       if (card.cvv.length < 3) { setError('Enter a valid CVV'); return }
//     }

//     if (method === 'upi' && !upiId.trim()) {
//       setError('Enter a valid UPI ID')
//       return
//     }

//     if (!onPay || typeof onPay !== 'function') {
//       const callbackType = typeof onPay
//       console.error('Payment callback error - Expected function, got:', callbackType, onPay)
//       setError(`Payment callback is unavailable. Expected function, got ${callbackType}`)
//       return
//     }

//     setProcessing(true)
//     console.log('Payment triggered with callback type:', typeof onPay)
//     try {
//       await new Promise(resolve => setTimeout(resolve, 1800))
      
//       const paymentData = {
//         method,
//         type: paymentType,
//         card_last4: method === 'card' ? card.number.replace(/\s/g, '').slice(-4) : null
//       }
      
//       console.log('Calling onPay with data:', paymentData)
//       const result = await onPay(paymentData)
//       console.log('Payment successful, result:', result)
//     } catch (err) {
//       console.error('Payment failed:', err)
//       const errorMessage = err?.message || (typeof err === 'object' ? JSON.stringify(err) : String(err)) || 'Payment failed. Please try again.'
//       setError(errorMessage)
//     } finally {
//       setProcessing(false)
//     }
//   }, [onPay, method, paymentType, card, upiId])

//   return (
//     <div className="modal">
//       <div className="modal-header">
//         <div>
//           <h2 className="modal-title">Google Pay</h2>
//           <p className="modal-subtitle">Pay securely with a fast GPay-style checkout</p>
//         </div>
//         <button className="modal-close" onClick={onBack}>←</button>
//       </div>

//       <div className="modal-body">
//         <div className="gpay-banner">
//           <div className="gpay-brand">
//             <span className="gpay-logo">G</span>
//             <span>Google Pay</span>
//           </div>
//           <div className="gpay-amount">₹{totalAmount}</div>
//           <div className="gpay-details">
//             <span>{room.name}</span>
//             <span>{startDate === endDate ? startDate : `${startDate} → ${endDate}`}</span>
//           </div>
//         </div>

//         <div className="payment-summary gpay-payment-summary">
//           <div className="payment-summary-title">Booking summary</div>
//           <div className="payment-row"><span>Room</span><span>{room.name}</span></div>
//           <div className="payment-row"><span>Date</span><span>{startDate === endDate ? startDate : `${startDate} → ${endDate}`}</span></div>
//           <div className="payment-row"><span>Time</span><span>{startHour} → {endHour}</span></div>
//           <div className="payment-row"><span>Duration</span><span>{totalHours} hrs × ₹{room.price_per_hour}</span></div>
//           <div className="payment-row total"><span>Total Amount</span><span>₹{totalAmount}</span></div>
//         </div>

//         <div className="form-group mb-16">
//           <label className="form-label">Pay with</label>
//           <div className="gpay-method-grid">
//             {[
//               { value: 'card', label: 'Card', sub: 'Visa / Mastercard' },
//               { value: 'upi', label: 'UPI', sub: 'GPay / PhonePe' },
//               { value: 'netbanking', label: 'Bank', sub: 'Net Banking' }
//             ].map(option => (
//               <button
//                 key={option.value}
//                 type="button"
//                 className={`gpay-method-card ${method === option.value ? 'active' : ''}`}
//                 onClick={() => setMethod(option.value)}
//               >
//                 <div>{option.label}</div>
//                 <small>{option.sub}</small>
//               </button>
//             ))}
//           </div>
//         </div>

//         {method === 'card' && (
//           <div className="card-input-group mb-16">
//             <div className="gpay-input-group">
//               <div className="gpay-input-row">
//                 <input className="form-input gpay-input" name="number" placeholder="1234 5678 9012 3456" value={card.number} onChange={handleCardChange} />
//               </div>
//               <div className="gpay-input-row">
//                 <input className="form-input gpay-input" name="name" placeholder="Cardholder Name" value={card.name} onChange={handleCardChange} />
//               </div>
//               <div className="card-row">
//                 <input className="form-input gpay-input" name="expiry" placeholder="MM/YY" value={card.expiry} onChange={handleCardChange} />
//                 <input className="form-input gpay-input" name="cvv" placeholder="CVV" value={card.cvv} onChange={handleCardChange} type="password" />
//               </div>
//             </div>
//           </div>
//         )}

//         {method === 'upi' && (
//           <div className="form-group mb-16">
//             <input
//               className="form-input gpay-input"
//               placeholder="Enter UPI ID (e.g. name@upi)"
//               value={upiId}
//               onChange={e => setUpiId(e.target.value)}
//             />
//           </div>
//         )}

//         {method === 'netbanking' && (
//           <div className="form-group mb-16">
//             <select className="form-select gpay-input" value={card.name} onChange={e => setCard(prev => ({ ...prev, name: e.target.value }))}>
//               <option value="">Select Your Bank</option>
//               <option>State Bank of India</option>
//               <option>HDFC Bank</option>
//               <option>ICICI Bank</option>
//               <option>Axis Bank</option>
//               <option>Kotak Mahindra Bank</option>
//             </select>
//           </div>
//         )}

//         {(error || serverError) && <div className="alert alert-error">{error || String(serverError)}</div>}

//         <button
//           className="btn gpay-pay-button"
//           onClick={handlePay}
//           disabled={processing || loading}
//         >
//           {processing || loading
//             ? '⏳ Processing payment...'
//             : `Pay ₹${totalAmount} with GPay`}
//         </button>

//         <p className="gpay-note">Fast, secure, and mock-approved payment flow</p>
//       </div>
//     </div>
//   )
// }
