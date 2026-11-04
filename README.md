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
- Per-user AI limits: a daily scan quota and a per-minute burst limit
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
AI_DAILY_SCAN_LIMIT=20
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

### Mobile app (Expo, iOS + Android)
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
| POST/PUT/DELETE | /api/logs/:id | Create, edit or delete an entry |
| GET | /api/ai/usage | Today's AI scan quota |
| POST | /api/ai/analyze | `{ image?: dataURL, description?: string }` → nutrition estimate |

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
