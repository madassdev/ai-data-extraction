// Deterministic checks run on the AI's extraction. The model only reads; these rules decide.

const TOL = 0.01;
const near = (a, b) => Math.abs(a - b) <= Math.max(TOL, Math.abs(b) * 0.0001);
const money = (n) => Number(n.toFixed(2));
const f = (n) => n.toLocaleString('en-US', { maximumFractionDigits: 2 });
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function runChecks(x) {
  const checks = [];
  const add = (level, title, detail, line = null) => checks.push({ level, title, detail, line });

  // 1. Each line: quantity × unit price = amount
  for (const [i, li] of x.line_items.entries()) {
    if (li.quantity != null && li.unit_price != null && li.amount != null) {
      const expected = money(li.quantity * li.unit_price);
      if (!near(expected, li.amount)) {
        add('error', `Line ${i + 1} doesn't add up`,
          `"${li.description}": ${f(li.quantity)} × ${f(li.unit_price)} = ${f(expected)}, but the text says ${f(li.amount)}.`, i);
      }
    }
  }

  // 2. Possible duplicates: same item and amount appearing twice
  const seen = new Map();
  for (const [i, li] of x.line_items.entries()) {
    const key = `${norm(li.description)}|${li.amount}`;
    if (seen.has(key)) {
      add('warning', 'Possible duplicate line',
        `Line ${i + 1} ("${li.description}", ${f(li.amount)}) repeats line ${seen.get(key) + 1}. Check it wasn't entered twice.`, i);
    } else seen.set(key, i);
  }

  // 3. Lines + adjustments = stated total (a line with no amount counts as quantity × unit price)
  const amounts = x.line_items
    .map((li) => li.amount ?? (li.quantity != null && li.unit_price != null ? money(li.quantity * li.unit_price) : null))
    .filter((a) => a != null);
  const itemsSum = money(amounts.reduce((s, a) => s + a, 0));
  const adjSum = money(x.adjustments.reduce((s, a) => s + a.amount, 0));
  const computed = money(itemsSum + adjSum);
  if (x.stated_total == null) {
    if (amounts.length) add('info', 'No total stated', `Calculated total is ${f(computed)}.`);
  } else if (amounts.length && !near(computed, x.stated_total)) {
    const diff = money(x.stated_total - computed);
    add('error', 'Total does not match the lines',
      `Lines${x.adjustments.length ? ' + adjustments' : ''} come to ${f(computed)}, but the stated total is ${f(x.stated_total)} (difference ${diff > 0 ? "+" : ""}${f(diff)}).`);
  } else if (amounts.length) {
    add('ok', 'Total matches the lines', `${f(computed)} = ${f(x.stated_total)}.`);
  }

  // 4. Payments received = total
  if (x.payments.length && x.stated_total != null) {
    const paid = money(x.payments.reduce((s, p) => s + p.amount, 0));
    if (!near(paid, x.stated_total)) {
      const gap = money(x.stated_total - paid);
      add('error', 'Payments don\'t match the total',
        `Payments add up to ${f(paid)}; total is ${f(x.stated_total)} (${gap > 0 ? `${f(gap)} unaccounted for` : `${f(-gap)} over`}).`);
    } else {
      add('ok', 'Payments match the total', `${f(paid)} received.`);
    }
  }

  // 5. Required basics
  if (!x.date) add('warning', 'No date found', 'Records without a date can\'t be filed to the right day.');
  else if (Number.isNaN(Date.parse(x.date))) add('warning', 'Date looks invalid', `Read as "${x.date}".`);
  if (!x.currency) add('info', 'Currency not stated', 'Assumed from context if you set a default.');

  // 6. Anything the AI itself was unsure about
  for (const u of x.uncertain) add('warning', `Unclear: ${u.field}`, u.reason);

  const status = checks.some((c) => c.level === 'error') ? 'blocked'
    : checks.some((c) => c.level === 'warning') ? 'review' : 'ready';
  return { status, computed_total: amounts.length ? computed : null, checks };
}
