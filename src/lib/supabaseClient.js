import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://toiwououqclatrdslwoe.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRvaXdvdW91cWNsYXRyZHNsd29lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0NTQ0ODgsImV4cCI6MjA3NjAzMDQ4OH0.MoZLiVH-weaycPYYDpvEC_AJn7ixOFjCus1zXks5BF0'

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Supabase: faltan las variables de entorno VITE_SUPABASE_URL y/o VITE_SUPABASE_ANON_KEY')
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
