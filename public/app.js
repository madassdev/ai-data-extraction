import { $, $$, esc, sleep, loadIcons, hydrateIcons, icon, toast, Guide, reveal, solveChallenge, postJson, reducedMotion } from './kit.js?v=8';

const MAX = 6000;
const SAMPLE_META = {
  'whatsapp-sales': { icon: 'message-square', cls: 'whatsapp', title: 'WhatsApp sales report', sub: 'Sent by bar staff', badge: ['badge-bad', '3 problems'] },
  'invoice-email': { icon: 'mail', cls: 'email', title: 'Invoice email', sub: 'From a web agency', badge: ['badge-ok', 'All correct'] },
  'supplier-order': { icon: 'package', cls: 'chat', title: 'Supplier order chat', sub: 'From a restaurant', badge: ['badge-warn', '1 problem'] },
};
const state = { samples: [], current: null, view: 'table', busy: false, ai: 'ok' };
const els = { samples: $('#samples'), text: $('#text'), count: $('#count'), go: $('#go'), result: $('#result'), notice: $('#aiNotice') };

const guide = new Guide({
  key: 'extract', title: 'Your demo checklist', openWhen: '#try',
  missions: [
    { id: 'whatsapp-sales', title: 'Catch missing money', hint: 'A bar report where the cash doesn\'t add up.', action: { label: 'Show me', run: () => runSample('whatsapp-sales') } },
    { id: 'invoice-email', title: 'Watch a clean invoice pass', hint: 'Everything adds up, so it\'s ready to save.', action: { label: 'Show me', run: () => runSample('invoice-email') } },
    { id: 'supplier-order', title: 'Spot a wrong line', hint: 'The total looks fine, but one line is miscalculated.', action: { label: 'Show me', run: () => runSample('supplier-order') } },
    { id: 'data', title: 'See the clean data', hint: 'Open the JSON view or download the CSV.', action: { label: 'Show me', run: () => { if (!state.current) runSample('invoice-email'); else setView('json'); } } },
  ],
  onComplete: () => toast('Now imagine this on your own reports. Let\'s talk!', { icon: 'party-popper', ms: 6000 }),
});

// ---------- wizard ----------
function step(n) {
  for (const li of $$('#wizard li')) {
    const s = Number(li.dataset.step);
    li.classList.toggle('on', s === n);
    li.classList.toggle('done', s < n);
  }
}

// ---------- samples ----------
function renderSamples() {
  els.samples.innerHTML = state.samples.map((s) => {
    const m = SAMPLE_META[s.id] ?? { icon: 'file-text', cls: 'chat', title: s.label, sub: s.hint, badge: ['badge-brand', 'Sample'] };
    return `<button type="button" class="sample" data-id="${s.id}" aria-pressed="false"><span class="s-ico ${m.cls}">${icon(m.icon)}</span><span><b>${esc(m.title)}</b><small>${esc(m.sub)}</small></span><span class="badge ${m.badge[0]}">${esc(m.badge[1])}</span></button>`;
  }).join('');
}
els.samples.addEventListener('click', (e) => { const b = e.target.closest('.sample'); if (b) runSample(b.dataset.id); });
document.addEventListener('click', (e) => { const b = e.target.closest('[data-sample]'); if (b) runSample(b.dataset.sample); });

function runSample(id) {
  const s = state.samples.find((x) => x.id === id);
  if (!s) return;
  $$('.sample').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === id)));
  els.text.value = s.text; updateCount();
  run(s.text, id);
}

// ---------- run ----------
function updateCount() {
  els.count.textContent = `${els.text.value.length.toLocaleString()} / ${MAX.toLocaleString()}`;
  els.count.style.color = els.text.value.length > MAX ? 'var(--bad)' : '';
}
els.text.addEventListener('input', () => { updateCount(); $$('.sample').forEach((b) => b.setAttribute('aria-pressed', 'false')); });
els.go.addEventListener('click', () => run(els.text.value));

