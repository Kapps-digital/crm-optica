import { createClient } from '@supabase/supabase-js';

// URL y Anon Key públicas de Supabase para conexiones Realtime (WebSockets)
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://jwctsfnkyfokrgtcjtxs.supabase.co';

const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3Y3RzZm5reWZva3JndGNqdHhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3OTE2NjgsImV4cCI6MjEwNjM2NzY2OH0.I5jL8UKofVyZCFqt2FxxqnTCxgmRNypoB3AsESKYNNo';

export const clienteSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});
