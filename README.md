# Sarvam MF Portal

A **Next.js** (App Router) app combining a Sarvam AI chatbot with an MF Portal
service desk:

- **Chat** (`/`) — streaming replies from Sarvam AI, in English or Indian
  languages. The bot also handles two in-chat flows:
  - **Raise a request** — say "I want to raise a service request" and it collects
    the fields (name, email, PAN, type, query) and logs it.
  - **Track a request** — say "track my request status", give a request number,
    and it reports the status with a reassuring message.
- **Service Request** (`/service`) — clients raise MF requests (Client Name,
  Email, PAN, request type, query) and get a tracking number with a 72-hour TAT
- **Email copy** — on submission, a copy of the request is emailed to the client
  (when SMTP is configured); the admin can be BCC'd via `ADMIN_EMAIL`
- **Status-change emails** — when an admin moves a request to a new status, the
  client is emailed the update with a reassuring message
- **Admin** (`/admin`) — dashboard listing all requests with status filters and
  one-click status transitions (Open → In Progress → Resolved), protected by
  **Auth.js** login

## Authentication

The admin area is gated with [Auth.js](https://authjs.dev) (NextAuth v5) using a
single admin account from the environment:

- `/admin` and the admin APIs (`GET /api/service-requests`,
  `PATCH /api/service-request/:requestNo`) require login.
- Chat and submitting a service request stay public.
- Log in at `/login` with `ADMIN_USERNAME` / `ADMIN_PASSWORD`.

> **Change the default password.** The repo ships with `admin` / `admin123` for
> local use — set a strong `ADMIN_PASSWORD` (and a fresh `AUTH_SECRET`) before
> deploying anywhere.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Add your API key to `.env` (Next.js loads it automatically):

   ```
   SARVAM_API_KEY=your-sarvam-api-subscription-key
   ```

3. Run the dev server:

   ```bash
   npm run dev
   ```

4. Open <http://localhost:3000>.

For a production build: `npm run build && npm start`.

## Configuration (env vars)

| Variable          | Default                    | Description                       |
| ----------------- | -------------------------- | --------------------------------- |
| `SARVAM_API_KEY`  | _(required)_               | Sarvam API subscription key       |
| `SARVAM_MODEL`    | `sarvam-30b`               | Chat model (`sarvam-30b`/`105b`)  |
| `SARVAM_BASE_URL` | `https://api.sarvam.ai/v1` | API base URL                      |
| `AUTH_SECRET`     | _(required)_               | Auth.js session-signing secret    |
| `ADMIN_USERNAME`  | _(required)_               | Admin login username              |
| `ADMIN_PASSWORD`  | _(required)_               | Admin login password              |
| `SMTP_HOST/PORT/USER/PASS/FROM` | _(optional)_ | SMTP for emailing request copies (unset = no email, submissions still work) |

## Project structure

```
auth.js                             Auth.js (NextAuth v5) config
middleware.js                       Redirects /admin to /login when logged out
app/
  layout.js                         Root layout + global CSS
  globals.css                       Styles
  page.js                           Chat UI (streaming)
  login/page.js                     Admin login form
  service/page.js                   Service-request form
  admin/page.js                     Admin dashboard (protected)
  api/
    auth/[...nextauth]/route.js     Auth.js handlers
    chat/route.js                   POST — streams Sarvam completions (SSE)
    request-types/route.js          GET  — dropdown options
    service-request/route.js        POST — create request
    service-request/[requestNo]/    GET (lookup) + PATCH (status, admin only)
    service-requests/route.js       GET  — list all (admin only)
lib/
  sarvam.js                         Sarvam config
  store.js                          Request types, validation, status messages, JSON persistence
  email.js                          Emails a request copy to the client (nodemailer/SMTP)
data/                               Auto-created request store (gitignored)
```

## Notes

- Requests are persisted to `data/service-requests.json` (a simple file store —
  swap `lib/store.js` for a real database when needed).
- The single admin account lives in env vars; swap the Credentials provider in
  `auth.js` for a real user store / OAuth provider when you need multiple users.

## Requirements

- Node.js 18.18+
