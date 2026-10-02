import { createHash } from 'node:crypto';
import express from 'express';
import rateLimit from 'express-rate-limit';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { runChecks } from './checks.mjs';
import { samples } from './samples.mjs';
import { fixtures } from './fixtures.mjs';
import { issueChallenge, verifyChallenge } from './pow.mjs';

const PORT = Number(process.env.PORT ?? 5180);
const MODEL = process.env.MODEL ?? 'claude-opus-5';
const MAX_CHARS = Number(process.env.MAX_CHARS ?? 6000);
const DAILY_LIMIT = Number(process.env.DAILY_LIMIT ?? 50);
const DAILY_BUDGET_USD = Number(process.env.DAILY_BUDGET_USD ?? 1);
const AI_ENABLED = process.env.AI_ENABLED !== 'false';
// USD per million tokens [input, output], for the daily budget estimate.
const PRICES = { 'claude-opus-5': [5, 25], 'claude-opus-5-5': [4, 20], 'claude-sonnet-5': [2, 10], 'claude-haiku-4-5': [1, 5] };
const costOf = (u) => {
  const [i, o] = PRICES[MODEL] ?? PRICES['claude-opus-5'];
  return (((u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) * 1.25 + (u.cache_read_input_tokens ?? 0) * 0.1) * i + (u.output_tokens ?? 0) * o) / 1e6;
};

const client = new Anthropic({ timeout: 60_000, maxRetries: 1 });

const Extraction = z.object({
  document_type: z.enum(['sales_report', 'invoice', 'purchase_order', 'expense_report', 'receipt', 'other']),
  title: z.string().describe('Short human title, e.g. "Sales report, 26 Sep 2026"'),
  date: z.string().nullable().describe('ISO date YYYY-MM-DD, or null if not stated'),
  currency: z.string().nullable().describe('ISO 4217 code, e.g. NGN, USD, GBP'),
  parties: z.array(z.object({ role: z.string(), name: z.string() })),
  line_items: z.array(z.object({
    description: z.string(),
    quantity: z.number().nullable(),
    unit_price: z.number().nullable(),
    amount: z.number().nullable().describe('Line amount exactly as written; null if not written'),
    source_text: z.string().describe('The original line, verbatim'),
  })),
  adjustments: z.array(z.object({
    label: z.string(),
    amount: z.number().describe('Negative for discounts, positive for tax, delivery or fees'),
  })),
  stated_total: z.number().nullable().describe('The total exactly as written; null if none'),
  payments: z.array(z.object({ method: z.string(), amount: z.number() })),
  other_fields: z.array(z.object({ name: z.string(), value: z.string() })),
  uncertain: z.array(z.object({ field: z.string(), reason: z.string() })),
});

const SYSTEM = `You extract structured records from messy business text (chat messages, emails, reports).

Rules:
- Copy numbers exactly as written. Never correct arithmetic, recompute totals or merge repeated lines: separate code checks the maths, and errors in the source must stay visible.
- If a line gives quantity and unit price but no amount, leave amount null.
- Write numbers as plain numbers (45,000 → 45000; 5k → 5000; "$88.50" → 88.5).
- Payments are money received against the total (POS, cash, transfer, card). Tips, gratuities and notes go in other_fields, not payments.
- Subtotals are not line items or adjustments.
- Use null rather than guessing. When you had to interpret something ambiguous (a missing year, an unclear unit, a guessed currency), add it to uncertain with a short reason.
- If the text contains no business record, return document_type "other" with empty arrays and explain in uncertain.`;

// Results for identical text are reused, so sample clicks cost nothing after the first run.
const cache = new Map();
const CACHE_MAX = 300;
const hash = (t) => createHash('sha256').update(t.trim()).digest('hex');

