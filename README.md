# WISDOM: Witnessed Independent Signed Decision On Merit

> A Godman Protocol. v0.1.0, working code draft. Apache 2.0.

WISDOM is an open, signed record that proves a piece of agent work was **reviewed independently before it was
released**: a post, a file, a piece of code, a decision. Anyone who receives the work can check who reviewed it,
against what evidence, what they decided, and that nothing changed after the decision.

It comes from Kognai's Node of Wisdom, the gate every official Kognai post has passed since 30 September 2026: a
principal who decides, a fact keeper and a human keeper. The record is open; the doctrine, the prompts and the
evidence each organisation reviews against stay its own.

```bash
npm install @godman-protocols/wisdom
```

## The four words are the four rules

| Word | Rule | Checked by `verifyRecord` |
|---|---|---|
| **Witnessed** | Every claim in the work is checked against named evidence (a document, a URL, an on chain transaction). The evidence travels with the record. | A fact seat that passes the work must name at least one piece of evidence. |
| **Independent** | Three seats: a **principal** who decides, a **fact** checker, and an independent **reviewer** who did not make the work and answers one question: does it serve the people it reaches? | Exactly one seat per role, three different agents, neither checker is the author, the reviewer declares independence from the author. |
| **Signed** | Each seat signs its part with ed25519. Every signature is bound to the hash of the exact work. | Every signature is valid over the record; pinned keys match; the work you hold hashes to the reviewed hash. Any change after the decision voids the record. |
| **Decision On Merit** | One of three verdicts: **release**, **rework** (reviewed again at most once) or **drop**, with the reason. Measured facts (length, size, loudness, test results) sit beside the verdict, never guessed. | A known verdict with a reason; no release over a refusal; no second rework. |

## Use

```ts
import { hashWork, generateSeatKey, signSeat, verifyRecord, type WisdomRecord } from '@godman-protocols/wisdom';

const work = { text: ['Five paid requests, one claim on chain.'], media: [videoBytes] };
const principal = generateSeatKey(), fact = generateSeatKey(), reviewer = generateSeatKey();

const record: WisdomRecord = {
  wisdom: '0.1', round: 1, at: new Date().toISOString(),
  work: { sha256: hashWork(work), kind: 'post', author: 'agent:writer' },
  seats: [
    { role: 'principal', agent: 'agent:cmo', key: principal.publicKey, verdict: 'release', why: 'a checkable fact' },
    { role: 'fact', agent: 'agent:fact', key: fact.publicKey, ok: true, evidence: ['https://solscan.io/tx/...'] },
    { role: 'reviewer', agent: 'agent:human', key: reviewer.publicKey, ok: true, independent_of: ['agent:writer'] },
  ],
  measured: { characters: 202, duration_s: 28.0 },
};
signSeat(record, record.seats[0]!, principal.privateKey);
signSeat(record, record.seats[1]!, fact.privateKey);
signSeat(record, record.seats[2]!, reviewer.privateKey);

const result = verifyRecord(record, { work });   // { ok, releasable, errors }
```

Each seat signs on its own machine with its own key: `signSeat` only needs the record and that seat's private key.
Pass `keys` (agent id to base64 public key) to `verifyRecord` to pin who each reviewer must be.

## The record

```json
{
  "wisdom": "0.1",
  "work": { "sha256": "<hashWork of the exact text and media>", "kind": "post", "author": "<id>" },
  "round": 1,
  "seats": [
    { "role": "principal", "agent": "<id>", "key": "<ed25519 base64>", "verdict": "release", "why": "...", "sig": "<base64>" },
    { "role": "fact", "agent": "<id>", "key": "...", "ok": true, "evidence": ["<url, doc or tx>"], "sig": "..." },
    { "role": "reviewer", "agent": "<id>", "key": "...", "ok": true, "independent_of": ["<author id>"], "notes": "...", "sig": "..." }
  ],
  "measured": { "duration_s": 93.2, "lufs": -14 },
  "release": { "slot": "2026-10-07T13:30:00Z", "channel": "x" },
  "at": "2026-10-05T12:00:00Z"
}
```

A seat signs the canonical JSON (keys sorted, no spaces) of the record's version, work, round and time plus its own
part without its signature. `hashWork` hashes the text parts and each media file's own sha256, in order.

## Where it fits

- **SCORE** grades an output; **WISDOM** proves the output was reviewed independently before it left.
- **LAX** listings and **BOND** deals can ask for a WISDOM record with each delivery.
- **PACT** mandates can name the reviewers an agent must pass.

## Status

v0.1.0 is a working code draft: the record, hashing, signing and verification, with 17 smoke tests
(`npm test`). Not yet in it: key discovery (who holds which key is pinned by the caller), a transport for records, and
records for multi file works beyond a list of media hashes. Comments and issues are welcome.

## Licence

Apache 2.0. Part of the Godman Protocols: https://kognai.ai/docs/protocols
