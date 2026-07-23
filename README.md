# Banter

Cohort communications for Hult — channels, DMs, threads, and notifications.

Banter supports **two sign-in methods**:

1. **Banter account** — email/password stored locally
2. **PM account** — Firebase Auth (same project as the PM tool), including GitHub

Either method can link to the PM tool through a shared **GitHub handle** (and/or matching email / Firebase UID).

### Firebase (PM) setup

Copy the PM web app Firebase config into `.env.local`:

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_PM_APP_URL=http://localhost:3001
```

Enable **Email/Password** and (optionally) **GitHub** providers in that Firebase project.

### Account linking

- On Banter signup, set your GitHub handle
- On PM Firebase login, GitHub username is captured automatically when using GitHub auth
- In the sidebar, use **Link** to attach/update your GitHub handle anytime
- **Open PM tool** deep-links to `{PM_URL}/u/{github}`

### PM → Banter handoff

After Firebase login in the PM app, redirect to:

```
https://banter.example/auth/pm?idToken=FIREBASE_ID_TOKEN&github=optionalHandle
```

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- Local JSON database (`data/banter.json`)
- Cookie sessions (JWT)

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), create an account, and start chatting.

Optional `.env.local`:

```bash
BANTER_AUTH_SECRET=replace-with-a-long-random-string
# Later, when linking the PM app:
# NEXT_PUBLIC_PM_APP_URL=http://localhost:3001
# PM_WEBHOOK_SECRET=shared-secret
```

## Features

- Channels (seeded: General, Announcements, Project 1, Backend Help, AI, Career, Random)
- Direct messages + user search
- Threads
- Mentions (`@name`)
- Notifications
- **Banterlina** — AI research assistant (`/app/banterlina`)
- Independent Banter accounts (no PM SSO required)

### Banterlina

Add an OpenAI-compatible key to `.env.local` for full answers:

```bash
OPENAI_API_KEY=sk-...
# optional overrides:
# BANTERLINA_MODEL=gpt-4o-mini
# BANTERLINA_BASE_URL=https://api.openai.com/v1
```

Without a key, Banterlina still opens and helps with a structured research checklist (offline mode).

## Future PM linking

When the PM auth story is known, keep Banter accounts and add:

- Deep links via `NEXT_PUBLIC_PM_APP_URL`
- Task alerts via `POST /api/webhooks/pm`
