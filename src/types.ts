/**
 * WISDOM record types, v0.1.
 * Witnessed Independent Signed Decision On Merit: an open record that proves a piece of agent work was reviewed
 * independently before it was released.
 */

/** What was reviewed: the hash of the exact work, its kind, and who made it. */
export interface WorkRef {
  /** sha256 (hex) of the exact work: see hashWork(). Any change to the work voids the record. */
  sha256: string;
  kind: 'post' | 'file' | 'code' | 'decision' | (string & {});
  /** The agent (or person) who made the work. Nobody reviews their own work. */
  author: string;
}

/** The principal's verdict. */
export type Verdict = 'release' | 'rework' | 'drop';

interface SeatBase {
  /** Stable id of the agent or person in this seat (a DID, a citizen id, a handle). */
  agent: string;
  /** The seat's ed25519 public key, base64 of the raw 32 bytes. */
  key: string;
  /** ed25519 signature (base64) over seatPayload(record, seat). Set by signSeat(). */
  sig?: string;
}

/** Decides. Cannot release what the fact checker or the reviewer refused. */
export interface PrincipalSeat extends SeatBase {
  role: 'principal';
  verdict: Verdict;
  why: string;
}

/** Witnessed: checks every claim against named evidence. */
export interface FactSeat extends SeatBase {
  role: 'fact';
  ok: boolean;
  /** The evidence each claim was checked against: URLs, document references, transaction ids. */
  evidence: string[];
  notes?: string;
}

/** Independent: did not make the work; answers one question, does it serve the people it reaches. */
export interface ReviewerSeat extends SeatBase {
  role: 'reviewer';
  ok: boolean;
  /** The agents this reviewer is independent of; must include the work's author. */
  independent_of: string[];
  notes?: string;
}

export type Seat = PrincipalSeat | FactSeat | ReviewerSeat;

/** Facts measured on the finished work, recorded beside the verdict, never guessed. */
export type Measured = Record<string, number | string | boolean>;

/** Where and when the released work goes out (optional). */
export interface Release {
  slot?: string;
  channel?: string;
  by?: string;
  [k: string]: unknown;
}

export interface WisdomRecord {
  wisdom: '0.1';
  work: WorkRef;
  /** 1 for a first review, 2 for the one review a rework is allowed. */
  round: 1 | 2;
  seats: Seat[];
  measured?: Measured;
  release?: Release;
  /** ISO 8601 time the record was made. */
  at: string;
}

export interface VerifyOptions {
  /** The work itself: when given, its hash must match work.sha256. */
  work?: WorkContent;
  /** Pinned public keys per agent (base64 raw ed25519). When given, every seat's key must match its agent's pin. */
  keys?: Record<string, string>;
}

/** The parts of a work that are hashed: text, and media as bytes or as their own sha256 hex. */
export interface WorkContent {
  text?: string | string[];
  media?: Array<Uint8Array | { sha256: string }>;
}

export interface VerifyResult {
  ok: boolean;
  /** One line per broken rule, prefixed with the rule: witnessed, independent, signed, decision, schema. */
  errors: string[];
  /** True when the record proves the work may be released: ok and the principal's verdict is release. */
  releasable: boolean;
}
