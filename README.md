# AI data extraction with built-in checks

**Live demo:** https://extract.frankonline.cloud

Paste a messy WhatsApp sales report, invoice email or supplier order chat. An LLM extracts a structured record **exactly as written**, then plain code checks every number. Anything doubtful is flagged for a person instead of slipping into your books.

![Demo](docs/screenshot.png)

## The idea: AI reads, code checks, a person approves

LLMs are good at reading messy text and bad at being trusted with arithmetic. So the model is told to copy numbers as written and never fix them, and `checks.mjs` verifies:

- each line: quantity × unit price = amount
- lines + adjustments (discounts, tax, delivery) = stated total
- payments received = total (money unaccounted for is flagged)
- duplicate lines (the same item and amount entered twice)
- missing date, and anything the model itself marked uncertain

Each record comes out as **ready**, **needs review** or **blocked**.

![A clean invoice that passes every check](docs/ready.png)

## Stack

Node 22, Express 5, structured outputs from OpenAI (strict JSON schema) or Anthropic (`messages.parse`), both from one Zod schema. The model runs through `llm.mjs`, a small adapter that speaks OpenAI or Anthropic (`PROVIDER`); the live demo uses OpenAI `gpt-4.1-mini`., plain HTML/CSS/JS, Docker + Caddy.

The three samples use saved extractions, so they cost nothing; the checks still run live on them. Custom text calls the API behind a proof-of-work check, a per-IP rate limit, a daily call and dollar cap, and an `AI_ENABLED` kill switch.

## Run it

```bash
npm install
cp .env.example .env   # add OPENAI_API_KEY (or ANTHROPIC_API_KEY with PROVIDER=anthropic)
node --env-file=.env server.mjs   # http://localhost:5180
node --test
```

Built by [Frank A.](https://www.upwork.com/freelancers/~0170dd39761ac49004), AI integration engineer.
