import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { File, Paths } from 'expo-file-system';

const MAX_PLAY_MS = 60_000;
let audioModeSet = false;

/** Writes base64 WAV to the cache and plays it; resolves when playback ends. */
export async function playWavBase64(wavBase64: string): Promise<void> {
  if (!audioModeSet) {
    await setAudioModeAsync({ playsInSilentMode: true });
    audioModeSet = true;
  }
  const file = new File(Paths.cache, 'narration.wav');
  file.write(wavBase64, { encoding: 'base64' });

  const player = createAudioPlayer(file.uri);
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = (err?: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      sub.remove();
      try {
        player.remove();
      } catch {
        // already released
      }
      if (err) reject(err);
      else resolve();
    };
    const timer = setTimeout(() => finish(), MAX_PLAY_MS);
    const sub = player.addListener('playbackStatusUpdate', (status) => {
      if (status.didJustFinish) finish();
    });
    try {
      player.play();
    } catch (e) {
      finish(e);
    }
  });
}
