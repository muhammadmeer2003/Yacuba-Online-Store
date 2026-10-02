# Mart Products Website

FreshMart-style product showcase + admin product/category management using GitHub + Cloudflare Pages + Supabase.

## Includes
- Responsive Home, Products, About, Contact sections
- Search and category filters
- Frozen Items, Grocery Items, Baked Items, Drinks, Snacks, Dairy Products starter categories
- Flexible categories: admin can add/edit/delete categories
- Admin login with Supabase Auth
- Admin product add/edit/delete
- Product image upload to Supabase Storage
- Price + optional offer price
- Availability / Out of Stock
- RLS security policies

## Stack
- Frontend: HTML/CSS/JavaScript
- Database/Auth/Storage: Supabase
- Hosting: Cloudflare Pages

## Supabase setup
1. Create a NEW Supabase project for this mart.
2. Open SQL Editor.
3. Run `supabase/schema.sql`.
4. In Authentication > Users, create an admin user.
5. Run:

```sql
update public.profiles
set role = 'admin'
where email = 'YOUR_ADMIN_EMAIL';
```

6. Open `assets/js/config.js` and add the Supabase project URL and anon/public key.

Never put a service-role key in frontend code.

## GitHub + Cloudflare
Upload all project files to a fresh GitHub repository.
Connect the repository to Cloudflare Pages.
Framework preset: None.
Build command: empty.
Output directory: `/`.

Public website: `/`
Admin login: `/admin/login.html`
Admin dashboard: `/admin/index.html`

## Branding
Edit `assets/js/config.js` to change the mart name, tagline, phone, WhatsApp, address, email, social links and logo.

## Scope
This version intentionally focuses on product display and product/category management. Cart, checkout, online payment and order tracking are not included.
