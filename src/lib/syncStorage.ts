// Native: small settings that must be read synchronously at startup (the font choice in fontChoice.ts).
// AsyncStorage can only read asynchronously, so each value is a small file in the app's documents folder,
// read with expo-file-system's synchronous textSync. expo-file-system is part of Expo Go.
// Not expo-sqlite: its native module was missing on a phone running this app in Expo Go, and importing it
// there crashes at startup. expo-file-system is loaded lazily and every failure is caught, so a storage
// problem never stops the app from starting.
import type { File } from 'expo-file-system';

function fileFor(key: string): File | null {
  try {
    const fs = require('expo-file-system') as typeof import('expo-file-system');
    return new fs.File(fs.Paths.document, `${key.replace(/[^\w.-]/g, '_')}.json`);
  } catch {
    return null;
  }
}

export const syncStorage = {
  getItem(key: string): string | null {
    try {
      const file = fileFor(key);
      return file?.exists ? file.textSync() : null;
    } catch {
      return null;
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    const file = fileFor(key);
    if (!file) throw new Error('File storage is not available in this build.');
    if (!file.exists) file.create();
    await file.write(value);
  },
};
