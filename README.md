# Scholastic AI

A researcher-facing tool for chatting with your digital library. Sign in, build a personal library of PDFs, and have grounded conversations against them.

This repository contains the React Router v7 + TypeScript fullstack app for Scholastic AI, organised as a modular monolith with onion + ports/adapters on the backend.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | React Router v7 (React, SSR) |
| Language | TypeScript (strict) |
| Database | MongoDB Atlas via Mongoose + Typegoose |
| Validation | Zod |
| Styling | Tailwind CSS |
| Build | Vite |

## Prerequisites

- **Node.js >= 20**
- **npm >= 10** (ships with Node 20)
- A free **MongoDB Atlas** account (see the next section)

## Setup MongoDB (free Atlas account)

The app talks to a hosted MongoDB cluster. Atlas's free **M0** tier is more than enough for local development.

### 1. Create an Atlas account

1. Go to <https://www.mongodb.com/cloud/atlas/register> and sign up (Google/GitHub/email all work).
2. When asked which cluster type to start with, pick **M0 Free**. No card required.

### 2. Create a free cluster

1. Choose any cloud provider (AWS is fine) and the region closest to you.
2. Give the cluster a name (e.g. `Cluster0`) and click **Create**.
3. Wait ~3 minutes for the cluster to provision.

### 3. Create a database user

1. In the Atlas UI, open **Database Access** (left sidebar).
2. Click **Add New Database User**.
3. Pick **Password** authentication.
4. Set a username (e.g. `scholastic_dev_user`) and generate or set a password.
5. Under **Built-in Role**, choose **Read and write to any database**.
6. Click **Add User**.
7. **Copy the password somewhere safe — you cannot view it again later.**

### 4. Allow your IP to connect

1. Open **Network Access** (left sidebar).
2. Click **Add IP Address**.
3. For local dev, click **Allow Access from Anywhere** (`0.0.0.0/0`). For production, restrict this.
4. Confirm.

### 5. Grab your connection string

1. Open **Database** (left sidebar) and click **Connect** on your cluster.
2. Choose **Drivers** → **Node.js** → driver version 6 or higher.
3. Copy the connection string. It looks like:

   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?appName=Cluster0
   ```

4. Replace `<username>` and `<password>` with the credentials you created in step 3.

### 6. Configure the app's `.env`

Copy the example file and fill it in:

```bash
cp .env.example .env
```

Then open `.env` and set:

```dotenv
MONGODB_USERNAME=scholastic_dev_user
MONGODB_PASSWORD=your-password-here
MONGODB_URI=mongodb+srv://scholastic_dev_user:your-password-here@cluster0.xxxxx.mongodb.net/?appName=Cluster0
MONGO_DATABASE=scholastic-ai-dev
DEPLOYED_ENV=development
```

| Variable | What it is | Required |
|----------|-----------|----------|
| `MONGODB_URI` | Full Atlas connection string from step 5 (with username + password substituted in) | Yes |
| `MONGO_DATABASE` | Database name to use inside the cluster. Anything works; the database is created on first write | Yes |
| `MONGODB_USERNAME` | Convenience copy of the username (kept separately for tooling) | Optional |
| `MONGODB_PASSWORD` | Convenience copy of the password (kept separately for tooling) | Optional |
| `DEPLOYED_ENV` | One of `development`, `staging`, `production`. Defaults to `development` | Optional |
| `DEMO_LOGIN_EMAIL` | Email accepted by the demo sign-in flow. Defaults to `demo@scholastic.ai` | Optional |
| `DEMO_LOGIN_PASSWORD` | Password accepted by the demo sign-in flow. Defaults to `scholastic-demo` outside production; **required to be set explicitly in production** | Conditional |
| `SESSION_COOKIE_SECRET` | HMAC secret used to sign session cookies. Must be at least 32 characters | **Yes** |
| `SESSION_TTL_SECONDS` | Lifetime of an issued session cookie. Defaults to 7 days (`604800`) | Optional |

`.env` is gitignored — never commit it.

### How sign-in works in development

The MVP login flow accepts a single hardcoded credential pair pulled from the env (`DEMO_LOGIN_EMAIL` / `DEMO_LOGIN_PASSWORD`). On a successful login the server provisions a `User` aggregate (idempotent), signs an HMAC session token using `SESSION_COOKIE_SECRET`, and returns it as an `HttpOnly` cookie.

> **Gotcha — `DEPLOYED_ENV=production` over HTTP.** The cookie is issued with the `Secure` flag iff `DEPLOYED_ENV=production`. If you set `DEPLOYED_ENV=production` but access the server over `http://` (e.g. a misconfigured reverse proxy or a local prod-mode smoke test), the browser will silently drop the cookie and sign-in will appear to "succeed" but the next page load will redirect back to `/login`. Either keep `DEPLOYED_ENV=development` for HTTP work, or front the app with HTTPS.

### 7. Verify the connection

Once the app is running (see next section), hit:

```bash
curl http://localhost:5173/api/health
```

You should get a `200` with `{"status":"healthy", "database":"scholastic-ai-dev", ...}`. Anything else means the connection isn't reaching Atlas — re-check the IP allowlist and the password.

## Run the App

```bash
npm install
npm run dev
```

The dev server starts at <http://localhost:5173>.

- `/` → redirects to `/login`
- `/login` → renders the Scholastic AI sign-in page (visual only at this point)
- `/api/health` → health probe that pings MongoDB

## Available Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Start the dev server with HMR |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run typecheck` | TypeScript type checking (runs `react-router typegen` first) |
| `npm run test` | Run the vitest unit + integration suite once |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:coverage` | Vitest with the V8 coverage reporter |

## Project Structure

```
app/
├── root.tsx, entry.{client,server}.tsx, routes.ts   # React Router root + entries
├── backend.server/
│   ├── domain/         # Pure entities, value objects, repository ports (Zod-defined)
│   ├── application/    # Use-case services (the public API of the backend)
│   ├── infrastructure/ # Driving (controllers) + driven (repositories, gateways) adapters
│   ├── platform/       # Reusable backend code (Mongo client, base Repository, env utils)
│   └── main/           # Composition root — only place that calls `new` on infra classes
├── ui.client/          # React components, design system, client-only utilities
├── routes/             # Flat-routes for /pages and /api
└── shared/             # Cross-process kernel (currently empty)
```

For the full architecture (dependency rules, ring boundaries, conventions) see `harness/knowledge/repo-architecture/`.

## Documentation

The `harness/` directory holds the project's living documentation — domain models, code standards, ADRs, dev workflows. Start with:

- `harness/knowledge/repo-architecture/overview.md` — architecture entry point
- `harness/knowledge/domain/` — domain model and ubiquitous language per bounded context
- `harness/skills/` — step-by-step playbooks for common tasks
