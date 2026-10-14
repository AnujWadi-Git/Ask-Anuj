# Testing and known limitations

## Automated (`npm test`, 23 tests)
Knowledge compile validation, link whitelisting (model cannot invent URLs), output parsing, name sanitisation, history limits, signed tokens
(tamper/expiry), session records contain only id/name/role/skipped/start time, auth required, grounded answer + "not covered" path,
Workers AI call shape and failure handling (fake `env.AI`), input limits, per-session / per-IP / global-Neuron limits,
CORS allow-list, admin auth + lockout. D1 is emulated with Node's built-in SQLite.

## Manual (performed locally against the mock provider, in the in-app browser)
Nothing requested/recorded on page load; launcher → intro with data notice; name+role and Skip paths; personalised greeting; starter chips;
link cards render and are never opened automatically; microphone **blocked** → clear message + typed fallback; real recording code
with a synthetic audio stream: listening → silence detection → WAV upload → answer → idle, mic track `ended`; **End while listening**
releases the mic; owner endpoint 401 without token; mobile (375×812) full-screen layout; light theme follows `body.light-mode`.

## NOT yet verified (needs your Cloudflare account / real devices)
* Real Workers AI responses (Whisper accepting the WAV, MeloTTS response format, Llama quality/latency). The code handles `{audio}` or a bare
  base64 string for TTS and falls back to the browser voice if TTS fails, but this is unproven until deployed.
* Real microphone on iOS Safari / Android Chrome / Firefox; autoplay unlock on iOS (implemented, untested).
* Actual Neuron cost per turn (estimated in `config.neurons`); check the Cloudflare dashboard after a few test turns and tune the cap.
* Screen-reader pass (ARIA roles, live regions, focus handling are implemented; no assistive-tech testing yet).

## Known limitations
* Voice: MeloTTS is clear but not expressive, and cannot laugh. Interruption works by tapping the mic/stop; hands-free barge-in
  while it is speaking is not implemented (echo risk).
* Turn-based: ~2–5 s latency per turn (STT → LLM → TTS), no streaming.
* Visitor names are self-reported and unverified. IP hashes are kept for rate limiting only, purged after the day.
* The admin page is token-protected, not identity-protected (see Cloudflare Access in DEPLOY.md).