async function run(text, sampleId = null) {
  text = text.trim();
  if (text.length < 10 || state.busy) { if (text.length < 10) { els.text.focus(); toast('Paste a message first, or pick a sample.', { icon: 'info' }); } return; }
  state.busy = true; els.go.disabled = true;
  $('#try').scrollIntoView({ behavior: 'smooth', block: 'start' });
  step(2);
  els.result.innerHTML = `<div class="reading"><pre>${esc(text.slice(0, 1200))}</pre><div class="beam"></div><p>${icon('scan-line')}Reading the message and checking every number…</p></div>`;
  const started = performance.now();
  try {
    const payload = { text };
    if (!sampleId && !state.samples.some((s) => s.text.trim() === text)) Object.assign(payload, await solveChallenge());
    const { ok, data } = await postJson('/api/extract', payload);
    const minShow = reducedMotion() ? 0 : 1600; // let the "reading" moment register
    await sleep(Math.max(0, minShow - (performance.now() - started)));
    if (!ok) throw Object.assign(new Error(data.error || 'Request failed'), { paused: data.paused });
    state.current = data;
    step(3);
    render(true);
    const sid = sampleId ?? state.samples.find((s) => s.text.trim() === text)?.id;
    if (sid) guide.complete(sid);
    const v = data.validation;
    toast(v.status === 'ready' ? 'All checks passed, ready to save' : v.status === 'review' ? 'Needs a quick look from a person' : `${v.checks.filter((c) => c.level === 'error').length} problem(s) caught`, { icon: v.status === 'ready' ? 'badge-check' : 'alert-triangle', tone: v.status === 'ready' ? 'ok' : v.status === 'review' ? 'warn' : 'bad' });
  } catch (err) {
    step(1);
    state.current = null;
    els.result.innerHTML = `<div class="notice warn">${icon('hourglass')}<div><b>${esc(err.message)}</b>${err.paused ? '<br>The three samples on the left still work and show exactly what it does.' : ''}</div></div>`;
    if (err.paused) { state.ai = 'paused'; renderNotice(); }
  } finally {
    state.busy = false; els.go.disabled = false;
  }
}

// ---------- results ----------
const fmt = (n, cur) => {
  if (n == null) return '<span class="muted">—</span>';
  const sym = { NGN: '₦', USD: '$', GBP: '£', EUR: '€' }[cur] ?? '';
  const s = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 });
  return `${n < 0 ? '−' : ''}${sym}${s}`;
};
const STATUS = {
  ready: ['badge-check', 'Ready to save', 'Every check passed. This record can go straight into your system.'],
  review: ['alert-triangle', 'Needs a quick look', 'Nothing is provably wrong, but a person should confirm one thing first.'],
  blocked: ['alert-octagon', 'Numbers don\'t add up', 'This record is held back until someone fixes or explains the problem.'],
};
const LEVEL_ICON = { error: 'x', warning: 'alert-triangle', info: 'info', ok: 'check' };
const TYPE = { sales_report: 'Sales report', invoice: 'Invoice', purchase_order: 'Order', expense_report: 'Expenses', receipt: 'Receipt', other: 'Other' };

function setView(v) { state.view = v; render(false); if (v === 'json') guide.complete('data'); }

