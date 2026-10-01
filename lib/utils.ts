import { createHmac } from 'crypto';
import { format } from 'date-fns';

const CLOSE_SECRET = process.env.CLOSE_CODE_SECRET || 'cnslg-secret-fallback';

/**
 * Generates a deterministic 6-digit close code for a given date.
 * Code changes each day and is the same for all admins on the same day.
 */
export function generateCloseCode(date: Date = new Date()): string {
  const dateStr = format(date, 'yyyy-MM-dd');
  const hmac = createHmac('sha256', CLOSE_SECRET);
  hmac.update(dateStr);
  const hash = hmac.digest('hex');
  // Take first 6 hex chars, convert to 6-digit number
  const num = parseInt(hash.substring(0, 6), 16) % 1000000;
  return num.toString().padStart(6, '0');
}

/**
 * Generates a random 6-char alphanumeric key for daily exam access.
 */
export function generateExamAccessKey(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0,O,I,1 to avoid confusion
  let key = '';
  for (let i = 0; i < 6; i++) {
    key += chars[Math.floor(Math.random() * chars.length)];
  }
  return key;
}

/**
 * Distributes 100 points across N questions with no decimals.
 * First (100 % N) questions get floor(100/N)+1 points, rest get floor(100/N).
 */
export function distribuirPesos(n: number): number[] {
  if (n <= 0) return [];
  const base = Math.floor(100 / n);
  const extras = 100 % n;
  return Array.from({ length: n }, (_, i) => (i < extras ? base + 1 : base));
}

/**
 * Validates that weights array sums to exactly 100.
 */
export function validarPesos(pesos: number[]): boolean {
  return pesos.reduce((a, b) => a + b, 0) === 100;
}

/**
 * Calculates final grade for a set of answers.
 */
export function calcularCalificacion(
  respuestas: Array<{ esCorrecta: boolean; puntajeObtenido: number }>
): number {
  return respuestas.reduce((sum, r) => sum + (r.puntajeObtenido || 0), 0);
}

/**
 * Returns today's date as YYYY-MM-DD string.
 */
export function hoy(): string {
  return format(new Date(), 'yyyy-MM-dd');
}
