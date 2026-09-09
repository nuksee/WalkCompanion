import * as SecureStore from 'expo-secure-store';

const KEY = 'llm_api_key';

/** The user's own LLM API key, kept in the device's secure store. */
export function loadApiKey(): Promise<string | null> {
  return SecureStore.getItemAsync(KEY);
}

export async function saveApiKey(value: string): Promise<void> {
  const trimmed = value.trim();
  if (trimmed) await SecureStore.setItemAsync(KEY, trimmed);
  else await SecureStore.deleteItemAsync(KEY);
}
