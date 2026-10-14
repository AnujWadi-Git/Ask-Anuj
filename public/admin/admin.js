// Token stays in memory only; the page itself contains no visitor data.
const $ = (id) => document.getElementById(id);
let token = '';

async function load() {
  $('error').hidden = true;
  const res = await fetch('/api/admin/sessions?limit=200', { headers: { Authorization: 'Bearer ' + token }, cache: 'no-store' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { token = ''; $('error').textContent = data.message || 'Could not load.'; $('error').hidden = false; $('data').hidden = true; return; }
  $('scope').textContent = data.scope;
  const totals = $('totals'); totals.replaceChildren();
  for (const [label, v] of [['Sessions', data.totals.sessions], ['Last 7 days', data.totals.last7Days], ['Skipped intro (anonymous)', data.totals.skippedIntro]]) {
    const li = document.createElement('li'); const b = document.createElement('b'); b.textContent = v; li.append(b, label); totals.append(li);
  }
  const rows = $('rows'); rows.replaceChildren();
  for (const s of data.sessions) {
    const tr = document.createElement('tr');
    const cells = [new Date(s.startedAt).toLocaleString(), s.name || 'Skipped (anonymous)', s.role || '—'];
    cells.forEach((c, i) => { const td = document.createElement('td'); td.textContent = c; if (i === 1 && !s.name) td.className = 'anon'; tr.append(td); });
    rows.append(tr);
  }
  $('data').hidden = false; $('login').hidden = true;
}

$('login').addEventListener('submit', (e) => { e.preventDefault(); token = $('token').value; $('token').value = ''; load(); });
$('logout').addEventListener('click', () => { token = ''; $('rows').replaceChildren(); $('data').hidden = true; $('login').hidden = false; });
