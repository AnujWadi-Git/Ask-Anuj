# Deploying — all in the browser, nothing runs on your Mac

Everything uses Cloudflare's **free** plan and your existing GitHub repo. Do **not** click any "upgrade" or "Workers Paid" prompt:
on the Free plan Workers AI stops at 10,000 Neurons/day instead of billing.

## 1. Create the database (D1)
1. Cloudflare dashboard → **Storage & Databases → D1 SQL database → Create**. Name: `ask-anuj`.
2. Open it → **Console** tab → paste the full contents of [`schema.sql`](../schema.sql) → **Execute**.

## 2. Create the Pages project from GitHub
1. **Workers & Pages → Create → Pages → Connect to Git** → pick `AnujWadi-Git/Ask-Anuj` (authorise the Cloudflare GitHub app for that repo only).
2. Settings: Production branch `main` · Framework preset `None` · **Build command** `npm run build:knowledge` · **Build output directory** `public`.
3. Add environment variable `NODE_VERSION` = `22`. **Save and Deploy.** (Every future `git push` redeploys automatically.)

## 3. Bindings and secrets (Project → Settings)
* **Bindings → Add → D1 database** → variable name `DB` → select `ask-anuj`.
* **Bindings → Add → Workers AI** → variable name `AI`.
* **Variables and Secrets → Add** (type *Secret*, for Production **and** Preview):
  * `SESSION_SECRET` — any random string, 32+ characters.
  * `ADMIN_TOKEN` — your owner password, 20+ characters (save it in a password manager).
* **Variables** (plain): `AI_PROVIDER` = `cloudflare`.
* Then **Deployments → latest → Retry deployment** so the bindings take effect.

## 4. Check it
* Open `https://ask-anuj.pages.dev/demo.html` (or your project's `*.pages.dev` URL) → click **Ask Anuj**, start, type a question.
* `https://<project>.pages.dev/admin/` → enter `ADMIN_TOKEN` to see visitor sessions.
* Dashboard → **Workers AI** shows Neuron usage; the app stops itself at 8,500/day (`config.limits.globalDailyNeurons`).
* If your project URL isn't `ask-anuj.pages.dev`, use the real one in the script tag (see INTEGRATION.md).

## 5. Add it to anujwadi.com
See [INTEGRATION.md](INTEGRATION.md): one `<script>` line in your site's `index.html`, edited wherever you keep the site (GitHub web editor or Cloudflare).

Optional hardening: protect `/admin/*` and `/api/admin/*` with Cloudflare Access (Zero Trust, free up to 50 users) on top of the token.
