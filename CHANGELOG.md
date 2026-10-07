# Changelog

All notable changes to `@godman-protocols/wisdom` will be documented in this file.

## [0.1.0] 2026-10-05

First release, a working code draft. Named by the Founder of Kognai on 2026-10-04 after Kognai's Node of Wisdom.

### Added
- `WisdomRecord` and its seats (principal, fact, reviewer), `Measured`, `Release`
- `hashWork()`: sha256 of the exact text parts and media
- `generateSeatKey()`, `signSeat()`: ed25519 signing per seat over canonical JSON
- `verifyRecord()`: the four rules (witnessed, independent, signed, decision on merit), pinned keys, the work check
- 17 smoke tests
