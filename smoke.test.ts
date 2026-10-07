/**
 * WISDOM smoke tests, v0.1. Run via: npx tsx smoke.test.ts
 *
 * Covers: a valid released record; each of the four rules broken on purpose; a change to the work after the decision;
 * pinned keys; rework rounds.
 */
import { generateSeatKey, hashWork, signSeat, verifyRecord, WISDOM_VERSION, type WisdomRecord, type Seat } from './src/index.js';

const PASS: string[] = [];
const FAIL: string[] = [];
function expect(label: string, cond: boolean): void {
  (cond ? PASS : FAIL).push(label);
  console.log(`${cond ? '✓' : '✗'} ${label}`);
}

const work = { text: ['Batch.', 'Five paid requests, one claim on chain.'], media: [{ sha256: 'a'.repeat(64) }] };
const kp = { cmo: generateSeatKey(), fact: generateSeatKey(), human: generateSeatKey(), other: generateSeatKey() };

function build(over: (r: WisdomRecord) => void = () => {}, sign = true): WisdomRecord {
  const r: WisdomRecord = {
    wisdom: '0.1', round: 1, at: '2026-10-05T12:00:00Z',
    work: { sha256: hashWork(work), kind: 'post', author: 'agent:writer' },
    seats: [
      { role: 'principal', agent: 'agent:cmo', key: kp.cmo.publicKey, verdict: 'release', why: 'a checkable fact, no hype' },
      { role: 'fact', agent: 'agent:fact', key: kp.fact.publicKey, ok: true, evidence: ['https://solscan.io/tx/5p4i'] },
      { role: 'reviewer', agent: 'agent:human', key: kp.human.publicKey, ok: true, independent_of: ['agent:writer'], notes: 'serves builders' },
    ],
    measured: { length_x: 202 },
  };
  over(r);
  if (sign) for (const s of r.seats) signSeat(r, s, { principal: kp.cmo, fact: kp.fact, reviewer: kp.human }[s.role].privateKey);
  return r;
}
const seat = <R extends Seat['role']>(r: WisdomRecord, role: R) => r.seats.find((s) => s.role === role) as Extract<Seat, { role: R }>;

expect('version constant is 0.1', WISDOM_VERSION === '0.1');

const good = build();
const g = verifyRecord(good, { work });
expect('a valid record verifies and is releasable', g.ok && g.releasable && g.errors.length === 0);

// Signed
const changed = verifyRecord(good, { work: { ...work, text: ['Batch!', 'Five paid requests, one claim on chain.'] } });
expect('a change to the work after the decision is caught', !changed.ok && changed.errors.some((x) => x.startsWith('signed:')));
const tampered = build(); seat(tampered, 'principal').why = 'edited after signing';
expect('a seat edited after signing is caught', !verifyRecord(tampered).ok);
const unsigned = build(() => {}, false);
expect('an unsigned record fails', verifyRecord(unsigned).errors.filter((x) => x.includes('has not signed')).length === 3);
expect('a pinned key mismatch fails', !verifyRecord(good, { keys: { 'agent:fact': kp.other.publicKey } }).ok);
expect('pinned keys that match pass', verifyRecord(good, { keys: { 'agent:fact': kp.fact.publicKey, 'agent:cmo': kp.cmo.publicKey } }).ok);
let threw = false; try { signSeat(good, seat(good, 'fact'), kp.other.privateKey); } catch { threw = true; }
expect('signing a seat with someone else\'s key throws', threw);

// Independent
const self = build((r) => { r.work.author = 'agent:human'; seat(r, 'reviewer').independent_of = ['agent:human']; });
expect('a reviewer who made the work fails', verifyRecord(self).errors.some((x) => x.includes('the reviewer made the work')));
const same = build((r) => { seat(r, 'fact').agent = 'agent:cmo'; });
expect('two seats held by one agent fails', verifyRecord(same).errors.some((x) => x.includes('three different agents')));
const undeclared = build((r) => { seat(r, 'reviewer').independent_of = []; });
expect('a reviewer that does not declare independence fails', !verifyRecord(undeclared).ok);
const twoSeats = build((r) => { r.seats = r.seats.filter((s) => s.role !== 'reviewer'); });
expect('a record without a reviewer fails', !verifyRecord(twoSeats).ok);

// Witnessed
const noEvidence = build((r) => { seat(r, 'fact').evidence = []; });
expect('a fact pass with no evidence fails', verifyRecord(noEvidence).errors.some((x) => x.startsWith('witnessed:')));

// Decision On Merit
const overruled = build((r) => { seat(r, 'reviewer').ok = false; });
expect('releasing what the reviewer refused fails', verifyRecord(overruled).errors.some((x) => x.includes('released although')));
const dropped = build((r) => { seat(r, 'reviewer').ok = false; seat(r, 'principal').verdict = 'drop'; });
const d = verifyRecord(dropped);
expect('a valid drop verifies but is not releasable', d.ok && !d.releasable);
const secondRework = build((r) => { r.round = 2; seat(r, 'principal').verdict = 'rework'; });
expect('a second rework fails', verifyRecord(secondRework).errors.some((x) => x.includes('second rework')));
const noWhy = build((r) => { seat(r, 'principal').why = ' '; });
expect('a verdict without a reason fails', !verifyRecord(noWhy).ok);

console.log(`\n${PASS.length} passed, ${FAIL.length} failed`);
if (FAIL.length) process.exit(1);
