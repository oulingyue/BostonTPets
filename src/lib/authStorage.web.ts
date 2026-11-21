// Web: browsers have localStorage built in, so the session is kept there.
// Undefined during static rendering in Node; supabase-js then keeps the session in memory.
export const authStorage = typeof localStorage === 'undefined' ? undefined : localStorage;
