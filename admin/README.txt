YACUBA LOGIN FIX

Replace only:
admin/login.html

Keep your existing:
assets/js/config.js

Your config.js must be valid, for example:
export const SUPABASE_URL = "https://wrdsxcdabpzwbfgcbbol.supabase.co";
export const SUPABASE_ANON_KEY = "YOUR_PUBLISHABLE_KEY";

After committing, redeploy Cloudflare and hard refresh the admin login page with Ctrl+F5.
