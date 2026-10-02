// Fictional samples. Two contain deliberate mistakes so the checks have something to catch.
export const samples = [
  {
    id: 'whatsapp-sales',
    label: 'WhatsApp sales report',
    hint: 'Bar staff report with a duplicate line and missing money',
    text: `Hey boss 👋 sales for Fri 9/26

Hennessy VS 2 btl @ $250 = $500
Margaritas x 18 @ $12 = $216
Heineken 24 @ $7 = $168
Wings 6 @ $15 = $90
Nachos 5 @ $12 = $60
Heineken 24 @ $7 = $168

Total = $1,252
Card - $950
Cash - $200
Venmo - $52
Tips $85 (staff)

- Jess, Blue Room Lounge`,
  },
  {
    id: 'invoice-email',
    label: 'Invoice email',
    hint: 'A clean invoice. Everything should check out',
    text: `Hi Sarah,

Please find invoice INV-2041 for September below.

From: Northpoint Web Studio
To: Greenleaf Dental
Date: 30 Sep 2026 (due 14 Oct)

- Website maintenance (Sept) — 1 × $450.00
- Extra landing page — 2 × $180.00 = $360.00
- Hosting (3 months) — 3 × $25 = $75

Subtotal $885.00
Loyalty discount -10% ($88.50)
Total due: $796.50

Thanks!
Mike`,
  },
  {
    id: 'supplier-order',
    label: 'Supplier order chat',
    hint: 'Casual order where one line is miscalculated',
    text: `hey can u send the usual for tmrw (Sat 4th Oct 2026)

- 10 kg chicken thighs @ £6.20/kg
- 5 boxes tomatoes £12 each = £60
- 3 x olive oil 5L @ £28 = £74
- 20 burger bun packs @ £1.50 = £30
delivery £15

total should be £241 i think
pay on delivery cash. thanks - Tony, Mama's Kitchen`,
  },
];
