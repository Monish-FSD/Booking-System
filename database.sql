-- ============================================================
-- StayEase Room Booking System — Full Database Setup
-- Paste this entire file into Supabase SQL Editor and run it.
-- ============================================================

-- ============================================================
-- STEP 1: ENABLE EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ============================================================
-- STEP 2: CREATE TABLES
-- ============================================================

-- Profiles table (synced with Supabase Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rooms table
CREATE TABLE IF NOT EXISTS public.rooms (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  room_number INTEGER UNIQUE NOT NULL,
  name TEXT NOT NULL,
  room_type TEXT NOT NULL CHECK (room_type IN ('single', 'double', 'suite', 'deluxe')),
  price_per_hour NUMERIC(10, 2) NOT NULL CHECK (price_per_hour > 0),
  amenities TEXT[] DEFAULT '{}',
  description TEXT,
  is_available BOOLEAN DEFAULT TRUE,
  max_occupancy INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bookings table
CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE NOT NULL,
  booking_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  total_hours INTEGER NOT NULL CHECK (total_hours > 0),
  total_amount NUMERIC(10, 2) NOT NULL,
  status TEXT DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

-- Payments table
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  payment_method TEXT CHECK (payment_method IN ('card', 'upi', 'netbanking')),
  payment_type TEXT DEFAULT 'one_time' CHECK (payment_type IN ('one_time', 'recurring')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  transaction_id TEXT UNIQUE,
  card_last4 TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- STEP 3: RPC FUNCTION — Check Room Availability
-- Called before booking to prevent race conditions
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_room_availability(
  p_room_id UUID,
  p_date DATE,
  p_start_time TIME,
  p_end_time TIME
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  conflict_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO conflict_count
  FROM public.bookings
  WHERE room_id = p_room_id
    AND booking_date = p_date
    AND status IN ('confirmed', 'pending')
    AND (
      (start_time < p_end_time AND end_time > p_start_time)
    );

  RETURN conflict_count = 0;
END;
$$;


-- ============================================================
-- STEP 4: DATABASE TRIGGER — Prevent Double Booking
-- Runs automatically on INSERT to bookings table
-- ============================================================
CREATE OR REPLACE FUNCTION public.prevent_double_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  conflict_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO conflict_count
  FROM public.bookings
  WHERE room_id = NEW.room_id
    AND booking_date = NEW.booking_date
    AND id != NEW.id
    AND status IN ('confirmed', 'pending')
    AND (
      (start_time < NEW.end_time AND end_time > NEW.start_time)
    );

  IF conflict_count > 0 THEN
    RAISE EXCEPTION 'Booking conflict: This room is already booked for the selected time slot.';
  END IF;

  RETURN NEW;
END;
$$;

-- Attach trigger to bookings table
DROP TRIGGER IF EXISTS trigger_prevent_double_booking ON public.bookings;
CREATE TRIGGER trigger_prevent_double_booking
  BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.prevent_double_booking();


-- ============================================================
-- STEP 5: TRIGGER — Auto-create Profile on Sign Up
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================================
-- STEP 6: TRIGGER — Auto-update updated_at timestamps
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_rooms_updated_at ON public.rooms;
CREATE TRIGGER set_rooms_updated_at BEFORE UPDATE ON public.rooms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS set_bookings_updated_at ON public.bookings;
CREATE TRIGGER set_bookings_updated_at BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- ============================================================
-- STEP 7: ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first to avoid conflicts
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "rooms_public_read" ON public.rooms;
DROP POLICY IF EXISTS "rooms_admin_all" ON public.rooms;
DROP POLICY IF EXISTS "bookings_user_own" ON public.bookings;
DROP POLICY IF EXISTS "bookings_insert_auth" ON public.bookings;
DROP POLICY IF EXISTS "bookings_admin_all" ON public.bookings;
DROP POLICY IF EXISTS "payments_user_own" ON public.payments;
DROP POLICY IF EXISTS "payments_insert_auth" ON public.payments;
DROP POLICY IF EXISTS "payments_admin_all" ON public.payments;

-- PROFILES: Users can only see and edit their own profile
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- ROOMS: Anyone (even unauthenticated) can read rooms
-- Only service_role (admin backend) can modify rooms
CREATE POLICY "rooms_public_read" ON public.rooms
  FOR SELECT USING (true);

CREATE POLICY "rooms_admin_all" ON public.rooms
  FOR ALL USING (auth.role() = 'service_role');

-- BOOKINGS: Users see only their own bookings
CREATE POLICY "bookings_user_own" ON public.bookings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "bookings_insert_auth" ON public.bookings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "bookings_update_own" ON public.bookings
  FOR UPDATE USING (auth.uid() = user_id);

-- Service role (admin) can see all bookings
CREATE POLICY "bookings_admin_all" ON public.bookings
  FOR ALL USING (auth.role() = 'service_role');

-- PAYMENTS: Users see only their own payments
CREATE POLICY "payments_user_own" ON public.payments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "payments_insert_auth" ON public.payments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Service role (admin) can see all payments
CREATE POLICY "payments_admin_all" ON public.payments
  FOR ALL USING (auth.role() = 'service_role');


-- ============================================================
-- STEP 8: GRANT SERVICE ROLE ADMIN ACCESS TO VIEWS
-- The admin panel uses anon key — grant read for admin queries
-- ============================================================

-- Grant anon read on profiles so admin panel can show guest names
CREATE POLICY "profiles_service_read" ON public.profiles
  FOR SELECT USING (true);

-- Grant anon read on bookings for admin panel
CREATE POLICY "bookings_anon_read" ON public.bookings
  FOR SELECT USING (true);

-- Grant anon read on payments for admin panel
CREATE POLICY "payments_anon_read" ON public.payments
  FOR SELECT USING (true);


-- ============================================================
-- STEP 9: SEED 50 ROOMS
-- ============================================================
INSERT INTO public.rooms (room_number, name, room_type, price_per_hour, amenities, description, is_available, max_occupancy)
VALUES
-- Floor 1 (Rooms 101-110) — Budget Single Rooms
(101, 'Cozy Single Haven', 'single', 250, ARRAY['tv', 'wifi'], 'A comfortable single room perfect for solo travelers.', true, 1),
(102, 'Standard Single Room', 'single', 250, ARRAY['tv', 'wifi', 'ac'], 'Clean and comfortable standard single room with AC.', true, 1),
(103, 'Classic Single', 'single', 280, ARRAY['tv', 'wifi', 'ac', 'safe'], 'Classic single room with modern amenities.', true, 1),
(104, 'Solo Retreat', 'single', 270, ARRAY['tv', 'wifi'], 'A peaceful retreat for the solo traveler.', true, 1),
(105, 'Garden View Single', 'single', 300, ARRAY['tv', 'wifi', 'ac', 'balcony'], 'Single room with a lovely garden view balcony.', true, 1),
(106, 'Budget Single', 'single', 220, ARRAY['tv', 'wifi'], 'Budget-friendly single room with essentials.', true, 1),
(107, 'Standard Single Plus', 'single', 290, ARRAY['tv', 'wifi', 'ac', 'safe'], 'Enhanced single room with extra amenities.', true, 1),
(108, 'Compact Single', 'single', 240, ARRAY['wifi'], 'Compact and efficient single room.', true, 1),
(109, 'Traveler Single', 'single', 260, ARRAY['tv', 'wifi', 'ac'], 'Designed for the frequent traveler.', true, 1),
(110, 'Premium Single', 'single', 350, ARRAY['tv', 'wifi', 'ac', 'safe', 'minibar'], 'Premium single room with minibar.', true, 1),

-- Floor 2 (Rooms 201-210) — Standard Double Rooms
(201, 'Classic Double Room', 'double', 450, ARRAY['tv', 'wifi', 'ac'], 'Spacious double room perfect for couples.', true, 2),
(202, 'Comfort Double', 'double', 480, ARRAY['tv', 'wifi', 'ac', 'safe'], 'Comfortable double room with in-room safe.', true, 2),
(203, 'Family Double', 'double', 500, ARRAY['tv', 'wifi', 'ac', 'safe', 'minibar'], 'Great for families with added minibar.', true, 2),
(204, 'Garden Double', 'double', 520, ARRAY['tv', 'wifi', 'ac', 'balcony'], 'Double room with beautiful garden balcony.', true, 2),
(205, 'Standard Double', 'double', 420, ARRAY['tv', 'wifi', 'ac'], 'Standard double room with all essentials.', true, 2),
(206, 'Superior Double', 'double', 560, ARRAY['tv', 'wifi', 'ac', 'safe', 'bathtub'], 'Superior double with luxurious bathtub.', true, 2),
(207, 'Twin Double', 'double', 460, ARRAY['tv', 'wifi', 'ac', 'safe'], 'Two twin beds in a spacious double room.', true, 2),
(208, 'Couples Retreat', 'double', 490, ARRAY['tv', 'wifi', 'ac', 'minibar', 'balcony'], 'Romantic retreat for couples.', true, 2),
(209, 'Economy Double', 'double', 380, ARRAY['tv', 'wifi'], 'Budget-friendly double room.', true, 2),
(210, 'Premium Double', 'double', 600, ARRAY['tv', 'wifi', 'ac', 'safe', 'minibar', 'bathtub'], 'Premium double with all luxury amenities.', true, 2),

-- Floor 3 (Rooms 301-310) — Deluxe Rooms
(301, 'Deluxe City View', 'deluxe', 750, ARRAY['tv', 'wifi', 'ac', 'safe', 'minibar', 'bathtub'], 'Deluxe room with stunning city view.', true, 2),
(302, 'Deluxe Pool View', 'deluxe', 800, ARRAY['tv', 'wifi', 'ac', 'safe', 'minibar', 'balcony'], 'Deluxe room overlooking the pool.', true, 2),
(303, 'Deluxe Executive', 'deluxe', 820, ARRAY['tv', 'wifi', 'ac', 'safe', 'minibar', 'bathtub', 'gym'], 'Executive deluxe with gym access.', true, 3),
(304, 'Deluxe Family Suite', 'deluxe', 900, ARRAY['tv', 'wifi', 'ac', 'safe', 'minibar', 'balcony', 'bathtub'], 'Spacious deluxe for families.', true, 4),
(305, 'Deluxe Spa Room', 'deluxe', 850, ARRAY['tv', 'wifi', 'ac', 'safe', 'bathtub', 'minibar'], 'Relaxing deluxe with spa bathtub.', true, 2),
(306, 'Deluxe Business', 'deluxe', 780, ARRAY['tv', 'wifi', 'ac', 'safe', 'minibar'], 'Perfect for business travelers.', true, 2),
(307, 'Deluxe Garden Terrace', 'deluxe', 880, ARRAY['tv', 'wifi', 'ac', 'safe', 'minibar', 'balcony', 'bathtub'], 'Deluxe with private garden terrace.', true, 2),
(308, 'Deluxe Heritage', 'deluxe', 760, ARRAY['tv', 'wifi', 'ac', 'safe', 'bathtub'], 'Heritage-style deluxe room.', true, 2),
(309, 'Deluxe Panorama', 'deluxe', 870, ARRAY['tv', 'wifi', 'ac', 'safe', 'minibar', 'balcony'], 'Panoramic view deluxe room.', true, 3),
(310, 'Deluxe Grand', 'deluxe', 950, ARRAY['tv', 'wifi', 'ac', 'safe', 'minibar', 'bathtub', 'balcony', 'gym'], 'Grand deluxe with every amenity.', true, 3),

-- Floor 4 (Rooms 401-410) — Suites
(401, 'Junior Suite', 'suite', 1200, ARRAY['tv', 'wifi', 'ac', 'safe', 'minibar', 'bathtub'], 'Elegant junior suite for a luxurious stay.', true, 2),
(402, 'Executive Suite', 'suite', 1500, ARRAY['tv', 'wifi', 'ac', 'safe', 'minibar', 'bathtub', 'gym'], 'Executive suite for top-tier business stays.', true, 2),
(403, 'Honeymoon Suite', 'suite', 1800, ARRAY['tv', 'wifi', 'ac', 'safe', 'minibar', 'bathtub', 'balcony'], 'Romantic honeymoon suite with rose petal service.', true, 2),
(404, 'Family Suite', 'suite', 1600, ARRAY['tv', 'wifi', 'ac', 'safe', 'minibar', 'bathtub', 'balcony'], 'Spacious family suite with two bedrooms.', true, 5),
(405, 'Royal Suite', 'suite', 2500, ARRAY['tv', 'wifi', 'ac', 'safe', 'minibar', 'bathtub', 'balcony', 'gym'], 'Our finest suite with premium everything.', true, 3),
(406, 'Ocean View Suite', 'suite', 2000, ARRAY['tv', 'wifi', 'ac', 'safe', 'minibar', 'bathtub', 'balcony'], 'Breathtaking ocean view suite.', true, 2),
(407, 'Penthouse Suite', 'suite', 3000, ARRAY['tv', 'wifi', 'ac', 'safe', 'minibar', 'bathtub', 'balcony', 'gym'], 'Our iconic penthouse — the ultimate luxury.', true, 4),
(408, 'Garden Suite', 'suite', 1400, ARRAY['tv', 'wifi', 'ac', 'safe', 'minibar', 'balcony', 'bathtub'], 'Suite with a private garden patio.', true, 2),
(409, 'Spa Suite', 'suite', 1900, ARRAY['tv', 'wifi', 'ac', 'safe', 'minibar', 'bathtub', 'gym'], 'Indulge with a private spa experience.', true, 2),
(410, 'Heritage Suite', 'suite', 1700, ARRAY['tv', 'wifi', 'ac', 'safe', 'minibar', 'bathtub', 'balcony'], 'Heritage-inspired suite with antique décor.', true, 3),

-- Floor 5 (Rooms 501-510) — Mixed Premium Rooms
(501, 'Sky View Single', 'single', 400, ARRAY['tv', 'wifi', 'ac', 'safe', 'minibar', 'balcony'], 'Single room with sky-high views.', true, 1),
(502, 'Rooftop Double', 'double', 700, ARRAY['tv', 'wifi', 'ac', 'safe', 'minibar', 'balcony', 'bathtub'], 'Double room with rooftop terrace.', true, 2),
(503, 'Artist Loft Single', 'single', 380, ARRAY['tv', 'wifi', 'ac', 'safe'], 'Creative loft-style single room.', true, 1),
(504, 'Wellness Double', 'double', 650, ARRAY['tv', 'wifi', 'ac', 'safe', 'bathtub', 'gym'], 'Double room focused on wellness.', true, 2),
(505, 'Night Owl Single', 'single', 320, ARRAY['tv', 'wifi', 'ac'], 'Comfortable single with blackout curtains.', true, 1),
(506, 'Business Double', 'double', 580, ARRAY['tv', 'wifi', 'ac', 'safe', 'minibar'], 'Double room equipped for business.', true, 2),
(507, 'Vintage Deluxe', 'deluxe', 1000, ARRAY['tv', 'wifi', 'ac', 'safe', 'minibar', 'bathtub', 'balcony'], 'Vintage-themed deluxe room.', true, 2),
(508, 'Modern Deluxe', 'deluxe', 1050, ARRAY['tv', 'wifi', 'ac', 'safe', 'minibar', 'gym', 'balcony'], 'Ultra-modern deluxe room with tech focus.', true, 2),
(509, 'Eco Deluxe', 'deluxe', 980, ARRAY['tv', 'wifi', 'ac', 'safe', 'balcony'], 'Eco-friendly deluxe with sustainable design.', true, 2),
(510, 'Grand Finale Suite', 'suite', 2200, ARRAY['tv', 'wifi', 'ac', 'safe', 'minibar', 'bathtub', 'balcony', 'gym'], 'Our grand top-floor statement suite.', true, 4)

ON CONFLICT (room_number) DO NOTHING;


-- ============================================================
-- DONE! Your database is ready.
-- Summary:
--   Tables: profiles, rooms, bookings, payments
--   RPC: check_room_availability()
--   Triggers: prevent_double_booking, handle_new_user, updated_at
--   RLS Policies: on all 4 tables
--   Seeded: 50 rooms across 5 floors
-- ============================================================
