import * as SecureStore from 'expo-secure-store';
import { DEFAULT_TAGS } from './preferences';
import { FACT_TAGS, type FactTag } from './types';

const KEY = 'fact_tags';

/** Selected fact-type tags, kept on the device so they survive a relaunch. */
export async function loadTags(): Promise<FactTag[]> {
  const raw = await SecureStore.getItemAsync(KEY);
  if (raw == null) return DEFAULT_TAGS;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_TAGS;
    return parsed.filter((t): t is FactTag => (FACT_TAGS as readonly string[]).includes(t));
  } catch {
    return DEFAULT_TAGS;
  }
}

export function saveTags(tags: FactTag[]): Promise<void> {
  return SecureStore.setItemAsync(KEY, JSON.stringify(tags));
}
