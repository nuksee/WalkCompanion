import * as Speech from 'expo-speech';

/** Speaks a fact aloud. Stops any narration already in progress. */
export async function narrate(text: string): Promise<void> {
  if (await Speech.isSpeakingAsync()) {
    Speech.stop();
  }
  return new Promise((resolve, reject) => {
    Speech.speak(text, {
      language: 'en-CA',
      rate: 0.95,
      onDone: () => resolve(),
      onStopped: () => resolve(),
      onError: (e) => reject(e),
    });
  });
}

export function stopNarration(): void {
  Speech.stop();
}
