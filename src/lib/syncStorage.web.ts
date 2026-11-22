// Web: localStorage is synchronous already. It's missing during static rendering in Node and can throw
// when site data is blocked, so reads fall back to null.
export const syncStorage = {
  getItem(key: string): string | null {
    try {
      return typeof localStorage === 'undefined' ? null : localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    localStorage.setItem(key, value);
  },
};
