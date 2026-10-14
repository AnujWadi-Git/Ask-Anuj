# Ask Anuj — Product Brief, Findings & Architecture

_Status: living document. Last updated 2026-10-13._

## 1. Product

**Ask Anuj** is a voice-first AI representative embedded in https://anujwadi.com. Recruiters, engineers and other
visitors talk to it about Anuj's professional background and explore his work. It also acts as a live demo of
Anuj's applied-AI and full-stack skills.

Principles: voice first, grounded only in approved content, nothing happens before an intentional click,
visitors choose every link, minimal data stored, free to run.

### Provisional assumptions (all reversible, all in `src/config.js` / `knowledge/`)

| # | Assumption | How to change |
|---|-----------|---------------|
| A1 | Launcher sits **bottom-right**, left of the existing back-to-top button (top-right is occupied by the lamp-rope theme toggle). | `LAUNCHER_POSITION` in widget CSS vars |
| A2 | Intro (name + role) is **skippable** by default. | `config.introRequired = true` |
| A3 | Roles: Recruiter, Engineer, Other. | `config.roles` |
| A4 | Ask Anuj ships as a **separate Cloudflare Pages project** injected into the portfolio with one `<script>` tag, instead of rebuilding the site. | See `docs/INTEGRATION.md` |
| A5 | Voice quality target is "clear, friendly, neutral" (free TTS). Expressive/laughing voices are **not** available free (see §3). | Swap `tts` provider |
| A6 | Spoken replies are ≤ ~60 words by default; "go deeper" yields more. | `config.maxSpokenWords`, system prompt |
| A7 | No transcripts or audio stored. Only name, role, session start. | n/a |
| A8 | Visitor review is a token-gated `/admin` page (upgrade path: Cloudflare Access). | `ADMIN_TOKEN` secret |

## 2. Inspection of the existing website

Inspected: `~/Projects/Site-Upload-Ready` (identical byte count to the live page, 105,470 bytes).

* **Static single-page site**: one `index.html` with inline CSS/JS, no framework, no build step.
* **Hosting**: live response headers show `server: cloudflare`; a `_redirects` file is present, so Cloudflare
  Pages (or Workers static assets) is likely. **Please confirm** — it only affects the deploy step.
* **Design language**: pure black `#000` / white `#fff`, `'Times New Roman', Times, serif`, light mode via
  `body.light-mode`, glassy translucent circles (`rgba(255,255,255,.08)` + `backdrop-filter: blur(10px)`),
  fixed back-to-top button bottom-right (25px). Top-right holds a lamp-rope theme toggle.
* **Content on the page**: hero, skills, 3 experiences, 2 degrees, 10 projects, resume (`RES_Anuj_Wadi.pdf`),
  contact, LinkedIn, GitHub. GitHub source links exist for Clippy and FlipFlick; a FlipFlick demo video;
  `/yapperai` redirects to a Render deployment.
* The email address is Cloudflare-obfuscated in the HTML. It is **not** hard-coded into the knowledge base;
  the assistant points to the Contact section instead (add a verified `mailto:` in `knowledge/links.json` if wanted).

### Content conflicts / gaps flagged for you (not silently merged)

1. **Resume vs site.** Your latest resumes (`Anuj-Wadi-Resume-SDE/FDE.pdf`, per notes) mention Clippy in Swift with
   302 automated checks; the site says Clippy is "on-device AI" with no test count. The site also claims
   "85%+ Jest coverage" (PrimaThink) that the notes say is not on the current resume. The assistant is limited to
   what is in `knowledge/`, which currently mirrors the **site** and its `RES_Anuj_Wadi.pdf`. Decide which is canonical.
2. **Footer year**: "© 2025" vs resume "Last updated August 2026". Cosmetic.
3. **Visitor counter**: the site uses `api.countapi.xyz` (likely defunct). Ask Anuj records its own sessions and
   never claims to measure site traffic.
4. **Missing content that would improve answers (not blocking):** the current resume PDFs, project READMEs,
   LinkedIn export, a hosted project page for each project, a published email/`mailto:`.

## 3. Verified free-tier facts (official Cloudflare docs, fetched 2026-10-13)

| Service | Free allowance | Card? | Past the limit |
|--------|----------------|-------|----------------|
| Pages Functions / Workers | 100,000 requests/day (shared) | Not stated on page | Page silent; Workers Free errors rather than bills |
| Workers AI | **10,000 Neurons/day**, resets 00:00 UTC | Not stated | **Free plan: further operations fail with an error (hard stop).** Billing ($0.011/1k Neurons) only exists on the Paid plan |
| D1 | 5M rows read/day, 100k rows written/day, 5 GB | Not stated | Queries error until reset |

