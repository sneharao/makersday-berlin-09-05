# Run App Locally

Start the dev server and interact with the running app via a browser, either locally or in a cloud agent.

---

## Step 1 — Start the Dev Server

Before starting, check existing terminals for a dev server that is already running on port 5173. If one exists and is healthy, skip to Step 2.

```bash
npm run dev
```

Background this immediately (`block_until_ms: 0`). Wait for the `Local:` log line before proceeding — this is what Vite prints when it's ready:

```
➜  Local:   http://localhost:5173/
```

Use the await pattern `Local:\s+http://localhost:\d+` to detect readiness.

**Port conflicts:** If port 5173 is already in use, Vite auto-increments to the next available port (5174, 5175, etc.) and prints `Port 5173 is in use, trying another one...`. Always parse the actual port from the `Local:` log line rather than assuming 5173. To avoid surprises, kill the stale process on 5173 first:

```bash
lsof -ti:5173 | xargs kill -9 2>/dev/null
```

All required environment variables are already loaded from `.env` — do not attempt to set or source them manually.

---

## Step 2 — Open a Browser

Use **either** of the two available browser MCPs:

| MCP | Navigate tool |
|-----|---------------|
| **Playwright** (`user-playwright`) | `playwright_navigate` → `url: "http://localhost:5173"` |
| **Cursor Browser** (`cursor-ide-browser`) | `browser_navigate` → `url: "http://localhost:5173"` |

Use whichever is available in the current session. Use the port from Step 1 if it differed from 5173.

---

## Step 3 — Log In

The app redirects unauthenticated users to `/login`. The login form has two fields:

| Field name | Type | Value source |
|------------|------|--------------|
| `username` | email | `LOCAL_DEV_USER` from `.env` |
| `password` | password | `LOCAL_DEV_PASSWORD` from `.env` |

### Extracting credentials

The `.env` vars are **not** exported to the shell. Use `grep` to parse them:

```bash
grep '^LOCAL_DEV_USER=' .env | cut -d'=' -f2- | tr -d '"'
grep '^LOCAL_DEV_PASSWORD=' .env | cut -d'=' -f2- | tr -d '"'
```

### Filling the form

**Playwright MCP:**
```
playwright_fill  → selector: 'input[name="username"]', value: <LOCAL_DEV_USER>
playwright_fill  → selector: 'input[name="password"]', value: <LOCAL_DEV_PASSWORD>
playwright_click → selector: 'button[type="submit"]'
```

**Cursor Browser MCP:**
Take a `browser_snapshot`, then use the refs from the snapshot to fill username, fill password, and click the Login button.

### Confirming login

After clicking submit, wait 2–3 seconds for the redirect, then take a screenshot. A successful login redirects to the authenticated home page (the Reports list). If you still see the login page, check for an error message on the page.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Port already in use | Kill the existing process: `lsof -ti:5173 \| xargs kill -9` |
| Vite picked a different port | Read the `Local:` log line from the dev server terminal for the actual port |
| Login fails with "Invalid credentials" | Verify `LOCAL_DEV_USER` and `LOCAL_DEV_PASSWORD` are set in `.env` |
| `echo $LOCAL_DEV_USER` is empty | Expected — `.env` vars aren't shell-exported. Use `grep` to read them from `.env` |
| Browser cannot reach localhost | Ensure `npm run dev` has finished starting (look for the `Local:` log line) |
