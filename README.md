# 🏨 StayEase — Room Booking System

A full-stack room booking system with payment integration, built with React + Supabase.

---

## 🚀 Quick Setup (Step by Step)

### Step 1 — Supabase Project Setup

1. Go to [https://supabase.com](https://supabase.com) and create a new project
2. Wait for the project to be ready
3. Go to **SQL Editor** in the sidebar
4. Open the file `database.sql` from this project
5. Paste the **entire contents** into the SQL Editor and click **Run**
6. You should see "Success" — all tables, triggers, RLS, and 50 rooms are created

### Step 2 — Get Your Supabase Keys

1. In Supabase, go to **Settings → API**
2. Copy your **Project URL**
3. Copy your **anon/public key**

### Step 3 — Configure Environment

1. In this project folder, copy `.env.example` to `.env`:
   ```
   cp .env.example .env
   ```
2. Open `.env` and fill in your keys:
   ```
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

### Step 4 — Install & Run

```bash
npm install
npm run dev
```

The app will start at: **http://localhost:5173**

---

## 🔗 URLs

| Page | URL |
|---|---|
| User Panel (Home) | http://localhost:5173/ |
| My Bookings | http://localhost:5173/bookings |
| Admin Login | http://localhost:5173/admin/login |
| Admin Dashboard | http://localhost:5173/admin |
| Admin — Rooms | http://localhost:5173/admin/rooms |
| Admin — Bookings | http://localhost:5173/admin/bookings |
| Admin — Payments | http://localhost:5173/admin/payments |

---

## 🔑 Admin Credentials

```
Email:    admin@hotel.com
Password: admin123456
```

---

## ✨ Features

### User Panel
- Browse all 50 rooms without login
- Filter by: availability, room type, amenities, price
- Book rooms with hourly time slots
- Login required only when booking
- Mock payment gateway (Card / UPI / Net Banking)
- One-time and recurring payment types
- View personal booking history
- User name shown in top-right after login
- Logout button

### Admin Panel
- Separate login (hardcoded credentials)
- Dashboard with stats and revenue chart (daily/monthly/yearly)
- Add / Edit / Delete rooms
- Toggle room availability
- View all customer bookings with search and filters
- View all payments and revenue breakdown

### Security & Backend
- Supabase Auth for user authentication
- Row Level Security (RLS) on all tables
- RPC function to check availability before booking
- Database trigger to prevent double booking
- Auto-created user profile on signup

---

## 📁 Project Structure

```
src/
├── components/
│   ├── AuthModal.jsx       # Login/Signup modal
│   ├── BookingModal.jsx    # Room booking with time slots
│   ├── PaymentModal.jsx    # Mock payment gateway
│   └── RoomCard.jsx        # Room display card
├── context/
│   └── AuthContext.jsx     # User auth state
├── hooks/
│   └── useAdminAuth.js     # Admin session management
├── lib/
│   └── supabase.js         # Supabase client
├── pages/
│   ├── user/
│   │   ├── UserLayout.jsx        # Navbar layout
│   │   ├── HomePage.jsx          # Room browsing
│   │   └── BookingHistoryPage.jsx
│   └── admin/
│       ├── AdminLogin.jsx
│       ├── AdminLayout.jsx       # Sidebar layout
│       ├── AdminDashboard.jsx
│       ├── AdminRooms.jsx
│       ├── AdminBookings.jsx
│       └── AdminPayments.jsx
├── styles/
│   └── main.css            # All CSS (no external libraries)
├── App.jsx
└── main.jsx

database.sql    ← Run this in Supabase SQL Editor
```

---

## 🏨 Room Pricing Structure

| Room Type | Price Range | Amenities |
|---|---|---|
| Single | ₹220–₹400/hr | TV, WiFi, AC |
| Double | ₹380–₹700/hr | TV, WiFi, AC, Minibar |
| Deluxe | ₹750–₹1050/hr | All + Bathtub, Balcony |
| Suite | ₹1200–₹3000/hr | All Premium |

---

## 🗄️ Database Tables

| Table | Description |
|---|---|
| `profiles` | User profiles linked to auth |
| `rooms` | All 50 rooms with amenities |
| `bookings` | All booking records |
| `payments` | Payment transactions |