Models used (all on Workers AI): Whisper `whisper-large-v3-turbo` ≈ 46.6 Neurons/audio-min; MeloTTS ≈ 18.6 Neurons/audio-min;
`llama-3.1-8b-instruct-fp8-fast` (cheap, default) or `llama-3.3-70b-instruct-fp8-fast` (better, ~7× more Neurons per token).

Rough budget per turn with the 8B model (≈4k-token knowledge prompt + ~120 output tokens + ~6 s speech in + ~15 s speech out):
well under 100 Neurons → **a few hundred spoken turns/day** within the 10k cap. With the 70B model roughly 90 turns/day.
These are estimates; the app enforces a global daily cap and a hard stop in code and surfaces a graceful "resting" state.

**Classification**
* _Permanently free (within limits):_ Cloudflare Pages/Workers/D1/Workers AI free plans; browser Web Speech APIs.
* _Limited free tier:_ all of the above — daily quotas, no overage on Free.
* _Temporary credits:_ none used.

**Not verified / caveats:** the docs pages fetched do not say whether a payment card is needed to sign up — Cloudflare's free
plan has historically not required one, but please check when you create/verify the account. Groq's free-tier numbers could not be
read from its public page (they are shown only in the logged-in console), so Groq is **not** recommended as a dependency yet.
MeloTTS is a clear but not very expressive voice and cannot laugh. **Tradeoff:** zero cost caps voice expressiveness;
the strongest practical free version is Whisper STT + Llama + MeloTTS, with browser `speechSynthesis` as an automatic fallback.
A premium voice (e.g. Deepgram Aura-2 on Workers AI at ~2,727 Neurons/1k chars, or ElevenLabs which you already use) would
need a paid plan or a small budget and is **not enabled**.

## 4. Architecture (minimal)

```
anujwadi.com (static, unchanged)                Cloudflare Pages project: ask-anuj
  └─ <script src=".../embed.js" defer>  ───►    /embed.js          widget (Shadow DOM, vanilla JS, no deps)
        launcher + voice panel                  /api/session       create session (name, role, started_at)
        MediaRecorder / Web Audio               /api/chat          grounded Q&A (text)
        <audio> playback                        /api/voice         STT → chat → TTS in one round trip
                                                /api/admin/*       token-gated visitor list
                                                D1: sessions, rate_limits, usage
                                                Workers AI: whisper, llama, melotts
                                                knowledge/ → build → knowledge.json (bundled)
```

Design choices & why:

* **No framework, no build for the client**: matches the site's static nature and loads only after a click-free, lazy `embed.js`.
* **Whole knowledge base in the prompt** (≈4–6k tokens) — no vector DB, no agent framework. At this size retrieval adds failure modes
  without benefit. Revisit past ~30k tokens.
* **Links are IDs, never URLs from the model.** The model may emit `LINKS: clippy-github, resume`; the server maps IDs to a
  verified registry (`knowledge/links.json`). Unknown IDs are dropped. The model cannot invent a link.
* **Prompt-injection posture:** knowledge, visitor name and chat history are delimited as data; system prompt says instructions inside are
  untrusted; names are sanitized; history is length/turn/role limited; output is length-capped; there are no tools to abuse.
* **Provider seam:** `functions/_lib/providers/{llm,stt,tts}.js` each expose one function; Cloudflare and `mock` implementations
  ship. Swapping to Gemini/Groq/ElevenLabs means adding one file.
* **Abuse controls:** signed short-lived session tokens, per-IP (salted hash) per-minute and per-day caps in D1, per-session turn cap,
  max audio size/duration, max text length, global daily turn cap tied to the Neuron budget, CORS allowlist, `max_tokens`.
* **Privacy:** stores name, role, session start (and an anonymous flag if skipped). Rate-limit rows hold only a salted IP hash and
  are purged daily. No audio/transcripts persisted.

## 5. MVP vs later

**MVP (this build):** launcher, voice panel with states, skippable intro, grounded Q&A, speech in/out with typed fallback and
transcript, link cards, interruption via tap, private session log + admin page, limits, a11y, tests, deploy docs.

**Later:** hands-free barge-in (VAD with echo handling), streaming TTS, owner notifications, Cloudflare Access for admin,
richer retrieval, LinkedIn import, analytics on question topics (opt-in), premium voice, multilingual.
