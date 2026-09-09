import * as Speech from 'expo-speech';

/** Longest we wait for the speech engine to report done before moving on. */
const MAX_UTTERANCE_MS = 45_000;

/**
 * Speaks a fact aloud and resolves when it finishes. Stops any narration
 * already in progress. Android's engine sometimes never fires onDone, so a
 * timeout guarantees the promise settles and the app cannot wedge.
 */
export async function narrate(text: string): Promise<void> {
  if (await Speech.isSpeakingAsync()) {
    Speech.stop();
  }
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
      rate: 0.95,
      onDone: () => finish(),
      onStopped: () => finish(),
      onError: (e) => finish(e),
    });
  });
}

export function stopNarration(): void {
  Speech.stop();
}
