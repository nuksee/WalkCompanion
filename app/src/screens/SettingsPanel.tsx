import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { LLM_MODEL } from '../llm/rewriteFact';
import { loadApiKey, saveApiKey } from '../llm/settings';

interface Props {
  onKeyChange: (key: string | null) => void;
}

/** Lets the user paste their own LLM API key. Stored in the device secure store. */
export function SettingsPanel({ onKeyChange }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadApiKey().then((key) => {
      setSaved(!!key);
      onKeyChange(key);
    });
  }, [onKeyChange]);

  const save = async () => {
    await saveApiKey(draft);
    const key = draft.trim() || null;
    setSaved(!!key);
    setDraft('');
    onKeyChange(key);
    setOpen(false);
  };

  return (
    <View style={styles.wrap}>
      <Pressable onPress={() => setOpen((o) => !o)}>
        <Text style={styles.link}>
          {open ? 'Hide settings' : 'Settings'}
          {saved ? '  ·  AI rewrite on' : '  ·  AI rewrite off'}
        </Text>
      </Pressable>
      {open && (
        <View style={styles.panel}>
          <Text style={styles.label}>Gemini API key</Text>
          <Text style={styles.help}>
            Facts are rewritten by {LLM_MODEL} into short spoken sentences. Leave empty to
            hear the raw Wikipedia text. The key never leaves this device except to call the API.
          </Text>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder={saved ? 'Key saved. Paste a new one to replace it.' : 'Paste key'}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={styles.row}>
            <Pressable onPress={save} style={styles.button}>
              <Text style={styles.buttonText}>{draft.trim() ? 'Save' : 'Clear key'}</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  link: { color: '#1f5fa8', fontSize: 14 },
  panel: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  label: { fontWeight: '600', marginBottom: 4 },
  help: { color: '#666', fontSize: 12, lineHeight: 17, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
  },
  row: { flexDirection: 'row', marginTop: 8 },
  button: { backgroundColor: '#1f5fa8', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  buttonText: { color: '#fff', fontWeight: '600' },
});