// Samples are served from saved extractions; the checks still run live on them.
const sampleResults = new Map(samples.map((s) => [hash(s.text), s.id]));
let day = new Date().toISOString().slice(0, 10);
let usedToday = 0;
let spentToday = 0; // estimated USD; resets on restart, the provider-side spend limit is the hard cap

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(express.json({ limit: '64kb' }));
app.use(express.static('public', { setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache') }));

app.get('/health', (_req, res) => res.json({ ok: true }));

// Is the AI provider usable? A 1-token probe at start and every 15 minutes (refused, and free,
// when there's no credit). The page uses it to steer visitors to the samples.
const aiHealth = { ok: null };
async function probeAi() {
  try {
    await client.messages.create({ model: 'claude-haiku-4-5', max_tokens: 1, messages: [{ role: 'user', content: 'ok' }] });
    aiHealth.ok = true;
  } catch (err) {
    aiHealth.ok = !(err instanceof Anthropic.AuthenticationError || (err instanceof Anthropic.BadRequestError && /credit balance/i.test(err.message)));
  }
}
if (AI_ENABLED) { probeAi(); setInterval(probeAi, 15 * 60_000).unref(); }
app.get('/api/status', (_req, res) => res.json({
  ai: !AI_ENABLED ? 'disabled' : usedToday >= DAILY_LIMIT || spentToday >= DAILY_BUDGET_USD ? 'daily_limit' : aiHealth.ok === false ? 'paused' : 'ok',
}));
app.get('/api/samples', (_req, res) => res.json(samples));
app.get('/api/challenge', rateLimit({ windowMs: 10 * 60_000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false }), (_req, res) => res.json(issueChallenge()));

const limiter = rateLimit({
  windowMs: 10 * 60_000,
  limit: 12,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many requests from your connection. Try again in a few minutes.' },
});

app.post('/api/extract', limiter, async (req, res) => {
  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  if (text.length < 10) return res.status(400).json({ error: 'Paste some text first.' });
  if (text.length > MAX_CHARS) {
    return res.status(413).json({ error: `This demo accepts up to ${MAX_CHARS.toLocaleString()} characters.` });
  }

  const key = hash(text);
  if (sampleResults.has(key)) {
    const extraction = fixtures[sampleResults.get(key)];
    return res.json({ extraction, validation: runChecks(extraction), meta: { model: 'saved sample extraction', ms: 0 }, sample: true });
  }
  if (cache.has(key)) return res.json({ ...cache.get(key), cached: true });

  if (!AI_ENABLED) return res.status(503).json({ error: 'Live extraction of your own text is switched off right now. The three samples above still work.' });
  const today = new Date().toISOString().slice(0, 10);
  if (today !== day) { day = today; usedToday = 0; spentToday = 0; }
  if (usedToday >= DAILY_LIMIT || spentToday >= DAILY_BUDGET_USD) {
    return res.status(429).json({ error: 'The demo has hit its daily limit. The samples still work, or try again tomorrow.' });
  }
  const powProblem = verifyChallenge(req.body?.token, req.body?.nonce);
  if (powProblem) return res.status(403).json({ error: 'Verification failed. Reload the page and try again.', reason: powProblem });
  usedToday++;

  const started = Date.now();
  try {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 8000,
      system: SYSTEM,
      messages: [{ role: 'user', content: text }],
      output_config: { effort: 'low', format: zodOutputFormat(Extraction) },
    });

    spentToday += costOf(response.usage);
    if (response.stop_reason === 'refusal' || !response.parsed_output) {
      return res.status(422).json({ error: 'The model could not read this text as a business record.' });
    }

    const extraction = response.parsed_output;
    const result = {
      extraction,
      validation: runChecks(extraction),
      meta: { model: MODEL, ms: Date.now() - started },
    };
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
    cache.set(key, result);
    res.json(result);
  } catch (err) {
    usedToday = Math.max(0, usedToday - 1);
    if (err instanceof Anthropic.RateLimitError) {
      return res.status(503).json({ error: 'The AI service is busy. Try again in a minute.' });
    }
    if (err instanceof Anthropic.BadRequestError && /credit balance/i.test(err.message)) {
      console.error('anthropic: out of credit');
      aiHealth.ok = false;
      return res.status(503).json({ error: 'Live reading of your own text is paused right now. The three samples still work.', paused: true });
    }
    if (err instanceof Anthropic.APIError) {
      console.error('anthropic error', err.status, err.message);
      return res.status(502).json({ error: 'The AI service returned an error. Try again shortly.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Something went wrong on our side.' });
  }
});

app.listen(PORT, () => console.log(`extract demo on :${PORT} using ${MODEL}; AI ${AI_ENABLED ? 'on' : 'off'}`));
