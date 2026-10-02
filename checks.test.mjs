import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runChecks } from './checks.mjs';

const base = { document_type: 'other', title: '', date: '2026-09-26', currency: 'NGN', parties: [], adjustments: [], stated_total: null, payments: [], other_fields: [], uncertain: [] };
const li = (description, quantity, unit_price, amount) => ({ description, quantity, unit_price, amount, source_text: '' });
const levels = (r) => r.checks.map((c) => `${c.level}:${c.title}`);

test('sales report: duplicate line, total and payment mismatch', () => {
  const r = runChecks({
    ...base,
    line_items: [li('Hennessy VS', 2, 45000, 90000), li('Smirnoff Ice', 12, 2500, 30000), li('Heineken', 24, 1500, 36000),
      li('Chapman', 6, 3000, 18000), li('Shisha', 3, 15000, 45000), li('Heineken', 24, 1500, 36000)],
    stated_total: 260000,
    payments: [{ method: 'POS', amount: 180000 }, { method: 'Cash', amount: 60000 }, { method: 'Transfer', amount: 15000 }],
  });
  assert.equal(r.status, 'blocked');
  assert.equal(r.computed_total, 255000);
  assert.ok(levels(r).includes('warning:Possible duplicate line'));
  assert.ok(levels(r).includes('error:Total does not match the lines'));
  assert.ok(levels(r).includes("error:Payments don't match the total"));
  assert.equal(r.checks.find((c) => c.title === 'Possible duplicate line').line, 5);
});

test('clean invoice with discount is ready', () => {
  const r = runChecks({
    ...base, currency: 'USD',
    line_items: [li('Website maintenance', 1, 450, null), li('Extra landing page', 2, 180, 360), li('Hosting', 3, 25, 75)],
    adjustments: [{ label: 'Loyalty discount 10%', amount: -88.5 }],
    stated_total: 796.5,
  });
  assert.equal(r.status, 'ready');
  assert.equal(r.computed_total, 796.5);
});

test('order chat: wrong line is caught even though total agrees', () => {
  const r = runChecks({
    ...base, currency: 'GBP',
    line_items: [li('Chicken thighs', 10, 6.2, null), li('Tomatoes', 5, 12, 60), li('Olive oil 5L', 3, 28, 74), li('Burger buns', 20, 1.5, 30)],
    adjustments: [{ label: 'Delivery', amount: 15 }],
    stated_total: 241,
  });
  assert.equal(r.status, 'blocked');
  const err = r.checks.find((c) => c.level === 'error');
  assert.equal(err.line, 2);
  assert.ok(levels(r).includes('ok:Total matches the lines'));
});

test('missing date and AI uncertainty need review', () => {
  const r = runChecks({ ...base, date: null, line_items: [li('Item', 1, 10, 10)], stated_total: 10, uncertain: [{ field: 'currency', reason: 'guessed' }] });
  assert.equal(r.status, 'review');
});
