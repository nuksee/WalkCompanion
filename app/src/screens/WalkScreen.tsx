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
import { currentVoice, narrate, stopNarration } from '../speech/narrator';
import { SettingsPanel } from './SettingsPanel';

interface NarratedFact {
  poi: PointOfInterest;
  /** What was actually spoken: the LLM rewrite when a key is set, else the raw fact. */
  spoken: string;
  at: number;
}

/** Re-query Wikipedia after moving this far from the last query point. */
const REFETCH_DISTANCE_M = 300;

/** Used by "Random fact" when there is no GPS fix, so the feature works at home. */
const HOME_TEST_COORD = { latitude: 43.6426, longitude: -79.3871 }; // CN Tower

export function WalkScreen() {
  const [walking, setWalking] = useState(false);
  const { permission, position, error } = useWalkLocation(walking);
  const [history, setHistory] = useState<NarratedFact[]>([]);
  const [pois, setPois] = useState<PointOfInterest[]>(torontoSeed);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const narratedIds = useRef(new Set<string>());
  const speaking = useRef(false);
  const lastFetchAt = useRef<{ latitude: number; longitude: number } | null>(null);
  const apiKey = useRef<string | null>(null);
  const onKeyChange = useCallback((key: string | null) => {
    apiKey.current = key;
  }, []);

  /** Fetches Wikipedia places near a point and merges them into the loaded list. */
  const loadNearby = useCallback(async (latitude: number, longitude: number) => {
    log('wikipedia', 'fetching near', latitude.toFixed(4), longitude.toFixed(4));
    try {
      const found = await fetchNearbyWikipedia(latitude, longitude);
      setFetchError(null);
      setPois((current) => {
        const known = new Set(current.map((p) => p.id));
        const fresh = found.filter((p) => !known.has(p.id));
        log('wikipedia', `${found.length} articles, ${fresh.length} new:`, fresh.map((p) => p.name));
        return [...current, ...fresh];
      });
      return found;
    } catch (e) {
      logError('wikipedia', e);
      setFetchError(e instanceof Error ? e.message : String(e));
      return [];
    }
  }, []);

  /**
   * Rewrites (if a key is set), records, and speaks one fact. Shared by triggers and Random fact.
   * Resolves when narration starts; `speaking` stays set until the speech engine finishes.
   */
  const speakFact = useCallback(async (poi: PointOfInterest, why: string) => {
    speaking.current = true;
    narratedIds.current.add(poi.id);
    const key = apiKey.current;
    log('trigger', why, poi.name, key ? 'with LLM' : 'raw');
    let spoken = poi.fact;
    if (key) {
      try {
        const text = await rewriteFact(poi, key);
        if (text) spoken = text;
        else log('llm', 'empty response, using raw text');
      } catch (e) {
        logError('llm', e);
      }
    }
    log('narrate', spoken);
    setHistory((h) => [{ poi, spoken, at: Date.now() }, ...h]);
    narrate(`${poi.name}. ${spoken}`, key)
      .catch((e) => logError('narrate', e))
      .finally(() => {
        log('narrate', 'done, voice:', currentVoice());
        speaking.current = false;
      });
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
    void loadNearby(position.latitude, position.longitude);
  }, [walking, position, loadNearby]);

  // Narrate the nearest untriggered place within range.
  useEffect(() => {
    if (!walking || !position || speaking.current) return;
    const next = pickNextFact(position.latitude, position.longitude, pois, narratedIds.current);
    if (!next) return;
    void speakFact(next.poi, `${Math.round(next.distance)}m away`);
  }, [walking, position, pois, speakFact]);

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

  /** Home testing: pick any loaded place, fetching real Wikipedia places first if none are loaded. */
  const randomFact = async () => {
    if (busy) return;
    if (speaking.current) {
      log('walk', 'random fact ignored: still speaking');
      return;
    }
    setBusy(true);
    try {
      let pool = pois;
      const hasWikipedia = pool.some((p) => p.id.startsWith('wiki-'));
      if (!hasWikipedia) {
        const at = position ?? HOME_TEST_COORD;
        const found = await loadNearby(at.latitude, at.longitude);
        pool = [...pool, ...found];
      }
      const unheard = pool.filter((p) => !narratedIds.current.has(p.id));
      const candidates = unheard.length ? unheard : pool;
      const poi = candidates[Math.floor(Math.random() * candidates.length)];
      if (poi) await speakFact(poi, 'random');
    } finally {
      setBusy(false);
    }
  };

  const replay = (item: NarratedFact) => {
    narrate(`${item.poi.name}. ${item.spoken}`, apiKey.current).catch((e) => logError('narrate', e));
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <Text style={styles.title}>WalkCompanion</Text>
      <SettingsPanel onKeyChange={onKeyChange} />

      <View style={styles.buttons}>
        <Pressable
          onPress={toggleWalk}
          style={[styles.button, styles.buttonMain, walking ? styles.buttonStop : styles.buttonStart]}
        >
          <Text style={styles.buttonText}>{walking ? 'Stop walk' : 'Start walk'}</Text>
        </Pressable>
        <Pressable
          onPress={randomFact}
          disabled={busy}
          style={[styles.button, styles.buttonSecondary, busy && styles.buttonDisabled]}
        >
          <Text style={styles.buttonSecondaryText}>{busy ? 'Loading...' : 'Random fact'}</Text>
        </Pressable>
      </View>

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
        {!walking && <Text style={styles.muted}>{pois.length} places loaded</Text>}
      </View>

      <Text style={styles.sectionTitle}>Heard on this walk</Text>
      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {history.length === 0 && (
          <Text style={styles.muted}>
            Nothing yet. Walk towards a landmark, or tap Random fact to test from home.
          </Text>
        )}
        {history.map((item) => (
          <Pressable key={`${item.poi.id}-${item.at}`} onPress={() => replay(item)} style={styles.card}>
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
  buttons: { flexDirection: 'row', gap: 10 },
  button: { paddingVertical: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  buttonMain: { flex: 2 },
  buttonStart: { backgroundColor: '#1f6f43' },
  buttonStop: { backgroundColor: '#9b2c2c' },
  buttonSecondary: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#1f5fa8' },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  buttonSecondaryText: { color: '#1f5fa8', fontSize: 15, fontWeight: '600' },
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
