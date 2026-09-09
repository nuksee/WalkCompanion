/**
 * Tiny console wrapper. Output shows up in the terminal running `expo start`
 * while the app runs on the phone. Never log the API key.
 */

/** Local wall-clock time as HH:MM:SS.mmm so durations between lines are easy to read. */
function stamp(): string {
  const d = new Date();
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`;
}

export function log(tag: string, ...args: unknown[]): void {
  console.log(`${stamp()} [${tag}]`, ...args);
}

export function logError(tag: string, error: unknown): void {
  console.warn(`${stamp()} [${tag}]`, error instanceof Error ? error.message : String(error));
}
