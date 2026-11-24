# CalSnap: AI calorie tracker (MERN)

A calorie tracker in the style of Cal AI. Take a photo of your meal (or describe it) and Google Gemini
estimates each item's portion in grams, plus its calories, protein, carbs and fat. It also says how
confident it is in the estimate.

**Stack:** MongoDB + Express + React (Vite) + Node, with Google Gemini (`@google/genai`, model
`gemini-3.8-flash` by default) for food photo and text analysis.

## Features
- Sign up and log in (JWT, bcrypt-hashed passwords)
- Onboarding that builds a personal calorie and macro plan (Mifflin-St Jeor formula)
- Home: calories left, macro rings, a 7-day strip and a logging streak
- 📸 Scan food with Gemini Vision. It recognises Indian dishes (biryani, dosa, idli, chapati, rice, dal,
  curries and more), estimates grams for each item, and shows a confidence level and what it's unsure about
- ✍️ Describe a meal in text, or 🔢 enter it manually
- Correct anything before saving. Changing the portion in grams rescales the calories and macros
- Per-user AI limits: 3 scans a day on the free plan, 20 on Pro (admins can override per user), plus a per-minute burst limit
- Progress: weight log and trend chart, BMI, 7-day and 30-day calorie charts
- Settings: edit your goals or profile and recalculate your plan
- Mobile-first layout with dark mode

## Get a Gemini API key (free)
1. Go to https://aistudio.google.com/apikey and sign in with a Google account.
2. Click **Create API key**, then choose or create a Google Cloud project.
3. Copy the key into `server/.env` as `GEMINI_API_KEY=...`.
4. The free tier has per-minute and per-day limits that Google can change. To see yours, go to
   https://aistudio.google.com/rate-limit. Note that on the free tier, Google may use your prompts and images
   to improve its products.

## Environment (`server/.env`)
```
MONGO_URI=mongodb://127.0.0.1:27017/calai
JWT_SECRET=<long random string>
GEMINI_API_KEY=<your key from AI Studio>
GEMINI_MODEL=gemini-3.8-flash
AI_FREE_DAILY_SCAN_LIMIT=3
AI_PRO_DAILY_SCAN_LIMIT=20
PRO_PRICE_ANDROID=30
PRO_PRICE_WEB=30
PRO_PRICE_IOS=50
PRO_TRIAL_DAYS=10
AI_SCANS_PER_MINUTE=5
AI_MAX_IMAGE_MB=4
PORT=5050
```
The key is only read by the backend. The browser never sees it, and `.env` is in `.gitignore`.

## Run
1. Install MongoDB locally, or create a free MongoDB Atlas cluster and put its link in `MONGO_URI`.
   (If MongoDB can't be reached, dev mode starts a temporary in-memory database, and its data is
   lost on restart.)
2. Backend:
   ```bash
   cd server
   npm install
   npm run dev
   ```
3. Frontend (in a second terminal):
   ```bash
   cd client
   npm install
   npm run dev
   ```
4. Open http://localhost:5173. To use it on your phone, connect to the same Wi-Fi and open
   `http://<your-PC-IP>:5173`.

### One server for the website and API
For deployment, build the website and start the Express server:
```bash
cd client
npm install
cd ../server
npm install
npm run build
npm start
```
Or, after installing dependencies in both folders, the build can be run from `server`:
```bash
npm run build
npm start
```
The Express server serves `client/dist` and the `/api` routes from the same origin. Set the deployment's
`PORT`, `MONGO_URI`, `JWT_SECRET`, and (if using food scanning) `GEMINI_API_KEY` environment variables.
The Vite proxy remains in use for local web development.

### Android and iPhone apps (same code as the website)
The website in `client/` is also the Android and iPhone app (Capacitor: `client/android`, `client/ios`).
All three use the same server, API and database.

**Live updates.** When the server is deployed, Render builds the website and also zips it as a live update
(`client/scripts/make-bundle.js` -> `client/updates/`). Each time the app opens, it asks
`/api/app/update` whether there's a newer bundle, downloads it, and switches to it the next time it goes to
the background. So a change to screens, text, styles or logic reaches the website right away and the apps
within one restart, with no store review. If a new bundle fails to start, the app rolls back by itself.
Check what is live with `GET /api/app/version`.

**Changes that need a store release:** a new Capacitor plugin, a new permission, the app icon, name or
splash screen. For those:
1. Raise `nativeVersion` in `client/package.json` (e.g. `1.0.0` -> `1.1.0`). Bundles are only offered to
   apps with the same native version, so older apps keep working code until they update from the store.
