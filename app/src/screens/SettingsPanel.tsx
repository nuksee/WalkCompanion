import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { LLM_MODEL } from '../llm/rewriteFact';
import { loadApiKey, saveApiKey } from '../llm/settings';
import { log } from '../log';
import { colors, radius } from '../theme/tokens';
import { BottomSheet } from './TuneSheet';

interface Props {
  visible: boolean;
  onClose: () => void;
  onKeyChange: (key: string | null) => void;
}

/**
 * Lets the user paste their own LLM API key, stored in the device secure store.
 * Presented as a bottom sheet matching the Tune sheet.
 */
export function SettingsPanel({ visible, onClose, onKeyChange }: Props) {
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
    log('settings', key ? 'API key saved' : 'API key cleared');
    setSaved(!!key);
    setDraft('');
    onKeyChange(key);
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View>
        <Text style={styles.title}>Gemini API key</Text>
        <Text style={styles.subtitle}>{saved ? 'AI rewrite on' : 'AI rewrite off'}</Text>
      </View>
      <Text style={styles.help}>
        With a key, facts are rewritten by {LLM_MODEL} into short spoken sentences and read by a
        natural Gemini voice. Without one you hear raw Wikipedia text in the phone's own voice. The
        key never leaves this device except to call Google's API.
      </Text>
      <TextInput
        style={styles.input}
        value={draft}
        onChangeText={setDraft}
        placeholder={saved ? 'Key saved. Paste a new one to replace it.' : 'Paste key'}
        placeholderTextColor={colors.neutral600}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Pressable onPress={save} style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}>
        <Text style={styles.buttonText}>{draft.trim() ? 'Save' : 'Clear key'}</Text>
      </Pressable>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '500', color: colors.text },
  subtitle: { fontSize: 12, color: colors.neutral500, marginTop: 2 },
  help: { fontSize: 12, lineHeight: 18, color: colors.neutral500 },
  input: {
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  button: {
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  buttonPressed: { backgroundColor: colors.accentPress },
  buttonText: { fontSize: 16, fontWeight: '500', color: colors.accent },
});
