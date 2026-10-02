// Proof-of-work gate (same scheme as the receptionist demo): the browser must find a nonce
// where sha256(salt + ":" + nonce) starts with `bits` zero bits before an AI call is made.
import { createHmac, createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const SECRET = process.env.GUARD_SECRET ?? randomBytes(32).toString('hex');
const BITS = Number(process.env.POW_BITS ?? 17);
const sign = (s) => createHmac('sha256', SECRET).update(s).digest('base64url');
const used = new Map(); // challenge id -> expiry, prevents replay

export function issueChallenge() {
  const body = { id: randomBytes(12).toString('hex'), salt: randomBytes(16).toString('hex'), bits: BITS, exp: Date.now() + 5 * 60_000 };
  const encoded = Buffer.from(JSON.stringify(body)).toString('base64url');
  return { token: `${encoded}.${sign(encoded)}`, salt: body.salt, bits: body.bits };
}

function leadingZeroBits(buf) {
  let bits = 0;
  for (const byte of buf) {
    if (byte === 0) { bits += 8; continue; }
    return bits + Math.clz32(byte) - 24;
  }
  return bits;
}

/** Problem with the solution, or null when it is valid. Each challenge works once. */
export function verifyChallenge(token, nonce) {
  const [encoded, mac] = String(token ?? '').split('.');
  if (!encoded || !mac) return 'missing';
  const expected = Buffer.from(sign(encoded));
  if (expected.length !== Buffer.from(mac).length || !timingSafeEqual(expected, Buffer.from(mac))) return 'bad_signature';
  const body = JSON.parse(Buffer.from(encoded, 'base64url').toString());
  if (Date.now() > body.exp) return 'expired';
  if (used.has(body.id)) return 'replayed';
  if (leadingZeroBits(createHash('sha256').update(`${body.salt}:${nonce}`).digest()) < body.bits) return 'wrong_answer';
  used.set(body.id, body.exp);
  return null;
}

setInterval(() => { const now = Date.now(); for (const [id, exp] of used) if (now > exp) used.delete(id); }, 5 * 60_000).unref();
