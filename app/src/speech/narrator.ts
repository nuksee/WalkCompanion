import * as Speech from 'expo-speech';
import { log, logError } from '../log';
import { findTtsModel, synthesize, TTS_VOICE, ttsModelsSeen } from './geminiTts';
import { playWavBase64 } from './player';

/** Longest we wait for the device speech engine to report done before moving on. */
const MAX_UTTERANCE_MS = 45_000;

/** Preferred accents for the device fallback voice, best first. */
const PREFERRED_LANGS = ['en-CA', 'en-US', 'en-GB', 'en-AU'];

let chosenVoice: string | null | undefined; // undefined = not looked up yet
let lastVoiceUsed = 'none yet';
let ttsModelLogged = false;

/**
 * Picks the best installed English voice once for the device fallback.
 * Android flags every voice "Enhanced", so identifier hints matter more:
 * Google's "network" voices are clearly better than the "local" ones.
 */
async function pickDeviceVoice(): Promise<string | null> {
  if (chosenVoice !== undefined) return chosenVoice;
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    const english = voices.filter((v) => v.language.toLowerCase().startsWith('en'));
    const rank = (v: Speech.Voice) => {
      const id = v.identifier.toLowerCase();
      const langRank = PREFERRED_LANGS.indexOf(v.language);
      return (
        (id.includes('network') ? 0 : 1000) +
        (v.quality === Speech.VoiceQuality.Enhanced ? 0 : 100) +
        (langRank === -1 ? PREFERRED_LANGS.length : langRank)
      );
    };
    english.sort((a, b) => rank(a) - rank(b));
    chosenVoice = english[0]?.identifier ?? null;
    log('voice', `device fallback voice: ${chosenVoice ?? 'system default'}`);
  } catch {
    chosenVoice = null;
  }
  return chosenVoice;
}

async function speakOnDevice(text: string): Promise<void> {
  if (await Speech.isSpeakingAsync()) Speech.stop();
  const voice = await pickDeviceVoice();
  lastVoiceUsed = `device:${voice ?? 'default'}`;
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (err?: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (err) reject(err);
      else resolve();
    };
    const timer = setTimeout(() => finish(), MAX_UTTERANCE_MS);
    Speech.speak(text, {
      language: 'en-CA',
      voice: voice ?? undefined,
      rate: 0.92,
      onDone: () => finish(),
      onStopped: () => finish(),
      onError: (e) => finish(e),
    });
  });
}

/**
 * Speaks a fact aloud and resolves when it finishes. With an API key, uses
 * Gemini speech for a natural voice; on any failure, or without a key, falls
 * back to the device engine so narration always happens.
 */
export async function narrate(text: string, apiKey: string | null): Promise<void> {
  if (apiKey) {
    try {
      if (!ttsModelLogged) {
        const model = await findTtsModel(apiKey);
        log('tts', `speech models for this key: ${ttsModelsSeen.join(', ')} | using ${model}`);
        ttsModelLogged = true;
      }
      const started = Date.now();
      const { wavBase64, model } = await synthesize(text, apiKey);
      log('tts', `${model}/${TTS_VOICE} in ${Date.now() - started}ms, ${Math.round(wavBase64.length / 1024)}KB`);
      lastVoiceUsed = `gemini:${TTS_VOICE}`;
      await playWavBase64(wavBase64);
      return;
    } catch (e) {
      logError('tts', e);
      log('tts', 'falling back to device voice');
    }
  }
  await speakOnDevice(text);
}

/** Which voice the last narration used, for logging. */
export function currentVoice(): string {
  return lastVoiceUsed;
}

export function stopNarration(): void {
  Speech.stop();
}
