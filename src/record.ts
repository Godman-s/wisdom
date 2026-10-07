/**
 * Hashing, signing and verifying WISDOM records. node:crypto only, no dependencies.
 */
import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, sign, verify as edVerify, type KeyObject } from 'node:crypto';
import type { Seat, VerifyOptions, VerifyResult, WisdomRecord, WorkContent } from './types.js';

const SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');   // DER header of an ed25519 public key

/** Canonical JSON: keys sorted at every depth, no spaces. The same object always gives the same bytes. */
export function canonical(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
  const o = v as Record<string, unknown>;
  return '{' + Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => JSON.stringify(k) + ':' + canonical(o[k])).join(',') + '}';
}

const sha = (b: Uint8Array | string) => createHash('sha256').update(b).digest('hex');

/** sha256 of the exact work: the text parts and each media's own sha256, in order. */
export function hashWork(w: WorkContent): string {
  const text = w.text === undefined ? [] : Array.isArray(w.text) ? w.text : [w.text];
  const media = (w.media || []).map((m) => (m instanceof Uint8Array ? sha(m) : m.sha256));
  return sha(canonical({ text, media }));
}

/** A fresh ed25519 key pair: the public key as base64 raw bytes (for the record), the private key as a KeyObject. */
export function generateSeatKey(): { publicKey: string; privateKey: KeyObject } {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return { publicKey: rawPublic(publicKey), privateKey };
}

/** base64 of the raw 32 byte ed25519 public key of a KeyObject (public or private). */
export function rawPublic(k: KeyObject): string {
  const pub = k.type === 'private' ? createPublicKey(k) : k;
  return (pub.export({ format: 'der', type: 'spki' }) as Buffer).subarray(SPKI_PREFIX.length).toString('base64');
}

function publicFromRaw(b64: string): KeyObject {
  return createPublicKey({ key: Buffer.concat([SPKI_PREFIX, Buffer.from(b64, 'base64')]), format: 'der', type: 'spki' });
}

/** What a seat signs: the record's work, round and time, and its own part (everything but its signature). */
export function seatPayload(r: Pick<WisdomRecord, 'wisdom' | 'work' | 'round' | 'at'>, seat: Seat): string {
  const { sig: _sig, ...part } = seat;
  return canonical({ wisdom: r.wisdom, work: r.work, round: r.round, at: r.at, seat: part });
}

/** Sign one seat of a record in place with its private key (a KeyObject or a PEM string). Returns the seat. */
export function signSeat(r: WisdomRecord, seat: Seat, privateKey: KeyObject | string): Seat {
  const key = typeof privateKey === 'string' ? createPrivateKey(privateKey) : privateKey;
  if (rawPublic(key) !== seat.key) throw new Error(`the private key does not match the public key of ${seat.role} ${seat.agent}`);
  seat.sig = sign(null, Buffer.from(seatPayload(r, seat)), key).toString('base64');
  return seat;
}

/**
 * Check a record against the four rules.
 *  Witnessed: the fact seat names its evidence; a fact seat that passes the work has at least one piece.
 *  Independent: a principal, a fact checker and a reviewer, three different agents; neither checker is the author;
 *    the reviewer declares independence from the author.
 *  Signed: every seat's signature is valid for its key over the record; pinned keys match; the work hash matches.
 *  Decision On Merit: a known verdict; release only when the fact checker and the reviewer both passed; at most one
 *    rework round.
 */
export function verifyRecord(r: WisdomRecord, opts: VerifyOptions = {}): VerifyResult {
  const errors: string[] = [];
  const e = (rule: string, msg: string) => errors.push(`${rule}: ${msg}`);
  if (r?.wisdom !== '0.1') e('schema', `unknown version ${String(r?.wisdom)}`);
  if (!r?.work || !/^[0-9a-f]{64}$/.test(r.work.sha256 || '')) e('schema', 'work.sha256 must be 64 hex characters');
  if (!r?.work?.author) e('schema', 'work.author is required');
  if (r?.round !== 1 && r?.round !== 2) e('decision', 'round must be 1 or 2 (a rework is reviewed again at most once)');
  if (!r?.at || Number.isNaN(Date.parse(r.at))) e('schema', 'at must be an ISO 8601 time');
  const seats = Array.isArray(r?.seats) ? r.seats : [];
  const one = <T extends Seat['role']>(role: T) => {
    const s = seats.filter((x) => x.role === role);
    if (s.length !== 1) e('independent', `exactly one ${role} seat is required, found ${s.length}`);
    return s[0] as Extract<Seat, { role: T }> | undefined;
  };
  const p = one('principal'), f = one('fact'), v = one('reviewer');
  if (errors.length && (!p || !f || !v || !r?.work)) return { ok: false, errors, releasable: false };

  // Independent
  const agents = [p!.agent, f!.agent, v!.agent];
  if (new Set(agents).size !== 3) e('independent', 'the principal, the fact checker and the reviewer must be three different agents');
  if (f!.agent === r.work.author) e('independent', 'the fact checker made the work');
  if (v!.agent === r.work.author) e('independent', 'the reviewer made the work');
  if (!Array.isArray(v!.independent_of) || !v!.independent_of.includes(r.work.author)) e('independent', 'the reviewer must declare independence from the author');

  // Witnessed
  if (!Array.isArray(f!.evidence)) e('witnessed', 'the fact seat must list its evidence');
  else if (f!.ok && f!.evidence.filter((x) => typeof x === 'string' && x.trim()).length === 0) e('witnessed', 'the fact checker passed the work without naming any evidence');

  // Decision On Merit
  if (!['release', 'rework', 'drop'].includes(p!.verdict)) e('decision', `unknown verdict ${String(p!.verdict)}`);
  if (p!.verdict === 'release' && !(f!.ok && v!.ok)) e('decision', 'released although the fact checker or the reviewer refused');
  if (r.round === 2 && p!.verdict === 'rework') e('decision', 'a second rework is not allowed: release or drop');
  if (!p!.why || !String(p!.why).trim()) e('decision', 'the principal must say why');

  // Signed
  for (const s of [p!, f!, v!]) {
    if (opts.keys && opts.keys[s.agent] !== undefined && opts.keys[s.agent] !== s.key) { e('signed', `${s.role} ${s.agent} signed with a key that is not its pinned key`); continue; }
    if (!s.sig) { e('signed', `${s.role} ${s.agent} has not signed`); continue; }
    let good = false;
    try { good = edVerify(null, Buffer.from(seatPayload(r, s)), publicFromRaw(s.key), Buffer.from(s.sig, 'base64')); } catch { good = false; }
    if (!good) e('signed', `the signature of ${s.role} ${s.agent} does not match the record (it changed after signing, or the key is wrong)`);
  }
  if (opts.work && hashWork(opts.work) !== r.work.sha256) e('signed', 'the work does not match the hash it was reviewed under: it changed after the decision');

  const ok = errors.length === 0;
  return { ok, errors, releasable: ok && p!.verdict === 'release' };
}
