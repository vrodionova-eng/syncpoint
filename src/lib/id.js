import { randomBytes } from 'node:crypto';

/** Короткий случайный id (16 hex-символов). */
export function newId() {
  return randomBytes(8).toString('hex');
}
