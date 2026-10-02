// Saved extractions for the bundled samples, so the samples work without spending API credit.
// Checks are still run live on these by checks.mjs.
const li = (description, quantity, unit_price, amount, source_text) => ({ description, quantity, unit_price, amount, source_text });

export const fixtures = {
  'whatsapp-sales': {
    document_type: 'sales_report',
    title: 'Daily sales report, 26 Sep 2026',
    date: '2026-09-26',
    currency: 'USD',
    parties: [{ role: 'Business', name: 'Blue Room Lounge' }, { role: 'Reported by', name: 'Jess' }],
    line_items: [
      li('Hennessy VS (bottle)', 2, 250, 500, 'Hennessy VS 2 btl @ $250 = $500'),
      li('Margaritas', 18, 12, 216, 'Margaritas x 18 @ $12 = $216'),
      li('Heineken', 24, 7, 168, 'Heineken 24 @ $7 = $168'),
      li('Wings', 6, 15, 90, 'Wings 6 @ $15 = $90'),
      li('Nachos', 5, 12, 60, 'Nachos 5 @ $12 = $60'),
      li('Heineken', 24, 7, 168, 'Heineken 24 @ $7 = $168'),
    ],
    adjustments: [],
    stated_total: 1252,
    payments: [{ method: 'Card', amount: 950 }, { method: 'Cash', amount: 200 }, { method: 'Venmo', amount: 52 }],
    other_fields: [{ name: 'Tips (staff)', value: '$85' }],
    uncertain: [],
  },
  'invoice-email': {
    document_type: 'invoice',
    title: 'Invoice INV-2041, September 2026',
    date: '2026-09-30',
    currency: 'USD',
    parties: [{ role: 'From', name: 'Northpoint Web Studio' }, { role: 'To', name: 'Greenleaf Dental' }],
    line_items: [
      li('Website maintenance (Sept)', 1, 450, null, '- Website maintenance (Sept) — 1 × $450.00'),
      li('Extra landing page', 2, 180, 360, '- Extra landing page — 2 × $180.00 = $360.00'),
      li('Hosting (3 months)', 3, 25, 75, '- Hosting (3 months) — 3 × $25 = $75'),
    ],
    adjustments: [{ label: 'Loyalty discount (10%)', amount: -88.5 }],
    stated_total: 796.5,
    payments: [],
    other_fields: [{ name: 'Invoice number', value: 'INV-2041' }, { name: 'Due date', value: '2026-10-14' }, { name: 'Subtotal (stated)', value: '885.00' }],
    uncertain: [],
  },
  'supplier-order': {
    document_type: 'purchase_order',
    title: "Supplier order for Mama's Kitchen, 4 Oct 2026",
    date: '2026-10-04',
    currency: 'GBP',
    parties: [{ role: 'Customer', name: "Mama's Kitchen" }, { role: 'Contact', name: 'Tony' }],
    line_items: [
      li('Chicken thighs (kg)', 10, 6.2, null, '- 10 kg chicken thighs @ £6.20/kg'),
      li('Tomatoes (box)', 5, 12, 60, '- 5 boxes tomatoes £12 each = £60'),
      li('Olive oil 5L', 3, 28, 74, '- 3 x olive oil 5L @ £28 = £74'),
      li('Burger bun packs', 20, 1.5, 30, '- 20 burger bun packs @ £1.50 = £30'),
    ],
    adjustments: [{ label: 'Delivery', amount: 15 }],
    stated_total: 241,
    payments: [],
    other_fields: [{ name: 'Payment terms', value: 'Cash on delivery' }],
    uncertain: [{ field: 'stated_total', reason: 'The customer wrote "total should be £241 i think", so the total is their estimate.' }],
  },
};
