import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useWalkLocation } from '../location/useWalkLocation';
import { pickNextFact } from '../facts/proximity';
import { torontoSeed } from '../facts/torontoSeed';
import type { PointOfInterest } from '../facts/types';
import { narrate, stopNarration } from '../speech/narrator';

interface NarratedFact {
  poi: PointOfInterest;
  at: number;
}

export function WalkScreen() {
  const [walking, setWalking] = useState(false);
  const { permission, position, error } = useWalkLocation(walking);
  const [history, setHistory] = useState<NarratedFact[]>([]);
  const narratedIds = useRef(new Set<string>());
  const speaking = useRef(false);

  useEffect(() => {
    if (!walking || !position || speaking.current) return;
    const next = pickNextFact(
      position.latitude,
      position.longitude,
      torontoSeed,
      narratedIds.current,
    );
    if (!next) return;
    narratedIds.current.add(next.poi.id);
    setHistory((h) => [{ poi: next.poi, at: Date.now() }, ...h]);
    speaking.current = true;
    narrate(`${next.poi.name}. ${next.poi.fact}`)
      .catch(() => undefined)
      .finally(() => {
        speaking.current = false;
      });
  }, [walking, position]);

  const toggleWalk = () => {
    if (walking) {
      stopNarration();
      speaking.current = false;
    } else {
      narratedIds.current.clear();
    }
    setWalking((w) => !w);
  };

  const replay = (poi: PointOfInterest) => {
    narrate(`${poi.name}. ${poi.fact}`).catch(() => undefined);
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <Text style={styles.title}>WalkCompanion</Text>

      <Pressable
        onPress={toggleWalk}
        style={[styles.button, walking ? styles.buttonStop : styles.buttonStart]}
      >
        <Text style={styles.buttonText}>{walking ? 'Stop walk' : 'Start walk'}</Text>
      </Pressable>

      <View style={styles.status}>
        {permission === 'denied' && (
          <Text style={styles.warn}>Location permission denied. Enable it in Settings.</Text>
        )}
        {error && <Text style={styles.warn}>{error}</Text>}
        {walking && position && (
          <Text style={styles.muted}>
            {position.latitude.toFixed(5)}, {position.longitude.toFixed(5)}
            {position.accuracy != null ? `  ±${Math.round(position.accuracy)} m` : ''}
          </Text>
        )}
        {walking && !position && permission !== 'denied' && (
          <Text style={styles.muted}>Waiting for a GPS fix...</Text>
        )}
      </View>

      <Text style={styles.sectionTitle}>Heard on this walk</Text>
      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {history.length === 0 && (
          <Text style={styles.muted}>Nothing yet. Walk towards a landmark.</Text>
        )}
        {history.map((item) => (
          <Pressable key={item.poi.id} onPress={() => replay(item.poi)} style={styles.card}>
            <Text style={styles.cardTitle}>{item.poi.name}</Text>
            <Text style={styles.cardBody}>{item.poi.fact}</Text>
            <Text style={styles.cardMeta}>Tap to hear again</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa', paddingTop: 64, paddingHorizontal: 20 },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 20 },
  button: { paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  buttonStart: { backgroundColor: '#1f6f43' },
  buttonStop: { backgroundColor: '#9b2c2c' },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  status: { minHeight: 40, marginTop: 12, marginBottom: 8 },
  warn: { color: '#9b2c2c' },
  muted: { color: '#666' },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginTop: 8, marginBottom: 8 },
  list: { flex: 1 },
  listContent: { paddingBottom: 32 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  cardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  cardBody: { fontSize: 14, lineHeight: 20, color: '#222' },
  cardMeta: { fontSize: 12, color: '#888', marginTop: 8 },
});