function render(animate) {
  const d = state.current;
  if (!d) return;
  const { extraction: x, validation: v } = d;
  const cur = x.currency;
  const order = { error: 0, warning: 1, info: 2, ok: 3 };
  const checks = [...v.checks].sort((a, b) => order[a.level] - order[b.level]);
  const flagged = new Map();
  for (const c of v.checks) if (c.line != null && (!flagged.has(c.line) || c.level === 'error')) flagged.set(c.line, c.level);
  const [ico, title, sub] = STATUS[v.status];
  const mismatch = x.stated_total != null && v.computed_total != null && Math.abs(x.stated_total - v.computed_total) > 0.01;

  const body = state.view === 'json'
    ? `<pre class="json">${esc(JSON.stringify({ extraction: x, validation: v }, null, 2))}</pre>`
    : `<div class="tbl-wrap"><table>
        <thead><tr><th>#</th><th>Item</th><th class="num">Qty</th><th class="num">Price</th><th class="num">Amount</th></tr></thead>
        <tbody>
          ${x.line_items.map((li, i) => `<tr class="${flagged.has(i) ? `flag-${flagged.get(i)}` : ''}"><td class="muted">${i + 1}</td><td class="desc">${esc(li.description)}</td><td class="num">${li.quantity ?? '<span class="muted">—</span>'}</td><td class="num">${fmt(li.unit_price, cur)}</td><td class="num">${fmt(li.amount, cur)}</td></tr>`).join('')}
          ${x.adjustments.map((a) => `<tr><td></td><td class="desc muted">${esc(a.label)}</td><td></td><td></td><td class="num">${fmt(a.amount, cur)}</td></tr>`).join('')}
          <tr class="total ${mismatch ? 'mismatch' : ''}"><td></td><td>Total written on the message</td><td></td><td></td><td class="num">${fmt(x.stated_total, cur)}</td></tr>
          <tr class="total"><td></td><td>Total when we add it up</td><td></td><td></td><td class="num">${fmt(v.computed_total, cur)}</td></tr>
        </tbody></table></div>`;

  els.result.innerHTML = `
    <div class="status ${v.status}"><span class="s-big">${icon(ico)}</span><div><h3>${title}</h3><p>${sub}</p></div></div>
    <div class="sec-title">${icon('list-checks')}What the checks found</div>
    <ul class="checks">${checks.map((c, i) => `<li class="${c.level}" style="animation-delay:${animate ? 0.15 + i * 0.22 : 0}s"><span class="c-ico">${icon(LEVEL_ICON[c.level])}</span><div><b>${esc(c.title)}</b><span>${esc(c.detail)}</span></div></li>`).join('')}</ul>
    <div class="sec-title">${icon('file-text')}The record it pulled out</div>
    <div class="facts">
      <span class="fact">${icon('file-text')}<small>Type</small><b>${esc(TYPE[x.document_type] ?? x.document_type)}</b></span>
      <span class="fact">${icon('clock')}<small>Date</small><b>${esc(x.date ?? '—')}</b></span>
      <span class="fact">${icon('wallet')}<small>Currency</small><b>${esc(cur ?? '—')}</b></span>
      ${x.parties.map((p) => `<span class="fact">${icon('user')}<small>${esc(p.role)}</small><b>${esc(p.name)}</b></span>`).join('')}
      ${x.payments.map((p) => `<span class="fact">${icon('wallet')}<small>${esc(p.method)}</small><b>${fmt(p.amount, cur)}</b></span>`).join('')}
    </div>
    <div class="sec-title">${icon('table-2')}Line by line
      <div class="view-tabs" role="tablist">
        <button type="button" role="tab" aria-selected="${state.view === 'table'}" data-view="table">${icon('table-2')}Table</button>
        <button type="button" role="tab" aria-selected="${state.view === 'json'}" data-view="json">${icon('braces')}JSON</button>
        <button type="button" data-csv>${icon('download')}CSV</button>
      </div>
    </div>
    ${body}
    <p class="foot-note">${icon('info')}${d.sample ? 'Sample: the reading is saved, the checks run live in code.' : `Read by ${esc(d.meta.model)} in ${(d.meta.ms / 1000).toFixed(1)}s, checks run in code.`}</p>`;
}

els.result.addEventListener('click', (e) => {
  const t = e.target.closest('[data-view]');
  if (t) { setView(t.dataset.view); return; }
  if (e.target.closest('[data-csv]') && state.current) {
    const x = state.current.extraction;
    const q = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
    const rows = ['date,currency,description,quantity,unit_price,amount', ...x.line_items.map((li) => [x.date, x.currency, li.description, li.quantity, li.unit_price, li.amount].map(q).join(','))];
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/csv' })), download: 'extracted-lines.csv' });
    a.click(); URL.revokeObjectURL(a.href);
    guide.complete('data');
    toast('CSV downloaded', { icon: 'download', tone: 'ok' });
  }
});

function renderNotice() {
  els.notice.innerHTML = state.ai === 'ok' ? '' : `<div class="notice warn">${icon('hourglass')}<div><b>Reading your own text is paused right now.</b> The three samples above still show exactly what it does.</div></div>`;
}

// ---------- boot ----------
await loadIcons();
hydrateIcons();
reveal();
updateCount();
state.samples = await (await fetch('/api/samples')).json();
renderSamples();
try { state.ai = (await (await fetch('/api/status')).json()).ai; renderNotice(); } catch { /* optional */ }
