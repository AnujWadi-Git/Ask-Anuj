# Ask Anuj

Voice-first AI representative for [anujwadi.com](https://anujwadi.com). Visitors click a small launcher, optionally introduce
themselves, then talk (or type) to an AI that answers **only** from approved professional content and offers verified links.

* Product brief, site inspection, verified free-tier limits, architecture: [docs/PRODUCT_BRIEF.md](docs/PRODUCT_BRIEF.md)
* Deploy to Cloudflare (free): [docs/DEPLOY.md](docs/DEPLOY.md)
* Add to the portfolio (one script tag): [docs/INTEGRATION.md](docs/INTEGRATION.md)
* Update what it knows: [docs/UPDATING_KNOWLEDGE.md](docs/UPDATING_KNOWLEDGE.md)
* Testing and known limitations: [docs/TESTING.md](docs/TESTING.md)

```bash
npm install
npm test          # unit + API tests (in-memory SQLite stand-in for D1, fake Workers AI)
npm run dev       # local server at http://localhost:8788/demo.html with the mock provider (no Cloudflare login)
```

Layout: `public/embed.js` (widget) · `public/admin/` (owner page) · `functions/` (Pages Functions API) ·
`knowledge/` (approved content, the only source of answers) · `schema.sql` (D1) · `test/`.
