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


## V2.1 (fixes + enhancements)
Run `supabase/fix_v2_1.sql` in Supabase SQL Editor AFTER `upgrade_v2.sql`.

Fixed:
- Bag drawer never opened (Bag button now opens the slide-out bag, Esc closes it)
- Home category tiles now open Products already filtered (`?category=`)
- Security: customers could insert orders directly with any price - that policy is removed
- Checkout validates empty bag, quantity limit, bad product ids, field lengths
- Home page no longer goes blank if banners/reviews fail to load
- Order success page status now works (safe `track_order` function)
- Cart qty limit (99), cart prices refreshed from DB at checkout, unavailable items removed automatically

Enhanced:
- Products: sorting (price / offers), offer price shown on home cards
- Featured products (admin checkbox) shown first in Popular Products
- Admin orders: payment method, notes, Call and WhatsApp buttons
- Admin: offer price must be lower than normal price; login redirects if already signed in
- Success page: "Send order on WhatsApp" button with order number
- Favicon, meta description, better mobile nav, focus styles, hover effects


## V3 (Inventory + Reports + Logo)
Run `supabase/inventory_v3.sql` in Supabase SQL Editor (after the other SQL files).
- Admin > Inventory: SKU items, Stock In (date, qty, cost, supplier), Sale, Adjust, low-stock alerts, stock history
- Link an item to a website product: completed online orders auto-deduct stock and count as sales
- Admin > Reports: date range, purchases / sales / profit / stock value, Print or Save as PDF, Download CSV (opens in Excel)
- Logo added to navbar, footer, admin and login (files in assets/img/)

## V4 (Sidebar fix, Scanner, Receiving/Dispatching/Count, Settings)
Run `supabase/settings_v4.sql` in Supabase SQL Editor (after inventory_v3.sql).
- Fixed: admin sidebar sections now open one at a time (Dashboard shows only the dashboard)
- Products & SKU: SKU + barcode on every product
- Receiving, Dispatching (prints sales receipt), Ending Inventory (count, apply, print)
- Barcode scanner: USB/Bluetooth scanners work as a keyboard - click the scan box and scan
- Receipt: uses the browser print dialog - choose your thermal/normal printer
- Settings: delivery fee, free-delivery amount, minimum order, delivery areas, accept orders on/off, receipt footer
