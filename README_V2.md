# YACUBA ONLINE STORE — V2

This version turns the site into a proper small online ordering website:

Public:
- polished home page
- categories
- product catalogue
- Add to Bag
- bag / cart drawer
- checkout form
- server-side price calculation
- order success page
- customer reviews
- feedback form
- WhatsApp / phone / email / address

Admin:
- dashboard stats
- Products CRUD
- Categories CRUD
- Orders list + status updates
- Reviews moderation
- Feedback management
- Homepage offer/banner management

## Important
Keep your existing `assets/js/config.js`. Do NOT upload `config.example.js` as `config.js` because your real Supabase publishable key is already in the current project.

## Supabase
Run `supabase/upgrade_v2.sql` in Supabase SQL Editor AFTER your existing schema.sql.

## GitHub
Replace/upload all files from this V2 package EXCEPT:
- `assets/js/config.js` (keep your existing one)

Also keep your existing repo's Supabase URL and publishable key in config.js.

## Customer ordering
Orders are created using `place_order()` RPC, which calculates the product price from the database instead of trusting a price sent by the browser.

## Admin URL
`/admin/login.html`

The public navigation also contains an Admin button.

## Admin2026 login setup

The admin login page is preconfigured for the existing YACUBA Supabase project and defaults the email field to:

`Admin2026@gmail.com`

Do not put a password in code. Use the password you created in Supabase Authentication.

After creating the user, run:

`supabase/set_admin_Admin2026.sql`

The query must return `Admin2026@gmail.com | admin`.

Keep your existing `assets/js/config.js` if you already have one with the correct Supabase configuration. The standalone admin login does not depend on that file.
