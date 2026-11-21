import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';
import { authStorage } from './authStorage';
import { IS_PREVIEW } from './preview';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!IS_PREVIEW && (!supabaseUrl || !supabasePublishableKey)) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Copy .env.example to .env.local and fill them in, ' +
      'or run `npm run preview:web` (EXPO_PUBLIC_PREVIEW=1) to use sample data without a backend.',
  );
}

// In preview mode the client is created but never called (see preview.ts).
export const supabase = createClient(supabaseUrl ?? 'https://preview.invalid', supabasePublishableKey ?? 'preview', {
  auth: {
    storage: authStorage,
    autoRefreshToken: !IS_PREVIEW,
    persistSession: !IS_PREVIEW,
    detectSessionInUrl: false,
  },
});

// Only refresh tokens while the app is in the foreground.
if (!IS_PREVIEW) {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
