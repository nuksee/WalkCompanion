// Explicit extension so Node's test runner can resolve it; Metro accepts it too.
import { pcmBase64ToWavBase64, sampleRateFromMime } from './wav.ts';

/**
 * Gemini speech synthesis with the user's own key. Uses the native Gemini
 * endpoint (the OpenAI-compatible one has no speech route). Pure fetch, no
 * Expo imports, so it stays testable under Node.
 */

const BASE = 'https://generativelanguage.googleapis.com/v1beta';
const REQUEST_TIMEOUT_MS = 15_000;

/** Prebuilt Gemini voice. "Sulafat" is described by Google as warm. */
export const TTS_VOICE = 'Sulafat';

/** Style direction; Gemini TTS follows natural-language instructions in the text. */
const STYLE = 'Speak as a warm, relaxed walking tour guide, at an easy pace:';

let cachedModel: string | null = null;
/** All speech models the key could see, for logging. */
export let ttsModelsSeen: string[] = [];

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Numeric version from a model name like "gemini-3.1-flash-tts-preview" (3.1), or 0. */
function versionOf(name: string): number {
  const m = name.match(/gemini-(\d+(?:\.\d+)?)/i);
  return m ? Number(m[1]) : 0;
}

/**
 * Picks a speech model this key can use: newest version first, "flash" over
 * "pro" at the same version (faster and cheaper). Pure, for tests.
 */
export function pickTtsModel(names: string[]): string | null {
  const tts = names.filter((n) => /tts/i.test(n)).map((n) => n.replace(/^models\//, ''));
  if (tts.length === 0) return null;
  const score = (n: string) => versionOf(n) * 10 + (/flash/i.test(n) ? 1 : 0);
  return [...tts].sort((a, b) => score(b) - score(a))[0];
}

/** Asks Google which models the key can see and caches the chosen speech model. */
export async function findTtsModel(apiKey: string): Promise<string> {
  if (cachedModel) return cachedModel;
  const res = await fetchWithTimeout(`${BASE}/models?pageSize=200`, {
    headers: { 'x-goog-api-key': apiKey },
  });
  if (!res.ok) throw new Error(`TTS model list HTTP ${res.status}`);
  const json = (await res.json()) as { models?: { name: string }[] };
  const names = (json.models ?? []).map((m) => m.name);
  const model = pickTtsModel(names);
  if (!model) throw new Error('no Gemini speech model available for this key');
  cachedModel = model;
  ttsModelsSeen = names.filter((n) => /tts/i.test(n)).map((n) => n.replace(/^models\//, ''));
  return model;
}

/** Returns base64 WAV audio for the text, or throws. */
export async function synthesize(
  text: string,
  apiKey: string,
): Promise<{ wavBase64: string; model: string }> {
  const model = await findTtsModel(apiKey);
  const send = () =>
    fetchWithTimeout(`${BASE}/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${STYLE} ${text}` }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: TTS_VOICE } } },
        },
      }),
    });
  let res = await send();
  // Same as the text model: one retry covers most brief 503/429 spikes.
  if (res.status === 429 || res.status >= 500) {
    await new Promise((r) => setTimeout(r, 1000));
    res = await send();
  }
  if (!res.ok) {
    const body = (await res.text()).replace(/\s+/g, ' ').slice(0, 200);
    throw new Error(`TTS ${model} HTTP ${res.status}: ${body}`);
  }
  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { inlineData?: { mimeType?: string; data?: string } }[] } }[];
  };
  const part = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  const data = part?.inlineData?.data;
  if (!data) throw new Error('TTS response had no audio');
  const rate = sampleRateFromMime(part?.inlineData?.mimeType);
  return { wavBase64: pcmBase64ToWavBase64(data, rate), model };
}
