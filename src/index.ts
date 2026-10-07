/**
 * WISDOM: Witnessed Independent Signed Decision On Merit.
 * An open record that proves a piece of agent work was reviewed independently before it was released.
 *
 * @version 0.1.0
 * @license Apache-2.0
 */

export * from './types.js';
export * from './record.js';

/** Protocol version constant: bumps on breaking schema changes. */
export const WISDOM_VERSION = '0.1' as const;
