import { createHmac } from 'crypto';

export const TIMEZONE_BOGOTA = 'America/Bogota';

const CLOSE_SECRET = process.env.CLOSE_CODE_SECRET || 'cnslg-secret-fallback';

/**
 * Returns today's date in Colombia (America/Bogota, UTC-5) as 'YYYY-MM-DD' string.
 * This guarantees that even when running on Vercel (UTC+0), dates match the school day in Bogotá.
 */
export function hoy(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE_BOGOTA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * Generates a deterministic 6-digit close code for a given date in Bogotá time.
 * Code changes each day and is the same for all admins on the same day.
 */
export function generateCloseCode(date: Date = new Date()): string {
  const dateStr = hoy(date);
  const hmac = createHmac('sha256', CLOSE_SECRET);
  hmac.update(dateStr);
  const hash = hmac.digest('hex');
  // Take first 6 hex chars, convert to 6-digit number
  const num = parseInt(hash.substring(0, 6), 16) % 1000000;
  return num.toString().padStart(6, '0');
}

/**
 * Returns current year in Colombia timezone.
 */
export function getAnioBogota(date: Date = new Date()): number {
  const yearStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE_BOGOTA,
    year: 'numeric',
  }).format(date);
  return parseInt(yearStr, 10);
}

/**
 * Format date in Colombia timezone (America/Bogota, UTC-5).
 * e.g., "1 oct 2026"
 */
export function formatFechaBogota(
  date: Date | string | number | undefined | null,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!date) return '';
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-CO', {
    timeZone: TIMEZONE_BOGOTA,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...options,
  });
}

/**
 * Format time in Colombia timezone (America/Bogota, UTC-5).
 * e.g., "04:15 p. m."
 */
export function formatHoraBogota(
  date: Date | string | number | undefined | null,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!date) return '';
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('es-CO', {
    timeZone: TIMEZONE_BOGOTA,
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  });
}

/**
 * Format full date & time in Colombia timezone (America/Bogota, UTC-5).
 * e.g., "1/10/2026, 04:15 p. m."
 */
export function formatFechaHoraBogota(
  date: Date | string | number | undefined | null,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!date) return '';
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('es-CO', {
    timeZone: TIMEZONE_BOGOTA,
    ...options,
  });
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
