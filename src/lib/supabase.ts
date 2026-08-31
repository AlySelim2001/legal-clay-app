import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// Create the client only when credentials are available.
// Until then, queries will throw a clear error.
export const supabase: SupabaseClient = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createClient('https://placeholder.supabase.co', 'placeholder-key');

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[CRIM-SYS] ⚠ Missing Supabase credentials.\n' +
    'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env.local file,\n' +
    'or paste them into the project Keys/API keys tab.\n' +
    'Data queries will fail until credentials are provided.',
  );
}
