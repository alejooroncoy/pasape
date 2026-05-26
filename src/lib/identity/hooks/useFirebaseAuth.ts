// Backward-compat shim. Toda la auth ahora es Supabase.
// Los consumidores siguen importando useGoogleSignIn y useSignOut desde acá.
// useSmsSignIn fue removido — el único proveedor activo es Google OAuth.
export { useGoogleSignIn, useSignOut } from "./useSupabaseAuth";
