// Native: persist the Supabase session with AsyncStorage (included in Expo Go), so you stay signed in
// across app restarts. This is the storage Supabase's React Native guide uses.
import AsyncStorage from '@react-native-async-storage/async-storage';

export const authStorage = AsyncStorage;