2. Android: `cd client` then `.\build-aab.ps1` and upload the `.aab` in the Play Console.
3. iPhone: start the **CalSnap iOS** workflow on Codemagic (`codemagic.yaml`), which uploads to TestFlight.

**Android release builds.** `client/build-aab.ps1` builds the signed `.aab` for the Play Store and raises
`nativeBuild` (the Play versionCode) each time. The first run creates the upload key at
`D:\android-build\keys\calsnap-upload.jks` and `client/android/keystore.properties`. **Back up both and
the password.** Both are kept out of git. `build-apk.ps1` still builds a debug APK against any server for testing.

**iPhone builds (no Mac needed).** One-time setup:
1. Join the Apple Developer Program (99 USD/year) and create the app in App Store Connect with bundle ID
   `in.fantek.calsnap`.
2. In App Store Connect -> Users and Access -> Integrations, create an API key (App Manager role).
3. In Codemagic, connect this GitHub repo and add the key under Team integrations -> App Store Connect,
   named `CalSnap App Store Connect`.
4. Start the **CalSnap iOS** workflow. It builds, signs and uploads to TestFlight. Testers install it with
   the TestFlight app.

The HealthKit capability (steps), camera/photo descriptions and privacy manifest are already in `client/ios`.

**Store requirements already handled:** Settings -> Delete account (`DELETE /api/auth/me`), a public
deletion page at `/delete-account.html`, a privacy policy at `/privacypolicy.html`, Health Connect limited to
`READ_STEPS`, and, in the apps, Pro shows "Coming soon" with no price comparison (store rules allow only
Google Play / Apple billing for in-app purchases).

### Mobile app (Expo, iOS + Android), old
Not used for the store apps any more (see above); kept for reference.
`mobile/` is a native version of the same app (Expo SDK 58 + Expo Router) that talks to the same backend.
It has the same screens as the web app; photos come from the camera or the gallery.

1. Start the backend (step 2 above). It prints the address phones should use, such as
   `on your network: http://192.168.1.20:5050`.
2. Start the app:
   ```bash
   cd mobile
   npm install
   npx expo start
   ```
3. Scan the QR code with Expo Go (Android) or the Camera app (iOS). The phone must be on the same Wi-Fi as the PC.

In development, the app finds the API on its own at port 5050. For a deployed native app, set
`EXPO_PUBLIC_API_URL` to the website origin (for example `https://your-website.example.com`, without `/api`)
before building; this makes it use the same server as the website. Expo web builds use their own origin by
default. The server address in use is shown at the bottom of the Settings tab. If the phone can't connect,
allow Node.js through the Windows Firewall on private networks.

After changing `.env`, stop the backend (Ctrl+C) and run `npm run dev` again. `.env` is only read at startup.

Without `GEMINI_API_KEY`, everything except AI analysis works. You can still log food manually.
If AI analysis returns 502, the app's backend is reachable but Gemini did not complete the request.
Check the backend terminal for the upstream error, then verify the API key, model availability, provider
quota and network access. Failed analysis requests do not use a daily scan.

## Plans (Free, free trial, Pro)
The **Plans** page (`/plans`, from Settings → Your plan, or the link under the AI scan counter) has three cards:
- **Free:** 3 AI scans a day.
- **Free trial:** Pro for 10 days, no payment; once per account. It ends by itself and the user goes back to Free.
- **Pro:** 20 AI scans a day. ₹30/month on Android and the website, ₹50/month on iPhone. The server picks the
  price from the `X-Client` platform header, so the app can't change it.

Online payment isn't connected yet: "Upgrade" shows a "coming soon" message. Admins can still give Pro or record
a payment from the admin website.

## Admin website (`admin/`)
A separate website for analysing the platform. It reads the same backend as the app and the user website:

```
React Native app ──┐
User website ──────┼──> Express API ──> MongoDB
Admin website ─────┘     (/api/admin routes: admins only)
```

Run it locally (with the backend running):
```bash
cd admin
npm install
npm run dev        # http://localhost:5174
```
Log in with an admin account (see **Becoming an admin** below). Admins also see an **📊 Admin website** link
in the user website's Settings. For production, set `VITE_API_URL` to the backend's address before building
(`admin/.env.example`); `render.yaml` deploys it as the `calsnap-admin` static site.

Pages:
- **Overview:** total users, new sign-ups, daily / weekly / monthly active users (DAU, WAU, MAU) and stickiness;
  paying Pro users, conversion to Pro, new Pro users, revenue, MRR and lifetime revenue; active users per day
  split by Android app / iOS app / website; AI usage, food logs, top users and foods, failures.
