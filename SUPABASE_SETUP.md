# Supabase setup

Voltstock uses one shared inventory for every authenticated user in a Supabase project. The browser only receives the project URL and public anon key; never put a service-role key in this app.

## 1. Create the project and database

1. Create a Supabase project and open its SQL Editor.
2. Run the SQL files in `supabase/migrations/` in timestamp order. For an existing project, run any migration added after the one you have already applied.
3. In **Project Settings → API**, copy the project URL and the public anon key.
4. Copy `.env.example` to `.env.local` and fill in the two values:

   ```dotenv
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```

5. Restart the Vite server after changing environment variables.

The migration creates the shared products table, user profiles, an append-only activity log, photo storage rules, row-level security policies, and realtime subscriptions. It seeds the sample inventory only where a SKU does not already exist, so it is safe to run again.

The later `20261029020000_import_eb_shop_inventory.sql` migration imports the EB Shop spreadsheet inventory. It combines repeated product names, applies the workbook's `New Price` and `New Qty` formulas, and assigns import SKUs. Voltstock displays all product prices in Moroccan dirhams (MAD/DH).

## 2. Invite team members

1. In Supabase Authentication settings, leave email/password sign-in enabled and disable public sign-ups.
2. Set the Auth **Site URL** to the deployed app URL. Add that URL and `http://localhost:5173` to the allowed redirect URLs.
3. In **Authentication → Users**, invite each team member by email. Do not add a public sign-up form to the app.
4. Team members can use **Set or reset your password** on the sign-in screen to get a password link. After setting it, they can sign in with their invited email.

Only invited, authenticated users can access the inventory. Every such user sees and can edit the same products. The database records the authenticated user, operation, product snapshot, and time for each create, edit, or delete; the app shows the latest 100 changes and identifies the last editor on each product. The stock-movement summary totals units received and sent out from recorded stock changes.

## 3. Deploy

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as build-time environment variables in the hosting provider, and add the deployed origin to Supabase's allowed redirect URLs. Never expose a Supabase service-role key in Vite environment variables.

Product photos use a public-read storage bucket because inventory images are displayed to all team members. Upload, update, and delete operations still require an authenticated user.

Voltstock is also installable as a Progressive Web App when served over HTTPS (localhost is allowed for development). The service worker caches the app shell and static assets so the app can open offline. Shared inventory, sign-in, photos, and edits require a connection; edits are disabled while offline, and reconnecting refreshes shared data.

On supported browsers, use the browser's **Install app** or **Add to Home Screen** command to install Voltstock. App updates are applied automatically when a new version is deployed.
