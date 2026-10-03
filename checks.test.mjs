import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runChecks } from './checks.mjs';

const base = { document_type: 'other', title: '', date: '2026-09-26', currency: 'USD', parties: [], adjustments: [], stated_total: null, payments: [], other_fields: [], uncertain: [] };
const li = (description, quantity, unit_price, amount) => ({ description, quantity, unit_price, amount, source_text: '' });
const levels = (r) => r.checks.map((c) => `${c.level}:${c.title}`);

test('sales report: duplicate line, total and payment mismatch', () => {
  const r = runChecks({
    ...base,
    line_items: [li('Lattes', 60, 5, 300), li('Croissants', 48, 4, 192), li('Bagels', 36, 3, 108),
      li('Smoothies', 25, 7, 175), li('Muffins', 30, 3, 90), li('Bagels', 36, 3, 108)],
    stated_total: 1023,
    payments: [{ method: 'Card', amount: 800 }, { method: 'Cash', amount: 150 }, { method: 'Venmo', amount: 23 }],
  });
  assert.equal(r.status, 'blocked');
  assert.equal(r.computed_total, 973);
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
