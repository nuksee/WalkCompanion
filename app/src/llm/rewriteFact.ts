import type { FactTag, PointOfInterest } from '../facts/types';

/** What the user has asked to hear, so the prompt can lean that way. */
export interface Steering {
  /** The tag this fact should be written towards. */
  tag?: FactTag;
  /** Compact like/dislike summary; see summariseFeedback. */
  feedback?: string | null;
}

/**
 * Gemini via its OpenAI-compatible endpoint. Other providers only need a
 * different base URL and model. Kept here, free of Expo imports, so this
 * module stays unit-testable under Node.
 */
export const LLM_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai';
export const LLM_MODEL = 'gemini-3.6-flash';
/** Per-attempt limit. A slow answer is worse than the raw text when someone is walking past. */
const REQUEST_TIMEOUT_MS = 8_000;

const SYSTEM_PROMPT = `You are a friendly walking tour guide. Rewrite the source text about a place into
1 to 3 spoken sentences that take under 20 seconds to say aloud. Use only facts present in the
source text; never add details, dates, or names that are not there. Prefer history, architecture,
and local culture over statistics. Plain prose, no lists, no markdown, no preamble.`;

/** Builds the chat messages sent to the model. Pure, so it can be unit tested. */
export function buildMessages(poi: PointOfInterest, steering: Steering = {}) {
  const hints = [
    steering.tag &&
      `Angle: the listener wants "${steering.tag}" content; lean that way if the source supports it.`,
    steering.feedback && `Listener feedback so far: ${steering.feedback}`,
  ].filter(Boolean);
  const user = [`Place: ${poi.name}`, ...hints, `Source text:\n${poi.fact}`].join('\n\n');
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: user },
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
export async function rewriteFact(
  poi: PointOfInterest,
  apiKey: string,
  steering: Steering = {},
): Promise<string | null> {
  // AbortController rather than AbortSignal.timeout: the latter is missing in React Native.
  const send = async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      return await fetch(`${LLM_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        // reasoning_effort "low" limits the model's hidden thinking; a two-sentence
        // rewrite does not need it and it was pushing responses past the timeout.
        body: JSON.stringify({
          model: LLM_MODEL,
          messages: buildMessages(poi, steering),
          temperature: 0.7,
          reasoning_effort: 'low',
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  };
  let res = await send();
  // Free-tier Gemini often returns a brief 503/429 under load; one retry covers most of them.
  if (res.status === 429 || res.status >= 500) {
    await new Promise((r) => setTimeout(r, 1000));
    res = await send();
  }
  if (!res.ok) {
    const body = (await res.text()).replace(/\s+/g, ' ').slice(0, 200);
    throw new Error(`LLM HTTP ${res.status}: ${body}`);
  }
  return extractText(await res.json());
}
