# Azentoo

An AI receptionist for small businesses: it answers phone calls and website conversations, books appointments,
captures leads, runs outbound call campaigns, and connects to the apps a business already uses. One workspace per
business, plus a platform admin panel for whoever runs the deployment.

This is a Next.js rebuild of the original app.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
```

The first account you create at `/login` becomes the platform super-admin (or, with `ADMIN_EMAILS` set, only those
addresses once confirmed). Data lives in Postgres when `DATABASE_URL` is set, otherwise in `data/db.json` — delete the
`data/` folder to start fresh.

Without any keys, receptionists answer from an offline preview. Add `XAI_API_KEY` or `OPENAI_API_KEY` (in
`.env.local` or Admin → Configuration) to get real replies. Phone calls also need `OPENAI_API_KEY` and a public
`APP_URL`. See `.env.example`.

| Command                                 | What it does                                             |
| --------------------------------------- | -------------------------------------------------------- |
| `npm run dev`                           | Dev server with the live-call relay (`node server.mjs`)  |
| `npm run dev:next`                      | Plain `next dev`, no relay (calls use the slow fallback) |
| `npm run build` / `npm run start`       | Production build / server with the relay                 |
| `npm run admin:grant -- <email> super`  | Promote an account (stop the server first)               |
| `npm run typecheck`                     | `tsc --noEmit`                                           |
| `npm run test:api`                      | End-to-end check of every save path against a running app (`BASE=http://localhost:3000`) |
| `npm run test:booking`                  | Booking, double-booking, moves and races through the real model (needs an AI key on the server) |
| `npm run test:orders`                   | Cafe ordering, menu prices, card-detail refusal and restaurant tables through the real model |

### Demo mode

`DEMO_MODE=true` turns the deployment into a read-only showroom with one-click accounts:

- business owner: `demo@azentoo.app` / `demo1234`
- platform admin: `demo-admin@azentoo.app` / `demo1234`

## Where things are

```
server.mjs                 Custom server: Next.js + WebSocket relay (Twilio/Plivo μ-law ↔ OpenAI Realtime)
src/app/                   Pages: / (landing), /login, /app/* (workspace), /admin/*, /w/[agentId], /f/[formId]
src/app/api/fn/[group]/[name]   The single route every server function goes through
src/app/api/voice/*        Carrier webhooks and the relay's internal routes
src/app/api/billing/stripe Stripe webhook (plan subscriptions)
src/app/pay/thanks         Where customers land after paying an order on the business's own Stripe
src/app/api/connect/*      Connector OAuth (Google, Microsoft, Salesforce)
src/app/api/auth/*         Email/password and Google sign-in; /api/admin/confirm for ADMIN_EMAILS
src/server/api/*           Server functions, grouped (agents, calling, contacts, admin, …)
src/server/                Store, auth, settings, AI engine, tools, jobs, telephony
src/components/            UI (app shell, studio, orb, landing, …)
public/docs/               The operator and user guide, served at /docs
scripts/                   admin:grant and the test:api / test:booking / test:orders end-to-end checks
```

Full documentation — including deployment, carrier setup, and every setting — is at `/docs` once the app is running.

## Deploying

Run **one** always-on Node process (`npm run build && npm run start`) and set `DATABASE_URL` (Postgres), `APP_URL`,
`CREDENTIAL_ENCRYPTION_KEY`, `OPENAI_API_KEY`, and `ADMIN_EMAILS`. Without Postgres, give it a persistent disk for
`DATA_DIR`. Serverless hosts can't hold a phone call's WebSockets. Point Twilio's "A call comes in" webhook at `https://<app>/api/voice/inbound` and Plivo's answer URL
at `https://<app>/api/voice/plivo`. Health check: `GET /api/health`.

### Frontend on Vercel, backend on Render

Render runs the whole app (store, scheduler, call relay); Vercel serves the pages and proxies every `/api/*` request to
Render, so the browser only ever talks to the Vercel domain and session cookies work as usual.

1. **Render** — New → Blueprint, pick this repo (`render.yaml`). Fill in the secrets it asks for. Set
   `APP_URL` to the **Vercel** URL (OAuth redirects, carrier webhooks and email links point there and get proxied) and
   `VOICE_STREAM_ORIGIN` to the Render URL (carriers' WebSockets can't go through Vercel).
2. **Vercel** — import the repo and set only `API_ORIGIN=https://<your-service>.onrender.com`. No database or API keys
   here: this deploy keeps no data and never opens the database.
3. Point carrier webhooks and OAuth redirect URIs at the Vercel URL, as above.

Use a Render plan that doesn't sleep: a sleeping backend drops calls and stops the scheduler.
