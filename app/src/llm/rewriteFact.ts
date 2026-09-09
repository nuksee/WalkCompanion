import type { PointOfInterest } from '../facts/types';

/**
 * Gemini via its OpenAI-compatible endpoint. Other providers only need a
 * different base URL and model. Kept here, free of Expo imports, so this
 * module stays unit-testable under Node.
 */
export const LLM_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai';
export const LLM_MODEL = 'gemini-3.6-flash';

const SYSTEM_PROMPT = `You are a friendly walking tour guide. Rewrite the source text about a place into
1 to 3 spoken sentences that take under 20 seconds to say aloud. Use only facts present in the
source text; never add details, dates, or names that are not there. Prefer history, architecture,
and local culture over statistics. Plain prose, no lists, no markdown, no preamble.`;

/** Builds the chat messages sent to the model. Pure, so it can be unit tested. */
export function buildMessages(poi: PointOfInterest) {
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `Place: ${poi.name}\n\nSource text:\n${poi.fact}` },
  ];
}

/** Pulls the assistant text out of an OpenAI-style chat completion, or null. */
export function extractText(json: unknown): string | null {
  const content = (json as { choices?: { message?: { content?: unknown } }[] })?.choices?.[0]
    ?.message?.content;
  return typeof content === 'string' && content.trim() ? content.trim() : null;
}

/**
 * Asks the model to turn a raw extract into a short spoken fact.
 * Throws on HTTP or network failure and returns null on an empty reply;
 * the caller decides how to fall back. No logging here so the module
 * stays importable under Node for tests.
 */
export async function rewriteFact(poi: PointOfInterest, apiKey: string): Promise<string | null> {
  const send = () =>
    fetch(`${LLM_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: LLM_MODEL, messages: buildMessages(poi), temperature: 0.7 }),
    });
  let res = await send();
  // Free-tier Gemini often returns a brief 503/429 under load; one retry covers most of them.
  if (res.status === 429 || res.status >= 500) {
    await new Promise((r) => setTimeout(r, 1500));
    res = await send();
  }
  if (!res.ok) {
    const body = (await res.text()).replace(/\s+/g, ' ').slice(0, 200);
    throw new Error(`LLM HTTP ${res.status}: ${body}`);
  }
  return extractText(await res.json());
}
