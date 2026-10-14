# Deploying (Cloudflare Pages, free plan)

Everything below needs **your** Cloudflare login; nothing here has been deployed yet. All steps stay on free plans.
Do not click any "upgrade" / "Workers Paid" prompt: on the Free plan Workers AI **stops** at 10,000 Neurons/day instead of billing.

```bash
npm install
npx wrangler login                              # opens browser
npx wrangler d1 create ask-anuj                 # copy the printed database_id into wrangler.toml
npm run db:init:remote                          # creates the tables
npx wrangler pages project create ask-anuj --production-branch main
openssl rand -hex 32 | npx wrangler pages secret put SESSION_SECRET --project-name ask-anuj
openssl rand -hex 24 | tee /dev/stderr | npx wrangler pages secret put ADMIN_TOKEN --project-name ask-anuj   # note the printed token: it is your admin password
npm run deploy
```

Then open `https://ask-anuj.pages.dev/admin/` and enter the admin token.
The Workers AI (`AI`) and D1 (`DB`) bindings come from `wrangler.toml`.

Checks after deploy:
1. `curl -i -X POST https://ask-anuj.pages.dev/api/session -H 'Origin: https://evil.example' -d '{}'` → 403.
2. `curl -i https://ask-anuj.pages.dev/api/admin/sessions` → 401.
3. Dashboard → Workers AI usage shows Neurons increasing as you test; the app stops itself at 8,500/day (`config.limits.globalDailyNeurons`).

Domain: if you want a custom domain (e.g. `ask.anujwadi.com`) add it under Pages → Custom domains, then update `allowedOrigins`/`data-api` accordingly.
Optional hardening: protect `/admin/*` and `/api/admin/*` with Cloudflare Access (free for up to 50 users) in addition to the token.
