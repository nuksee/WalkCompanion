/**
 * Tiny console wrapper. Output shows up in the terminal running `expo start`
 * while the app runs on the phone. Never log the API key.
 */
export function log(tag: string, ...args: unknown[]): void {
  console.log(`[${tag}]`, ...args);
}

export function logError(tag: string, error: unknown): void {
  console.warn(`[${tag}]`, error instanceof Error ? error.message : String(error));
}
