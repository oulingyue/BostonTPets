// Web: browsers have localStorage built in. (expo-sqlite's web build needs WASM workers and
// cross-origin isolation headers, which a plain dev server doesn't send.)
// Undefined during static rendering in Node; supabase-js then keeps the session in memory.
export const authStorage = typeof localStorage === 'undefined' ? undefined : localStorage;