- **Users:** search, filter (Pro / free / lapsed, platform, active, admin, disabled) and sort; CSV export.
- **User detail:** plan and payments, platforms used, days active, profile, charts, AI requests and food logs.
  Actions: record a payment, give or cancel Pro, make/remove admin, disable, AI limit, reset scans, delete.
- **Pro & revenue:** all Pro users by expiry date and every payment (refund / undo); CSV export.
- **AI activity:** a searchable log of every AI request across all users; CSV export.

**Daily active users and platforms.** Every logged-in request marks the user active for that UTC day in the
`dailyactives` collection, with the platform from the `X-Client` header (`web`, `android`, `ios`). The app and
website send it automatically; the admin website sends `admin` and is not counted. Older app builds show as
"unknown". Sign-ups store `signupPlatform`.

**Pro plan and payments.** Each user has `plan` (`tier`, `period`, `source`, `since`, `expiresAt`,
`firstProAt`). A user is Pro while `tier` is `pro` and `expiresAt` is empty (lifetime) or in the future.
Payments are rows in the `payments` collection. Today an admin records them on the user's page; recording a
payment extends Pro by one period. To take payments automatically (Razorpay, Google Play Billing, App Store),
add a webhook route that creates a `Payment` and calls `activatePro()` from `server/utils/subscription.js`.

Every `/api/ai/analyze` call (success or failure) is stored in the `aievents` collection. Photos themselves
are not stored there; the thumbnail saved with each food log is.

**Becoming an admin:** set `ADMIN_EMAILS=you@example.com` (comma-separated) in `server/.env` or the Render
dashboard and log in, or run `node scripts/make-admin.js you@example.com` in `server/` (`--remove` to demote).

## API
| Method | Path | Purpose |
|---|---|---|
| POST | /api/auth/register, /api/auth/login | Create an account / log in |
| GET | /api/auth/me | Current user |
| PUT | /api/auth/profile | Save body profile and recalculate goals |
| PUT | /api/auth/goals | Override calorie and macro goals |
| POST | /api/auth/weight | Log weight |
| GET | /api/logs?date=YYYY-MM-DD | Entries and totals for a day |
| GET | /api/logs/summary?from=&to= | Totals for each day |
| GET | /api/logs/streak?today=YYYY-MM-DD | Consecutive logged days |
| POST/PUT/DELETE | /api/logs/:id | Create, edit or delete an entry |
| GET | /api/ai/usage | Today's AI scan quota |
| POST | /api/ai/analyze | `{ image?: dataURL, description?: string }` → nutrition estimate |
| GET | /api/billing/plans | Plans page: price for this platform, current plan, trial eligibility |
| POST | /api/billing/trial | Start the 10-day free Pro trial (once per account) |
| POST | /api/billing/checkout | Upgrade to Pro (returns 501 until a payment provider is connected) |
| GET | /api/admin/overview?days=30 | Admin: platform KPIs and daily series |
| GET | /api/admin/users?q=&status=&platform=&sort=&page= | Admin: users with usage stats and plan |
| GET/PATCH/DELETE | /api/admin/users/:id | Admin: user detail / role, disable, AI limit, reset, `plan` / delete |
| POST | /api/admin/users/:id/payments | Admin: record a payment (and extend Pro) |
| GET | /api/admin/payments?status=&provider=&q=&page= | Admin: payments with totals |
| PATCH | /api/admin/payments/:id | Admin: mark paid / refunded |
| GET | /api/admin/ai-events?kind=&status=&q=&user=&page= | Admin: AI request log |
| GET | /api/admin/export/users.csv, ai-events.csv, payments.csv | Admin: CSV exports |

`POST /api/ai/analyze` response:
```json
{
  "name": "Chicken Biryani with Raita",
  "portionGrams": 430, "calories": 690, "protein": 32, "carbs": 82, "fat": 25,
  "confidence": "medium",
  "uncertainty": "Amount of ghee/oil in the biryani is hard to judge from the photo.",
  "isEstimate": true, "healthScore": 5, "notes": "Filling meal; add a salad for fibre.",
  "items": [
    { "name": "Chicken biryani", "portionGrams": 330, "portion": "1 plate", "calories": 620,
      "protein": 29, "carbs": 75, "fat": 22, "confidence": "medium" }
  ],
  "scansLeft": 19
}
```
Errors return `{ "message": "..." }` with these status codes: 400 invalid input, 413 image too large, 415 unsupported
type, 422 no food detected, 429 scan limit or Gemini rate limit, 502/504 AI failure or timeout,
503 AI not configured.
# calai-ai
