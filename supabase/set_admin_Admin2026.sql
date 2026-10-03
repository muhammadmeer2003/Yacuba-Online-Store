-- YACUBA ONLINE STORE — set the new admin account to admin
-- Create Admin2026@gmail.com first in Supabase Authentication > Users.
update public.profiles
set role = 'admin'
where lower(email) = lower('Admin2026@gmail.com');

select email, role
from public.profiles
where lower(email) = lower('Admin2026@gmail.com');
