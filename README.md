# Clean Campus / CleanMap 2.0

A responsive student reporting app and management dashboard for campus waste hotspots. Students pin a location, optionally attach up to two photos, and follow report status. Staff see updates in real time and can mark reports cleaned, reopen them, or delete reports.

## Apps

| App | Folder | Local URL |
|---|---|---|
| Student app | `student-app/` | http://localhost:5173 |
| Admin app | `admin-app/` | http://localhost:5174 |

Both apps use the same Supabase project. The UI uses React, Vite, Leaflet and OpenStreetMap.

## 1. Configure Supabase

1. Create a project at [Supabase](https://supabase.com/dashboard).
2. Open **SQL Editor** and run `supabase-setup.sql` from this repository.
3. Add each approved staff email in lowercase, e.g. `insert into public.admins(email) values ('warden@gmail.com');`.
4. In **Authentication → Providers → Google**, enable Google and configure the Google OAuth Client ID and secret from Google Cloud Console. The Supabase callback URI is `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`.
5. In **Authentication → URL Configuration**, add `http://localhost:5173` and `http://localhost:5174` to the redirect URL allow-list. Add production URLs before deployment.
6. Copy `.env.example` to `.env.local` in both `student-app/` and `admin-app/`, and fill in your Supabase project URL and publishable/legacy anon key. Never put a `service_role` or secret key in a Vite environment variable.

The SQL creates the reports/admin tables, row-level security policies, the photo bucket, and a protected RPC for admin status changes. Admin privileges are based on the authenticated email matching `public.admins`, not user-editable profile metadata.

**Photo privacy:** the setup creates a public `report-images` bucket to keep image URLs simple. Anyone with a photo URL can view it. Do not upload sensitive images. For private photos, make the bucket private and change the app to use authenticated downloads or signed URLs.

## 2. Install and run

Use Node.js 18 or newer.

```bash
cd student-app
npm install
npm run dev
```

In another terminal:

```bash
cd admin-app
npm install
npm run dev
```

The student app runs at `http://localhost:5173`; the admin app runs at `http://localhost:5174`. Both require the environment variables above.

## 3. How it works

### Students
1. Sign in with Google.
2. Tap the map to select a waste location, or use device location.
3. Add an optional note and up to two photos, then submit.
4. Open **My reports** to view status changes.

### Management
1. Sign in with an email present in `public.admins`.
2. See reports update in real time.
3. Select a report to inspect its location and photos.
4. Mark it cleaned, reopen it, or delete it.

## 4. Build for deployment

Build both apps separately:

```bash
cd student-app && npm run build
cd ../admin-app && npm run build
```

Deploy each `dist/` directory to a static host. Configure each deployed origin in Supabase Auth's redirect URL allow-list and configure the environment variables in the hosting provider.

## 5. Customisation

- Map centre: `student-app/src/MapPicker.jsx` and `admin-app/src/AdminMap.jsx` (`CAMPUS`).
- Colours and themes: each app's `src/styles.css` and `src/useTheme.js`.
- SQL schema and policies: `supabase-setup.sql`.

## Troubleshooting

- **Google sign-in redirect error:** check the Supabase Google provider settings and URL Configuration allow-list.
- **Reports not visible:** check the SQL setup completed, the environment variables match the same Supabase project, and RLS policies exist.
- **Admin says no access:** add the exact staff email in lowercase to `public.admins`.
- **Photo upload fails:** check the `report-images` bucket exists and the browser session is signed in.
- **Realtime not updating:** ensure `public.reports` is included in the `supabase_realtime` publication.
- **Map tiles blank:** check the internet connection; OpenStreetMap tiles require connectivity.
