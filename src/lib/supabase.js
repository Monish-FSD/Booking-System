import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// For admin operations, we can use service role if available
// but we'll primarily use the anon client with proper RLS policies
export const getAdminClient = () => {
  // In production, you'd use service_role key from an authenticated backend
  // For now, return the anon client which has RLS enabled
  return supabase
}
