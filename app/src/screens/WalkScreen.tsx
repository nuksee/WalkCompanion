import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useWalkLocation } from '../location/useWalkLocation';
import { distanceMeters, pickNextFact } from '../facts/proximity';
import { torontoSeed } from '../facts/torontoSeed';
import type { PointOfInterest } from '../facts/types';
import { fetchNearbyWikipedia } from '../facts/wikipedia';
import { rewriteFact } from '../llm/rewriteFact';
import { log, logError } from '../log';
import { narrate, stopNarration } from '../speech/narrator';
import { SettingsPanel } from './SettingsPanel';

interface NarratedFact {
  poi: PointOfInterest;
  /** What was actually spoken: the LLM rewrite when a key is set, else the raw fact. */
  spoken: string;
  at: number;
}

/** Re-query Wikipedia after moving this far from the last query point. */
const REFETCH_DISTANCE_M = 300;

export function WalkScreen() {
  const [walking, setWalking] = useState(false);
  const { permission, position, error } = useWalkLocation(walking);
  const [history, setHistory] = useState<NarratedFact[]>([]);
  const [pois, setPois] = useState<PointOfInterest[]>(torontoSeed);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const narratedIds = useRef(new Set<string>());
  const speaking = useRef(false);
  const lastFetchAt = useRef<{ latitude: number; longitude: number } | null>(null);
  const apiKey = useRef<string | null>(null);
  const onKeyChange = useCallback((key: string | null) => {
    apiKey.current = key;
  }, []);

  // Load nearby Wikipedia articles when the walk starts and after moving a few hundred metres.
  useEffect(() => {
    if (!walking || !position) return;
    const last = lastFetchAt.current;
    if (
      last &&
      distanceMeters(last.latitude, last.longitude, position.latitude, position.longitude) <
        REFETCH_DISTANCE_M
    ) {
      return;
    }
    lastFetchAt.current = { latitude: position.latitude, longitude: position.longitude };
    log('wikipedia', 'fetching near', position.latitude.toFixed(4), position.longitude.toFixed(4));
    fetchNearbyWikipedia(position.latitude, position.longitude)
      .then((found) => {
        setFetchError(null);
        setPois((current) => {
          const known = new Set(current.map((p) => p.id));
          const fresh = found.filter((p) => !known.has(p.id));
          log('wikipedia', `${found.length} articles, ${fresh.length} new:`, fresh.map((p) => p.name));
          return [...current, ...fresh];
        });
      })
      .catch((e) => {
        logError('wikipedia', e);
        setFetchError(e instanceof Error ? e.message : String(e));
      });
  }, [walking, position]);

  useEffect(() => {
    if (!walking || !position || speaking.current) return;
    const next = pickNextFact(
      position.latitude,
      position.longitude,
      pois,
      narratedIds.current,
    );
    if (!next) return;
    narratedIds.current.add(next.poi.id);
    speaking.current = true;
    const key = apiKey.current;
    log('trigger', next.poi.name, `${Math.round(next.distance)}m away`, key ? 'with LLM' : 'raw');
    const rewritten = key
      ? rewriteFact(next.poi, key)
          .then((text) => {
            if (!text) log('llm', 'empty response, using raw text');
            return text ?? next.poi.fact;
          })
          .catch((e) => {
            logError('llm', e);
            return next.poi.fact;
          })
      : Promise.resolve(next.poi.fact);
    rewritten
      .then((spoken) => {
        log('narrate', spoken);
        setHistory((h) => [{ poi: next.poi, spoken, at: Date.now() }, ...h]);
        return narrate(`${next.poi.name}. ${spoken}`);
      })
      .catch((e) => logError('narrate', e))
      .finally(() => {
        speaking.current = false;
      });
  }, [walking, position, pois]);

  const toggleWalk = () => {
    log('walk', walking ? 'stop' : 'start');
    if (walking) {
      stopNarration();
      speaking.current = false;
    } else {
      narratedIds.current.clear();
      lastFetchAt.current = null;
    }
    setWalking((w) => !w);
  };

  const replay = (item: NarratedFact) => {
    narrate(`${item.poi.name}. ${item.spoken}`).catch(() => undefined);
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <Text style={styles.title}>WalkCompanion</Text>
      <SettingsPanel onKeyChange={onKeyChange} />

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
        {fetchError && <Text style={styles.warn}>Wikipedia lookup failed: {fetchError}</Text>}
        {walking && position && (
          <Text style={styles.muted}>
            {position.latitude.toFixed(5)}, {position.longitude.toFixed(5)}
            {position.accuracy != null ? `  ±${Math.round(position.accuracy)} m` : ''}
            {`  ·  ${pois.length} places loaded`}
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
          <Pressable key={item.poi.id} onPress={() => replay(item)} style={styles.card}>
            <Text style={styles.cardTitle}>{item.poi.name}</Text>
            <Text style={styles.cardBody}>{item.spoken}</Text>
            <Text style={styles.cardMeta}>Tap to hear again</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa', paddingTop: 64, paddingHorizontal: 20 },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 8 },
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
