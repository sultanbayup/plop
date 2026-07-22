# plop

Plop files directly into your Google Drive. Share a link, your friend drops files in — no account, no app install, no storage worries. Uses *your* Drive quota.

## How It Works

```
You (Owner)                          Your Friend (Uploader)
─────────────                        ──────────────────────
1. Sign in with Google               1. Open the link
2. Create an upload link             2. Enter password (if set)
3. Share the link                    3. Drag & drop files
4. Files land in your Drive ──────── 4. Done. No account needed.
```

## Setup

### 1. Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a project (or use existing)
3. Enable the **Google Drive API**
4. Go to **OAuth consent screen** → External → fill in app name ("Plop"), add your email as test user
5. Go to **Credentials** → Create OAuth 2.0 Client ID → Web application
6. Add redirect URI: `http://localhost:3000/api/auth/callback` (local) or `https://your-domain.com/api/auth/callback` (production)
7. Copy the Client ID and Client Secret

### 2. Environment

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/callback
ENCRYPTION_KEY=generate-with-below-command
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Generate encryption key:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000` → sign in with Google → create your first link.

## Usage

### Creating an upload link

1. Log in at `/admin`
2. Fill in a label (e.g. "Bali Photos")
3. Set an optional password
4. Click **Create Link**
5. Copy the URL and share it

### Uploading files

1. Open the link
2. Enter password if prompted
3. Drag & drop files or click to browse
4. Upload progress shown per file — even survives connection drops
5. Files land in a `Plop - [label]` folder in your Google Drive

### Managing links

- **Copy URL** — share the upload link
- **History** — see all uploads for that link
- **Disable** — turn off the link (doesn't delete files)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js (LTS) |
| Framework | Next.js 15 (App Router) |
| Language | TypeScript (strict) |
| Auth | `google-auth-library` + cookie session |
| Database | SQLite via Prisma ORM |
| Storage | Google Drive API |
| CSS | Plain CSS (utility classes) |
| Deploy | Docker + PM2 on VPS |

### Why These Choices

- **Next.js** — single deployable, built-in API routes
- **`google-auth-library`** — lighter than NextAuth (only one auth provider needed)
- **SQLite** — zero external dependencies, runs on the VPS disk
- **Google Drive API** — uploads go browser→Google directly, server never touches file bytes
- **No Tailwind** — couldn't install reliably in this npm environment; plain CSS keeps it simple

## Security

- **`drive.file` scope only** — Plop cannot read or list your existing Drive files
- Refresh tokens encrypted at rest (AES-256-GCM)
- Upload links use UUID v4 (unguessable)
- Passwords hashed with bcrypt (12 rounds)
- Rate limited: 5 password attempts per 15 minutes per IP
- Security headers set via middleware
- CORS restricted to app domain
- File type and size validation before upload

## Deployment

The repo includes a `Dockerfile` and `docker-compose.yml` for VPS deployment. Plop serves on port 3000 — use your reverse proxy (Traefik, Nginx, Caddy) to route traffic and handle HTTPS.

### Docker Compose (recommended)

```bash
docker compose up -d
```

### Manual

```bash
npm run build
npm start
```

Make sure `data/` is persisted between deploys — that's where the SQLite database lives.

## Development

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run db:generate  # Regenerate Prisma client
npm run db:push      # Push schema to SQLite
npm run db:studio    # Open Prisma Studio (DB GUI)
```

## Project Structure

```
src/lib/           — prisma, google auth, crypto, session, rate-limit
src/app/
  admin/           — login page + dashboard (links CRUD, history, token health)
  u/[slug]/        — upload page (password gate, drag-drop, resumable upload)
  api/             — auth, links, verify, upload-log endpoints
prisma/            — database schema
plan/              — PRD and developer context
data/              — SQLite database (gitignored)
```

## Limitations (v1)

- Single Google account (one owner)
- No file preview before upload
- No email notifications
- No custom branding
- No upload expiration dates
- No multiple owners / team support

## License

MIT
