# Training Cockpit — phone app (PWA)

Your live triathlon cockpit, rebuilt as an installable web app. Frontend is a static
PWA; a thin Cloudflare Pages Functions backend holds your API secrets and talks to
Strava and Google Calendar so nothing sensitive ever touches the phone.

**Host:** Cloudflare Pages (free). **Cost:** $0. **Access:** private — locked to you.

---

## The seven secrets (environment variables)

These live in **Cloudflare Pages → your project → Settings → Environment variables**.
You type them in; they are never in the code and never sent to anyone.

| Variable | Where it comes from |
|---|---|
| `STRAVA_CLIENT_ID` | Strava API app |
| `STRAVA_CLIENT_SECRET` | Strava API app |
| `STRAVA_REFRESH_TOKEN` | minted in step 5 below |
| `GOOGLE_CLIENT_ID` | Google Cloud OAuth client |
| `GOOGLE_CLIENT_SECRET` | Google Cloud OAuth client |
| `GOOGLE_REFRESH_TOKEN` | minted in step 5 below |
| `CAL_ID` | `8m24vu51l6rse8ckm4slje0g3s@group.calendar.google.com` (your B&G calendar) |

---

## Step-by-step

### 1. Put the code on GitHub
Create a new **private** repo (e.g. `training-cockpit`) and upload the contents of this
folder. Easiest without tools: on github.com → New repository → "uploading an existing
file" → drag in everything here (including the `functions` folder).

### 2. Create the Cloudflare Pages project
Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git** → pick the
repo. Build settings: **Framework preset = None**, **Build command = (blank)**,
**Build output directory = `/`**. Deploy. You'll get a URL like
`https://training-cockpit.pages.dev`.

### 3. Add the "known" env vars
In the project's **Settings → Environment variables**, add all five of the Client
ID/Secret values plus `CAL_ID` from the table above. Leave the two `..._REFRESH_TOKEN`
ones out for now. Save.

### 4. Point the OAuth apps at your real URL
- **Strava** (strava.com/settings/api): set **Authorization Callback Domain** to your
  bare Pages domain, e.g. `training-cockpit.pages.dev` (no https://, no path).
- **Google Cloud** (Credentials → your OAuth client): add an **Authorized redirect URI**:
  `https://training-cockpit.pages.dev/api/auth/google/callback`

### 5. Mint the refresh tokens (one time each)
Redeploy once so the new env vars take effect (Deployments → Retry deployment), then:
- Visit `https://<your-domain>/api/auth/strava` → approve → the page prints your
  **Strava refresh token**. Copy it into env var `STRAVA_REFRESH_TOKEN`.
- Visit `https://<your-domain>/api/auth/google` → approve (you'll see an "unverified app"
  screen — that's expected because it's your private test app; click through) → copy the
  printed value into `GOOGLE_REFRESH_TOKEN`.

Save the env vars and **redeploy** one more time. Open the site — the cockpit should now
load your live Strava + calendar data.

### 6. Lock it to just you (important — this is your health data)
The Pages URL is public by default. Close it off:
Cloudflare dashboard → **Zero Trust → Access → Applications → Add an application →
Self-hosted** → domain = your Pages domain → policy = **Allow**, rule = **Emails** =
your email. Now only you, after an email one-time-code, can open it. Free for personal use.

### 7. Install on your phone
Open the URL in Safari (iOS) or Chrome (Android) → **Share → Add to Home Screen**.
It launches full-screen like a native app and works offline for the shell.

---

## Notes & guardrails
- **No payment card** on Cloudflare = no possible charge. Stay on the free tier.
- Secrets live only in Cloudflare env vars. Never commit `.dev.vars`.
- `activity:read_all` (Strava) and `calendar.events.readonly` (Google) are **read-only** scopes.
- Data refreshes each time you open the app (pull-to-refresh / reopen).

## v2 backlog (not in this build)
- Add/remove calendar sessions from the phone (needs write scope + write endpoints).
- AI meal-plan "Suggest a week" and AI tailoring feedback (needs an LLM API key + endpoint).
- Push notifications for the daily read (currently delivered via the desktop scheduled task).
