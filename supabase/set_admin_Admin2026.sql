-- Run this once after creating Admin2026@gmail.com in Supabase Authentication.
-- This gives the account access to the YACUBA admin dashboard.
update public.profiles
set role = 'admin'
where lower(email) = lower('Admin2026@gmail.com');

select email, role
from public.profiles
where lower(email) = lower('Admin2026@gmail.com');
