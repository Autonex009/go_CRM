# Deploying go-CRM to Railway

Two Railway services from this one repo, both built from Dockerfiles at the root:

| Service | Dockerfile       | Config file         | Listens on   |
| ------- | ---------------- | ------------------- | ------------ |
| `api`   | `Dockerfile.api` | `railway.api.json`  | `$PORT`      |
| `web`   | `Dockerfile.web` | `railway.web.json`  | `$PORT`      |

Postgres stays on Supabase. NATS/the worker is not deployed — the gateway does
not use it.

---

## 1. Prepare Supabase for a remote client

Use the **session-mode pooler** connection string, not the direct host:

```
postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require
```

- The direct host (`db.<ref>.supabase.co`) is IPv6-only — avoid the whole class
  of problem.
- Port **5432** on the pooler is session mode, which pgx's prepared statements
  need. If you use port **6543** (transaction mode) instead, you must append
  `&default_query_exec_mode=exec` or every second query fails.
- URL-encode `@`, `#`, `:` etc. in the password.

## 2. Create the project and the `api` service

```bash
npm i -g @railway/cli
railway login
railway init            # in D:\go_CRM — creates the project
railway add             # create an empty service, name it "api"
```

In the Railway dashboard, on the **api** service:

- **Settings → Config-as-code → Railway Config File**: `railway.api.json`
- **Settings → Networking**: Generate Domain (or attach `api.yourdomain.com`)
- **Settings → Region**: pick the region closest to your Supabase project
  (`Southeast Asia (Singapore)` for a Mumbai/Singapore Supabase). This is the
  single biggest latency lever you have — every request makes several DB round
  trips.

### api variables

```
DATABASE_URL=<the pooler URL from step 1>
JWT_SECRET=<openssl rand -base64 48>
JWT_ISSUER=go-crm
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=720h
APP_TIMEZONE=Asia/Kolkata
WEB_APP_URL=https://${{web.RAILWAY_PUBLIC_DOMAIN}}
OIDC_REDIRECT_BASE=https://${{api.RAILWAY_PUBLIC_DOMAIN}}/api/v1/auth/sso
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GOMEMLIMIT=384MiB
```

- `${{web.RAILWAY_PUBLIC_DOMAIN}}` is a Railway variable reference — it resolves
  once the `web` service has a domain, so create `web` before deploying `api`,
  or set the value again afterwards.
- **Set neither `GATEWAY_ADDR` nor `PORT`.** Railway provides `PORT` itself as
  long as you have not defined one, and healthchecks are performed against that
  same port; the gateway binds it. Defining either by hand is how you end up
  listening on a port nothing routes to ("Application failed to respond").
- `WEB_APP_URL` must match the SPA origin **exactly** (scheme + host, no trailing
  slash) or CORS silently blocks every authenticated call.
- `GOMEMLIMIT` at ~75% of your plan's memory makes Go's GC back off instead of
  getting OOM-killed under load.

## 3. Create the `web` service

```bash
railway add             # name it "web"
```

- **Settings → Config-as-code → Railway Config File**: `railway.web.json`
- **Settings → Networking**: Generate Domain
- **Same region as `api`.**

### web variables

```
PUBLIC_API_URL=https://${{api.RAILWAY_PUBLIC_DOMAIN}}
NODE_ENV=production
```

`PUBLIC_API_URL` is baked into the client bundle by Vite **at build time**.
Railway forwards service variables into a Dockerfile build only when the name is
declared with `ARG` in that stage — `Dockerfile.web` declares it, so setting the
service variable is enough. The build fails with an explicit error if it is
missing. Changing it later needs a redeploy, not just a restart.

## 4. Register the OAuth callbacks

In the Google and GitHub consoles, add:

```
https://<api-domain>/api/v1/auth/sso/google/callback
https://<api-domain>/api/v1/auth/sso/github/callback
```

## 5. Deploy

```bash
git add -A && git commit -m "Add Railway deployment config"
git push
```

Connect both services to the repo (**Settings → Source**) and Railway builds on
push. The `watchPatterns` in each config file mean a backend-only commit does not
rebuild the frontend, and vice versa.

Migrations run automatically: `railway.api.json` sets a **pre-deploy command**
that runs `migrate ... up` against `$DATABASE_URL` before the new container takes
traffic. If the migration fails, the deploy is aborted and the old version keeps
serving. (If the field is ignored by your Railway plan, set the same command in
**Settings → Deploy → Pre-Deploy Command**.)

## 6. Verify

```bash
curl -i https://<api-domain>/healthz                     # -> 200 ok
curl -sH 'Accept-Encoding: gzip' -o /dev/null -w '%{size_download}\n' \
     https://<api-domain>/api/v1/dashboard/summary        # -> gzipped
curl -I https://<web-domain>/app/login                    # -> 200, SSR shell
```

---

## What makes the build and the runtime fast

**Build**

- Both Dockerfiles are multi-stage and ordered so dependency layers are cached:
  the Go image only re-downloads modules when `go.mod`/`go.sum` change, the web
  image only re-installs when a `package.json` changes. Source edits rebuild just
  the last layer.
- `--mount=type=cache` on the Go module cache, the Go build cache, and the pnpm
  store — those survive between Railway builds on the same service. Every cache
  mount carries an explicit `id=`; Railway's Metal builder rejects the Dockerfile
  outright without one ("flag ... is missing an id argument").
- The web install is filtered to `@go-crm/web...`, so the Expo/React Native tree
  in `apps/mobile` is never downloaded.
- `.dockerignore` keeps `node_modules`, `dist`, `.git` and `EXPLAINER.md` out of
  the build context entirely.

**Runtime**

- Go binary: `CGO_ENABLED=0 -trimpath -ldflags="-s -w"` on a ~8 MB alpine base.
  Small image, fast pull, fast cold start.
- A production-only second install for the web image — no TypeScript, no Astro
  CLI, no `@astrojs/check` in the running container.
- gzip on API responses (`middleware.Compress`), which is where the list
  endpoints spend their bytes.
- The pgx pool is already tuned for a pooled remote Postgres (short idle
  lifetime, health checks) in `services/pkg/database/pool.go`. `maxConns = 8` is
  the right starting point for one replica against Supavisor; raise it in that
  file only after you see wait time in the pool, and keep the total across
  replicas under your Supabase connection limit.
- Astro is `output: "hybrid"` — marketing pages are prerendered and served as
  static files by the standalone server; only `/app/*` is SSR.

**The next wins, when you need them**

The SPA ships as one chunk — `AppRoot` is ~323 kB raw / ~92 kB gzipped, so every
`/app/*` visitor downloads leads, deals, quotes, invoices and dashboards before
seeing the login form. Splitting the route components in
`apps/web/src/app/routes` behind `React.lazy` + `Suspense` is a contained change
and the largest first-paint improvement available.

Right now the browser talks to two origins, so every non-simple API call pays a
CORS preflight (cached 600s). Putting both behind one domain — `/` to `web`,
`/api` to `api` — removes preflights entirely and lets you drop `WEB_APP_URL`
CORS handling. That is a routing change, not a code change, once you own a domain.

## Scaling up

- Horizontal: raise `numReplicas` in `railway.*.json`. The gateway is stateless
  (JWT + DB), so replicas need no coordination — just watch the total DB
  connection count (`numReplicas × maxConns`).
- The pre-deploy migration runs once per deploy regardless of replica count.
