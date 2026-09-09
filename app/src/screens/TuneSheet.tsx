import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { FACT_TAGS, type FactTag } from '../facts/types';
import { colors, radius } from '../theme/tokens';

interface SheetProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
}

/** Bottom sheet over a scrim; shared by the Tune and Settings panels. */
export function BottomSheet({ visible, onClose, children }: SheetProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        {children}
      </View>
    </Modal>
  );
}

interface Props {
  visible: boolean;
  selected: FactTag[];
  onToggle: (tag: FactTag) => void;
  onClose: () => void;
}

/** Fact-type preferences. Nothing selected falls back to history and architecture. */
export function TuneSheet({ visible, selected, onToggle, onClose }: Props) {
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View>
        <Text style={styles.title}>What do you want to hear?</Text>
        <Text style={styles.subtitle}>Nothing selected means history and architecture first.</Text>
      </View>
      <View style={styles.chips}>
        {FACT_TAGS.map((tag) => {
          const on = selected.includes(tag);
          return (
            <Pressable
              key={tag}
              onPress={() => onToggle(tag)}
              style={[styles.chip, on ? styles.chipOn : styles.chipOff]}
            >
              <Text style={on ? styles.chipTextOn : styles.chipTextOff}>{tag}</Text>
            </Pressable>
          );
        })}
      </View>
      <Pressable
        onPress={onClose}
        style={({ pressed }) => [styles.done, pressed && styles.donePressed]}
      >
        <Text style={styles.doneText}>Done</Text>
      </Pressable>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: colors.scrim },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.neutral500,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 14,
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.neutral700, alignSelf: 'center' },
  title: { fontSize: 18, fontWeight: '500', color: colors.text },
  subtitle: { fontSize: 12, color: colors.neutral500, marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { height: 34, paddingHorizontal: 14, borderRadius: 6, justifyContent: 'center' },
  chipOn: { backgroundColor: colors.accent800 },
  chipOff: { backgroundColor: colors.neutral800 },
  chipTextOn: { fontSize: 13, color: colors.accent100 },
  chipTextOff: { fontSize: 13, color: colors.neutral100 },
  done: {
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  donePressed: { backgroundColor: colors.accentPress },
  doneText: { fontSize: 16, fontWeight: '500', color: colors.accent },
});
