/*! Ask Anuj — voice-first AI representative widget. Vanilla JS, Shadow DOM, no dependencies.
 *
 * Embed on a page with:
 *   <script src="https://<ask-anuj-host>/embed.js" defer></script>
 * Optional attributes: data-intro-required="true", data-api="https://...", data-wait-for-class="content-loaded"
 *
 * Privacy/behaviour contract: nothing is spoken, recorded, or fetched until the visitor clicks the launcher;
 * the microphone is only opened while "listening"; ending the session stops mic and playback; links are
 * never opened automatically.
 */
(() => {
  if (window.__askAnuj) return;
  window.__askAnuj = true;

  const script = document.currentScript;
  const API = ((script && script.dataset.api) || (script && script.src && new URL(script.src).origin) || '').replace(/\/$/, '');
  const INTRO_REQUIRED = !!script && script.dataset.introRequired === 'true';
  const WAIT_CLASS = script && script.dataset.waitForClass !== undefined ? script.dataset.waitForClass : 'content-loaded';
  const MAX_TEXT = 500;

  const ROLES = [['recruiter', 'Recruiter'], ['engineer', 'Engineer'], ['other', 'Something else']];
  const STARTERS = ['What has Anuj built?', 'Tell me about his experience', 'Where can I see his resume?'];
  const STATE_TEXT = {
    idle: 'Tap the mic and ask me anything',
    listening: 'Listening… tap when you are done',
    processing: 'Thinking…',
    speaking: 'Speaking… tap the mic to interrupt',
    error: 'Something went wrong',
  };

  const ICON = {
    mic: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3z"/><path d="M19 11a7 7 0 0 1-14 0M12 18v3"/></svg>',
    stop: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/></svg>',
    send: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    vol: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/></svg>',
    mute: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>',
    wave: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4"/></svg>',
    ext: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
  };

  const CSS = `
:host{all:initial}
*{box-sizing:border-box}
.root{--bg:rgba(10,10,10,.94);--fg:#fff;--muted:rgba(255,255,255,.62);--line:rgba(255,255,255,.2);--glass:rgba(255,255,255,.08);--glass-h:rgba(255,255,255,.16);--orb1:#fff;--orb2:#9a9a9a;--err:#ff9b94;--btn-fg:#000;--btn-bg:#fff;
  font-family:'Times New Roman',Times,serif;color:var(--fg);font-size:16px;line-height:1.45}
.root[data-theme=light]{--bg:rgba(255,255,255,.96);--fg:#000;--muted:rgba(0,0,0,.6);--line:rgba(0,0,0,.2);--glass:rgba(0,0,0,.06);--glass-h:rgba(0,0,0,.12);--orb1:#3a3a3a;--orb2:#000;--err:#b3261e;--btn-fg:#fff;--btn-bg:#000}
svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;flex:none}
button{font:inherit;color:inherit;cursor:pointer}
:focus-visible{outline:2px solid var(--fg);outline-offset:2px}
[hidden]{display:none!important}

.launcher{position:fixed;right:84px;bottom:25px;z-index:1001;height:46px;padding:0 18px 0 14px;display:flex;align-items:center;gap:8px;
  border-radius:23px;border:1px solid var(--line);background:var(--glass);color:var(--fg);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);
  letter-spacing:.3px;font-size:16px;opacity:0;visibility:hidden;transform:translateY(10px);transition:opacity .3s,transform .3s,background .3s}
.launcher.show{opacity:1;visibility:visible;transform:none}
.launcher:hover{background:var(--glass-h);transform:translateY(-3px)}
.launcher .dot{width:7px;height:7px;border-radius:50%;background:var(--fg);opacity:.85}
@media(max-width:480px){.launcher{right:80px;padding:0 14px 0 12px}}

.panel{position:fixed;right:25px;bottom:85px;z-index:1002;width:390px;max-width:calc(100vw - 24px);height:min(640px,calc(100dvh - 140px));display:flex;flex-direction:column;
  background:var(--bg);border:1px solid var(--line);border-radius:18px;backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);box-shadow:0 18px 60px rgba(0,0,0,.45);overflow:hidden;
  animation:rise .25s ease both}
@keyframes rise{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
@media(max-width:600px){.panel{inset:0;right:0;bottom:0;width:100%;max-width:none;height:100dvh;border-radius:0;border:0;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)}}

header{display:flex;align-items:center;justify-content:space-between;padding:14px 16px 10px;border-bottom:1px solid var(--line)}
.brand{font-size:11px;letter-spacing:2px;text-transform:uppercase;color:var(--muted)}
.brand b{display:block;font-size:18px;letter-spacing:.2px;text-transform:none;color:var(--fg);font-weight:400}
.hbtns{display:flex;gap:6px}
.pill{display:inline-flex;align-items:center;gap:6px;height:34px;padding:0 12px;border-radius:17px;border:1px solid var(--line);background:var(--glass);font-size:14px}
.pill:hover{background:var(--glass-h)}
.pill[aria-pressed=true]{background:var(--fg);color:var(--btn-fg)}

.body{flex:1;overflow-y:auto;overscroll-behavior:contain;padding:16px}
.footnote{padding:8px 16px 12px;font-size:11px;color:var(--muted);text-align:center;letter-spacing:.2px}

/* intro */
.intro h2{font-weight:400;font-size:26px;margin:4px 0 6px}
.intro p{color:var(--muted);margin:0 0 14px}
label{display:block;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);margin:14px 0 6px}
input[type=text]{width:100%;height:44px;padding:0 14px;border-radius:12px;border:1px solid var(--line);background:var(--glass);color:var(--fg);font:inherit;font-size:16px}
input::placeholder{color:var(--muted)}
.roles{display:flex;gap:8px;flex-wrap:wrap}
.chip{height:38px;padding:0 14px;border-radius:19px;border:1px solid var(--line);background:var(--glass);font-size:15px}
.chip:hover{background:var(--glass-h)}
.chip[aria-checked=true]{background:var(--fg);color:var(--btn-fg);border-color:var(--fg)}
.notice{margin-top:16px;padding:10px 12px;border:1px solid var(--line);border-radius:12px;font-size:13px;color:var(--muted)}
.actions{display:flex;align-items:center;gap:14px;margin-top:18px}
.primary{height:46px;padding:0 26px;border-radius:23px;border:0;background:var(--btn-bg);color:var(--btn-fg);font-size:16px}
.primary:disabled{opacity:.4;cursor:not-allowed}
.link{background:none;border:0;padding:6px;color:var(--muted);text-decoration:underline;font-size:15px}
.err{color:var(--err);font-size:14px;margin-top:10px}

/* stage */
.stage{display:flex;flex-direction:column;align-items:center;padding:6px 0 4px}
.orb{--level:0;position:relative;width:76px;height:76px;border-radius:50%;background:radial-gradient(circle at 35% 30%,var(--orb1),var(--orb2));
  box-shadow:0 0 0 0 var(--line);transition:transform .08s linear}
.orb::before,.orb::after{content:"";position:absolute;inset:-10px;border-radius:50%;border:1px solid var(--line);opacity:0}
.orb[data-state=listening]{transform:scale(calc(1 + var(--level)*.35))}
.orb[data-state=listening]::before{opacity:.9;animation:ring 1.6s ease-out infinite}
.orb[data-state=processing]{animation:spin 1.1s linear infinite;background:conic-gradient(from 0deg,var(--orb1),var(--orb2),var(--orb1));-webkit-mask:radial-gradient(circle,transparent 30%,#000 32%);mask:radial-gradient(circle,transparent 30%,#000 32%)}
.orb[data-state=speaking]{animation:breathe 1.2s ease-in-out infinite}
.orb[data-state=speaking]::before{opacity:.8;animation:ring 1.4s ease-out infinite}
.orb[data-state=speaking]::after{opacity:.5;animation:ring 1.4s .5s ease-out infinite}
.orb[data-state=error]{background:radial-gradient(circle at 35% 30%,var(--err),#4a1512)}
@keyframes ring{from{transform:scale(.95);opacity:.8}to{transform:scale(1.5);opacity:0}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes breathe{50%{transform:scale(1.08)}}
.status{margin-top:14px;font-size:13px;letter-spacing:.6px;color:var(--muted);text-align:center;min-height:20px}
.status.bad{color:var(--err)}

.caption{margin:12px 0 4px;font-size:18px;line-height:1.4;text-align:center;min-height:30px;overflow-wrap:anywhere}
.heard{margin:8px 0 0;font-style:italic;color:var(--muted);font-size:14px;text-align:center;overflow-wrap:anywhere}
.cards{display:grid;gap:8px;margin-top:14px}
.card{display:flex;align-items:center;gap:12px;padding:10px 12px;border:1px solid var(--line);border-radius:12px;background:var(--glass);color:inherit;text-decoration:none}
.card:hover{background:var(--glass-h)}
.card .t{flex:1;min-width:0}
.card .l{display:block;font-size:16px}
.card .h{display:block;font-size:12px;color:var(--muted);letter-spacing:.3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.card .k{font-size:10px;letter-spacing:1.4px;text-transform:uppercase;color:var(--muted)}
.starters{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:14px}
.banner{margin-top:12px;padding:10px 12px;border:1px solid var(--err);border-radius:12px;color:var(--err);font-size:14px}
.banner button{margin-left:8px;background:none;border:0;color:inherit;text-decoration:underline;padding:0}

.transcript{margin-top:14px;border-top:1px solid var(--line);padding-top:10px;display:grid;gap:10px;font-size:15px}
.msg b{display:block;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);font-weight:400}
.msg.u{color:var(--muted)}

.dock{border-top:1px solid var(--line);padding:12px 16px 4px}
.controls{display:flex;align-items:center;justify-content:center;gap:14px}
.round{width:46px;height:46px;border-radius:50%;border:1px solid var(--line);background:var(--glass);display:grid;place-items:center}
.round:hover{background:var(--glass-h)}
.round[aria-pressed=true]{background:var(--fg);color:var(--btn-fg)}
.round:disabled{opacity:.35;cursor:not-allowed}
.mic{width:64px;height:64px;background:var(--btn-bg);color:var(--btn-fg);border:0}
.mic:hover{background:var(--btn-bg);opacity:.9}
.mic svg{width:26px;height:26px}
.mic[data-active=true]{box-shadow:0 0 0 6px var(--line)}
.sub{display:flex;gap:8px;justify-content:center;margin:10px 0 2px;flex-wrap:wrap}
.typed{display:flex;gap:8px;margin-top:10px}
.typed input{flex:1;height:44px}
.typed button{width:44px;height:44px}

@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
`;

  // ---------- helpers ----------
  const el = (tag, props = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === 'class') n.className = v;
      else if (k === 'html') n.innerHTML = v; // only ever called with constant ICON strings
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else if (v === true) n.setAttribute(k, '');
      else if (v !== false && v != null) n.setAttribute(k, v);
    }
    for (const k of kids) if (k != null) n.append(k.nodeType ? k : document.createTextNode(k));
    return n;
  };

  const micSupported = () =>
    !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && (window.AudioContext || window.webkitAudioContext));

  function toWavBase64(samples, inRate) {
    const outRate = 16000;
    const ratio = inRate / outRate;
    const n = Math.floor(samples.length / ratio);
    const pcm = new Int16Array(n);
    for (let i = 0; i < n; i++) {
      const a = Math.floor(i * ratio), b = Math.min(samples.length, Math.floor((i + 1) * ratio));
      let sum = 0;
      for (let j = a; j < b; j++) sum += samples[j];
      const v = Math.max(-1, Math.min(1, b > a ? sum / (b - a) : samples[a] || 0));
      pcm[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
    }
    const buf = new ArrayBuffer(44 + n * 2), dv = new DataView(buf);
    const w = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); w(8, 'WAVEfmt '); dv.setUint32(16, 16, true);
    dv.setUint16(20, 1, true); dv.setUint16(22, 1, true); dv.setUint32(24, outRate, true); dv.setUint32(28, outRate * 2, true);
    dv.setUint16(32, 2, true); dv.setUint16(34, 16, true); w(36, 'data'); dv.setUint32(40, n * 2, true);
    new Int16Array(buf, 44).set(pcm);
    const bytes = new Uint8Array(buf);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }

  // Opens the mic (permission prompt happens here), records until silence / manual stop / abort, ALWAYS releases the mic.
  async function startRecording({ onLevel }) {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } });
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = new AC();
    if (ctx.resume) await ctx.resume();
    const src = ctx.createMediaStreamSource(stream);
    const proc = ctx.createScriptProcessor(4096, 1, 1);
    const chunks = [];
    const t0 = performance.now();
    let firstSpeech = -1, lastVoice = t0, floor = 0.01, finished = false, resolveFn;
    const done = new Promise((r) => { resolveFn = r; });

    const finish = (reason) => {
      if (finished) return;
      finished = true;
      try { proc.disconnect(); src.disconnect(); } catch { /* already disconnected */ }
      stream.getTracks().forEach((t) => t.stop());
      ctx.close().catch(() => {});
      onLevel(0);
      let samples = new Float32Array(0);
      if (firstSpeech >= 0) {
        const from = Math.max(0, firstSpeech - 3);
        const used = chunks.slice(from);
        samples = new Float32Array(used.reduce((n, c) => n + c.length, 0));
        let o = 0;
        for (const c of used) { samples.set(c, o); o += c.length; }
      }
      const seconds = samples.length / ctx.sampleRate;
      resolveFn({ reason, seconds, wav: seconds > 0.4 ? toWavBase64(samples, ctx.sampleRate) : null });
    };

    proc.onaudioprocess = (e) => {
      if (finished) return;
      const d = e.inputBuffer.getChannelData(0);
      chunks.push(new Float32Array(d));
      let s = 0;
      for (let i = 0; i < d.length; i++) s += d[i] * d[i];
      const rms = Math.sqrt(s / d.length);
      const now = performance.now();
      if (chunks.length <= 6) floor = Math.min(floor, Math.max(rms, 0.002));
      const threshold = Math.max(0.012, floor * 3);
      onLevel(Math.min(1, rms * 8));
      if (rms > threshold) { if (firstSpeech < 0) firstSpeech = chunks.length - 1; lastVoice = now; }
      else if (firstSpeech >= 0 && now - lastVoice > 1400) finish('silence');
      if (firstSpeech < 0 && now - t0 > 8000) finish('nospeech');
      if (now - t0 > 16000) finish('max');
    };
    src.connect(proc);
    proc.connect(ctx.destination);
    return { done, stop: () => finish('manual'), cancel: () => { firstSpeech = -1; finish('cancel'); } };
  }

  // ---------- widget ----------
  function init() {
    const host = el('div', { id: 'ask-anuj-root' });
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.append(el('style', {}, CSS));
    const root = el('div', { class: 'root', 'data-theme': 'dark' });
    shadow.append(root);
    document.body.append(host);

    const syncTheme = () => { root.dataset.theme = document.body.classList.contains('light-mode') ? 'light' : 'dark'; };
    syncTheme();
    new MutationObserver(syncTheme).observe(document.body, { attributes: true, attributeFilter: ['class'] });

    const launcher = el('button', { class: 'launcher', type: 'button', 'aria-haspopup': 'dialog', 'aria-label': 'Open Ask Anuj, a voice assistant that talks about Anuj\'s work' },
      el('span', { class: 'dot', 'aria-hidden': 'true' }), 'Ask Anuj');
    root.append(launcher);

    const reveal = () => launcher.classList.add('show');
    if (!WAIT_CLASS || document.body.classList.contains(WAIT_CLASS)) reveal();
    else {
      const obs = new MutationObserver(() => { if (document.body.classList.contains(WAIT_CLASS)) { reveal(); obs.disconnect(); } });
      obs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
      setTimeout(() => { reveal(); obs.disconnect(); }, 12000);
    }

    // ----- session state (memory only) -----
    let panel = null, session = null, state = 'idle', ctl = null, rec = null;
    let transcript = [], muted = false, autoListen = false, showTranscript = false, showTyped = false;
    let lastText = '', speechRun = 0, canMic = micSupported(), bannerMsg = '';
    const audio = new Audio();
    audio.preload = 'auto';

    const SILENT = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=';
    const unlockAudio = () => { try { audio.src = SILENT; const p = audio.play(); if (p) p.catch(() => {}); } catch { /* ignore */ } };

    const stopSpeaking = () => {
      speechRun++;
      try { audio.pause(); audio.removeAttribute('src'); audio.load(); } catch { /* ignore */ }
      if ('speechSynthesis' in window) speechSynthesis.cancel();
    };
    const abortNetwork = () => { if (ctl) { ctl.abort(); ctl = null; } };

    function endSession() {
      abortNetwork();
      stopSpeaking();
      if (rec) { rec.cancel(); rec = null; }
      session = null; transcript = []; state = 'idle'; bannerMsg = ''; lastText = '';
      showTranscript = false; showTyped = false; autoListen = false;
      if (panel) { panel.remove(); panel = null; }
      launcher.hidden = false;
      launcher.focus();
    }

    // Safety: never keep the mic or audio alive if the page is hidden/closed.
    window.addEventListener('pagehide', () => { if (rec) rec.cancel(); stopSpeaking(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && rec) rec.cancel(); });

    const api = async (path, body) => {
      abortNetwork();
      ctl = new AbortController();
      const my = ctl;
      let res;
      try {
        res = await fetch(API + path, {
          method: 'POST', signal: my.signal,
          headers: { 'Content-Type': 'application/json', ...(session ? { Authorization: 'Bearer ' + session.token } : {}) },
          body: JSON.stringify(body),
        });
      } catch (e) {
        if (e.name === 'AbortError') throw e;
        const err = new Error('I could not reach the server. Please check your connection and try again.'); err.code = 'network'; throw err;
      }
      if (ctl === my) ctl = null;
      let data = null;
      try { data = await res.json(); } catch { /* non-json */ }
      if (!res.ok) {
        const err = new Error((data && data.message) || 'Something went wrong.');
        err.code = (data && data.error) || 'http_' + res.status; err.status = res.status; throw err;
      }
      return data;
    };

    // ----- rendering -----
    const setLevel = (v) => { const o = panel && panel.querySelector('.orb'); if (o) o.style.setProperty('--level', v.toFixed(2)); };

    function setState(next, text) {
      state = next;
      if (!panel) return;
      const orb = panel.querySelector('.orb'); if (orb) orb.dataset.state = next;
      const st = panel.querySelector('.status');
      if (st) { st.textContent = text || STATE_TEXT[next]; st.classList.toggle('bad', next === 'error'); }
      const mic = panel.querySelector('.mic');
      if (mic) {
        mic.dataset.active = String(next === 'listening');
        mic.setAttribute('aria-label', next === 'listening' ? 'Stop listening and send' : next === 'speaking' ? 'Interrupt and speak' : 'Start talking');
        mic.innerHTML = next === 'listening' ? ICON.stop : ICON.mic;
        mic.disabled = !canMic || next === 'processing';
      }
      const stop = panel.querySelector('.stopbtn');
      if (stop) stop.disabled = !(next === 'speaking' || next === 'processing');
    }

    function renderMain() {
      const body = panel.querySelector('.body');
      const dock = panel.querySelector('.dock');
      body.replaceChildren(); dock.replaceChildren();

      const orb = el('div', { class: 'orb', 'data-state': state, 'aria-hidden': 'true' });
      const status = el('div', { class: 'status', role: 'status', 'aria-live': 'polite' }, STATE_TEXT[state]);
      body.append(el('div', { class: 'stage' }, orb, status));

      if (bannerMsg) {
        const b = el('div', { class: 'banner', role: 'alert' }, bannerMsg);
        if (lastText) b.append(el('button', { type: 'button', onclick: () => ask(lastText) }, 'Try again'));
        body.append(b);
      }
      const last = [...transcript].reverse().find((m) => m.role === 'assistant');
      const lastUser = transcript.length && transcript[transcript.length - 1].role === 'user' ? transcript[transcript.length - 1] : null;
      body.append(el('p', { class: 'caption', 'aria-live': 'polite' }, last ? last.content : ''));
      if (lastUser) body.append(el('p', { class: 'heard' }, `You: “${lastUser.content}”`));
      if (last && last.links && last.links.length) {
        const cards = el('div', { class: 'cards', 'aria-label': 'Related links' });
        for (const l of last.links) {
          let host = '';
          try { const u = new URL(l.url); if (u.protocol !== 'https:') continue; host = u.hostname.replace(/^www\./, '') + (u.pathname.length > 1 ? u.pathname : ''); } catch { continue; }
          cards.append(el('a', { class: 'card', href: l.url, target: '_blank', rel: 'noopener noreferrer' },
            el('span', { class: 't' }, el('span', { class: 'l' }, l.label), el('span', { class: 'h' }, host)),
            el('span', { class: 'k' }, l.kind || 'link'),
            el('span', { html: ICON.ext })));
        }
        body.append(cards);
      }
      if (transcript.length <= 1 && state === 'idle') {
        const s = el('div', { class: 'starters' });
        for (const q of STARTERS) s.append(el('button', { class: 'chip', type: 'button', onclick: () => ask(q) }, q));
        body.append(s);
      }
      if (showTranscript) {
        const t = el('div', { class: 'transcript', role: 'log', 'aria-label': 'Conversation transcript' });
        for (const m of transcript) t.append(el('div', { class: 'msg ' + (m.role === 'user' ? 'u' : 'a') }, el('b', {}, m.role === 'user' ? 'You' : 'Ask Anuj'), m.content));
        if (!transcript.length) t.append(el('div', { class: 'msg' }, 'Nothing yet.'));
        body.append(t);
      }

      // dock
      const mic = el('button', { class: 'round mic', type: 'button', 'aria-label': 'Start talking', onclick: onMic, html: ICON.mic });
      const muteBtn = el('button', { class: 'round mutebtn', type: 'button', 'aria-pressed': String(muted), 'aria-label': 'Mute spoken replies', title: 'Mute spoken replies', onclick: onMute, html: muted ? ICON.mute : ICON.vol });
      const stopBtn = el('button', { class: 'round stopbtn', type: 'button', 'aria-label': 'Stop speaking', title: 'Stop', onclick: onStop, html: ICON.stop });
      dock.append(el('div', { class: 'controls' }, muteBtn, mic, stopBtn));
      const sub = el('div', { class: 'sub' },
        el('button', { class: 'pill', type: 'button', 'aria-pressed': String(showTranscript), onclick: () => { showTranscript = !showTranscript; renderMain(); } }, 'Transcript'),
        el('button', { class: 'pill', type: 'button', 'aria-pressed': String(showTyped || !canMic), onclick: () => { showTyped = !showTyped; renderMain(); if (showTyped) panel.querySelector('.typed input')?.focus(); } }, 'Type'),
        canMic ? el('button', { class: 'pill', type: 'button', 'aria-pressed': String(autoListen), title: 'After each spoken answer, start listening again', onclick: () => { autoListen = !autoListen; renderMain(); } }, 'Hands-free') : null);
      dock.append(sub);
      if (showTyped || !canMic) {
        const input = el('input', { type: 'text', maxlength: String(MAX_TEXT), placeholder: 'Type a question…', 'aria-label': 'Type your question', autocomplete: 'off', enterkeyhint: 'send' });
        const form = el('form', { class: 'typed', onsubmit: (e) => { e.preventDefault(); const v = input.value.trim(); if (v) { input.value = ''; unlockAudio(); ask(v); } } },
          input, el('button', { class: 'round', type: 'submit', 'aria-label': 'Send question', html: ICON.send }));
        dock.append(form);
        if (!canMic) dock.append(el('p', { class: 'footnote' }, 'Voice input is not available in this browser or connection. Typing works, and I can still read answers aloud.'));
      }
      setState(state);
      setLevel(0);
    }

    function renderIntro(errorMsg) {
      const body = panel.querySelector('.body');
      panel.querySelector('.dock').replaceChildren();
      body.replaceChildren();
      let role = null;
      const name = el('input', { type: 'text', id: 'aa-name', maxlength: '60', placeholder: 'Your name', autocomplete: 'given-name', 'aria-describedby': 'aa-note' });
      const start = el('button', { class: 'primary', type: 'submit' }, 'Start');
      const sync = () => { start.disabled = INTRO_REQUIRED && !(name.value.trim() && role); };
      const roleBox = el('div', { class: 'roles', role: 'radiogroup', 'aria-label': 'Who are you?' });
      for (const [v, label] of ROLES) {
        const b = el('button', { class: 'chip', type: 'button', role: 'radio', 'aria-checked': 'false', onclick: () => {
          role = role === v ? null : v;
          roleBox.querySelectorAll('.chip').forEach((c, i) => c.setAttribute('aria-checked', String(ROLES[i][0] === role)));
          sync();
        } }, label);
        roleBox.append(b);
      }
      name.addEventListener('input', sync);
      const form = el('form', { class: 'intro', onsubmit: (e) => { e.preventDefault(); begin(name.value, role); } },
        el('h2', {}, 'Hi, I’m Ask Anuj'),
        el('p', {}, 'I’m Anuj’s AI representative. Talk to me about his work, projects and resume.'),
        el('label', { for: 'aa-name' }, 'Your name'), name,
        el('label', {}, 'I’m a…'), roleBox,
        el('div', { class: 'notice', id: 'aa-note' }, 'Your name, role and start time are shared with Anuj. Nothing else is stored: no audio and no conversation. If you skip, I won’t know who you are.'),
        errorMsg ? el('div', { class: 'err', role: 'alert' }, errorMsg) : null,
        el('div', { class: 'actions' }, start, INTRO_REQUIRED ? null : el('button', { class: 'link', type: 'button', onclick: () => begin('', null) }, 'Skip')));
      body.append(form);
      sync();
      name.focus();
    }

    function openPanel() {
      launcher.hidden = true;
      unlockAudio();
      panel = el('section', { class: 'panel', role: 'dialog', 'aria-label': 'Ask Anuj voice assistant', tabindex: '-1' },
        el('header', {},
          el('div', { class: 'brand' }, 'AI representative', el('b', {}, 'Ask Anuj')),
          el('div', { class: 'hbtns' }, el('button', { class: 'pill', type: 'button', 'aria-label': 'End session and close', onclick: endSession }, 'End'))),
        el('div', { class: 'body' }),
        el('div', { class: 'dock' }),
        el('div', { class: 'footnote' }, 'AI answers come only from Anuj’s published content and can be imperfect.'));
      panel.addEventListener('keydown', (e) => { if (e.key === 'Escape') endSession(); });
      root.append(panel);
      session ? renderMain() : renderIntro();
      panel.focus({ preventScroll: true });
      const first = panel.querySelector('input, button.mic');
      if (first) first.focus({ preventScroll: true });
    }

    // ----- flow -----
    async function begin(name, role) {
      const btn = panel.querySelector('.primary');
      if (btn) { btn.disabled = true; btn.textContent = 'Connecting…'; }
      unlockAudio();
      try {
        session = await api('/api/session', { name: name.trim() || null, role });
      } catch (e) {
        if (e.name === 'AbortError') return;
        session = null;
        return renderIntro(e.message);
      }
      const greeting = { role: 'assistant', content: session.greeting, links: [] };
      transcript = [greeting];
      state = 'idle';
      renderMain();
      speak(greeting.content);
    }

    function fail(e, retryText) {
      if (e && e.name === 'AbortError') return;
      if (e && (e.code === 'bad_token' || e.code === 'expired')) { session = null; transcript = []; state = 'idle'; return renderIntro('Your session expired. Please start again.'); }
      bannerMsg = (e && e.message) || 'Something went wrong.';
      lastText = retryText || '';
      if (e && e.code === 'resting') lastText = '';
      renderMain();
      setState('error', e && e.code === 'resting' ? 'Resting for today' : 'Something went wrong');
      if (!showTyped) { showTyped = true; renderMain(); setState('error', e && e.code === 'resting' ? 'Resting for today' : 'Something went wrong'); }
    }

    async function ask(text) {
      text = text.trim().slice(0, MAX_TEXT);
      if (!text || !session) return;
      if (state === 'processing') return;
      stopSpeaking();
      if (rec) { rec.cancel(); rec = null; }
      bannerMsg = ''; lastText = text;
      const history = transcript.map((m) => ({ role: m.role, content: m.content }));
      transcript.push({ role: 'user', content: text });
      renderMain();
      setState('processing');
      let data;
      try {
        data = await api('/api/chat', { message: text, history });
      } catch (e) {
        transcript.pop();
        return fail(e, text);
      }
      lastText = '';
      transcript.push({ role: 'assistant', content: data.answer, links: data.links || [] });
      renderMain();
      speak(data.answer);
    }

    async function speak(text) {
      const run = ++speechRun;
      if (muted) return afterSpeech(run);
      setState('speaking');
      const alive = () => run === speechRun && panel;
      try {
        const data = await api('/api/speak', { text });
        if (!alive()) return;
        await new Promise((resolve, reject) => {
          audio.onended = resolve; audio.onerror = () => reject(new Error('playback'));
          audio.src = `data:${data.mime};base64,${data.audio}`;
          const p = audio.play(); if (p) p.catch(reject);
        });
      } catch (e) {
        if (!alive()) return;
        // Server voice unavailable (quota/offline) → free browser voice, else silent text answer.
        if ('speechSynthesis' in window && !(e && e.name === 'AbortError')) {
          try {
            await new Promise((resolve) => {
              const u = new SpeechSynthesisUtterance(text); u.lang = 'en-US'; u.onend = resolve; u.onerror = resolve;
              speechSynthesis.cancel(); speechSynthesis.speak(u);
            });
          } catch { /* ignore */ }
        }
      }
      if (alive()) afterSpeech(run);
    }

    function afterSpeech(run) {
      if (!panel || run !== speechRun) return;
      setState('idle');
      if (autoListen && canMic && !document.hidden) listen();
    }

    async function listen() {
      if (!session || rec || !canMic) return;
      stopSpeaking();
      abortNetwork();
      bannerMsg = '';
      setState('listening');
      try {
        rec = await startRecording({ onLevel: setLevel });
      } catch (e) {
        rec = null;
        const denied = e && (e.name === 'NotAllowedError' || e.name === 'SecurityError');
        const none = e && (e.name === 'NotFoundError' || e.name === 'OverconstrainedError');
        if (denied || none) canMic = false;
        showTyped = true;
        bannerMsg = denied ? 'Microphone access was blocked. You can allow it in your browser’s site settings, or just type your question.'
          : none ? 'I could not find a microphone. You can type your question instead.' : 'I could not start the microphone. You can type your question instead.';
        renderMain(); setState('error', 'Microphone unavailable');
        return;
      }
      const mine = rec;
      const result = await mine.done;
      if (rec === mine) rec = null;
      if (!panel || !session || result.reason === 'cancel') return;
      if (!result.wav) { setState('idle', 'I didn’t catch that. Tap the mic and try again.'); return; }
      setState('processing');
      try {
        const data = await api('/api/transcribe', { audio: result.wav });
        if (!panel) return;
        if (!data.text) { setState('idle', 'I didn’t catch that. Tap the mic and try again.'); return; }
        state = 'idle'; // transcription done; ask() ignores calls made while 'processing'
        ask(data.text);
      } catch (e) {
        fail(e, '');
      }
    }

    function onMic() {
      unlockAudio();
      if (state === 'listening' && rec) { rec.stop(); return; }
      if (state === 'processing') return;
      listen();
    }
    function onStop() {
      abortNetwork();
      if (state === 'processing') { transcript.length && transcript[transcript.length - 1].role === 'user' && transcript.pop(); renderMain(); setState('idle'); return; }
      stopSpeaking(); setState('idle');
    }
    function onMute() {
      muted = !muted;
      if (muted) { stopSpeaking(); if (state === 'speaking') setState('idle'); }
      const b = panel.querySelector('.mutebtn');
      b.setAttribute('aria-pressed', String(muted)); b.innerHTML = muted ? ICON.mute : ICON.vol;
      b.setAttribute('aria-label', muted ? 'Unmute spoken replies' : 'Mute spoken replies');
    }

    launcher.addEventListener('click', openPanel);

    // Test/diagnostic hook (read-only state; no network)
    window.__askAnujState = () => ({ open: !!panel, state, micOpen: !!rec, speaking: !audio.paused, session: !!session, turns: transcript.length });
  }

  if (document.body) init(); else document.addEventListener('DOMContentLoaded', init, { once: true });
})();
