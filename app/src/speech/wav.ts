/**
 * Wraps raw 16-bit mono PCM (as base64) in a WAV container without decoding
 * it. The header is padded to 54 bytes with a JUNK chunk so its base64 form
 * (72 chars, no padding) can simply be prepended to the PCM's base64.
 * Pure module: no Expo imports, unit-tested under Node.
 */

const HEADER_BYTES = 54;

/** Byte length of the data a base64 string encodes. */
export function base64ByteLength(b64: string): number {
  const clean = b64.replace(/[\r\n=]/g, '');
  return Math.floor((clean.length * 3) / 4);
}

export function wavHeader(pcmBytes: number, sampleRate: number): Uint8Array {
  const h = new Uint8Array(HEADER_BYTES);
  const v = new DataView(h.buffer);
  const ascii = (at: number, s: string) => {
    for (let i = 0; i < s.length; i++) h[at + i] = s.charCodeAt(i);
  };
  const channels = 1;
  const bitsPerSample = 16;
  const blockAlign = channels * (bitsPerSample / 8);

  ascii(0, 'RIFF');
  v.setUint32(4, HEADER_BYTES - 8 + pcmBytes, true);
  ascii(8, 'WAVE');

  ascii(12, 'fmt ');
  v.setUint32(16, 16, true); // fmt chunk size
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, channels, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * blockAlign, true);
  v.setUint16(32, blockAlign, true);
  v.setUint16(34, bitsPerSample, true);

  ascii(36, 'JUNK'); // 2-byte pad chunk so the header is a multiple of 3 bytes
  v.setUint32(40, 2, true);
  // bytes 44-45 are the junk payload (zeros)

  ascii(46, 'data');
  v.setUint32(50, pcmBytes, true);
  return h;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Minimal base64 encoder for the small header; length is a multiple of 3 so no padding. */
export function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    out += i + 1 < bytes.length ? B64[(n >> 6) & 63] : '=';
    out += i + 2 < bytes.length ? B64[n & 63] : '=';
  }
  return out;
}

/** Base64 of a complete WAV file for the given base64 PCM. */
export function pcmBase64ToWavBase64(pcmBase64: string, sampleRate: number): string {
  const pcm = pcmBase64.replace(/[\r\n]/g, '');
  return bytesToBase64(wavHeader(base64ByteLength(pcm), sampleRate)) + pcm;
}

/** Parses the sample rate from a MIME type like "audio/L16;codec=pcm;rate=24000". */
export function sampleRateFromMime(mime: string | undefined, fallback = 24000): number {
  const m = mime?.match(/rate=(\d+)/);
  return m ? Number(m[1]) : fallback;
}
