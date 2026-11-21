// Native: persist the Supabase session with expo-sqlite's localStorage shim.
import 'expo-sqlite/localStorage/install';

export const authStorage = localStorage;
