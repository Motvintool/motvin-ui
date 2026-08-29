# Firebase setup for URL Convert limits

## 1) Create Firebase project
- Enable **Authentication** → **Sign-in method** → **Google**.
- Create **Firestore Database** (production mode).

## 1.1) Enable stable auth (required)
- Enable **Authentication** → **Sign-in method** → **Google**.
- URL Beta now requires Google sign-in for stable per-user limits.
- This prevents reset after browser cache/site-data clear.

## 2) Add web app config
Create `.env` from `.env.example` and fill values:

- `FIREBASE_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_APP_ID`
- `FIREBASE_MESSAGING_SENDER_ID`
- `FIREBASE_STORAGE_BUCKET`
- `GA_MEASUREMENT_ID` (optional, for Google Analytics 4)

For Vercel, add the same keys in Project Settings → Environment Variables.

## 2.2) Connect Google Analytics 4 (free standard GA4)
- Create a **GA4 property** in Google Analytics.
- In **Admin → Data Streams → Web**, copy your **Measurement ID** (format: `G-XXXXXXXXXX`).
- Add it to `.env` as `GA_MEASUREMENT_ID=G-XXXXXXXXXX`.
- The app automatically loads GA4 on production hosts.
- Localhost is skipped by default to keep test traffic out of analytics.
- If you want to test locally, set `GA_ENABLE_LOCAL=true`.

## 2.1) If using VS Code Live Server (important)
- Live Server does **not** inject `.env` variables automatically.
- For Live Server testing, define runtime values before the app script, for example:

```html
<script>
	window.__APP_ENV__ = {
		FIREBASE_API_KEY: "...",
		FIREBASE_AUTH_DOMAIN: "...",
		FIREBASE_PROJECT_ID: "...",
		FIREBASE_APP_ID: "...",
		FIREBASE_MESSAGING_SENDER_ID: "...",
		FIREBASE_STORAGE_BUCKET: "...",
		GA_MEASUREMENT_ID: "G-XXXXXXXXXX"
	};
</script>
```

- Or serve the built files from `dist/motvin`.

## 3) Firestore rules
Deploy rules from `firestore.rules`:

```bash
firebase deploy --only firestore:rules
```

## 4) Data model
Collection: `urlBetaDailyCredits`

Document id:
- `${uid}_${yyyy-mm-dd}`

Document fields:
- `uid` (string)
- `day` (string)
- `used` (number)
- `limit` (number)
- `createdAtMs` (number)
- `updatedAtMs` (number)

## 5) Behavior in app
- URL Convert credits are enforced at `50/day`.
- App tries Firebase first.
- If Firebase is not configured/unavailable, app falls back to local storage.
