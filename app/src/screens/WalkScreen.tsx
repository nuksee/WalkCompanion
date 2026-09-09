import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useWalkLocation } from '../location/useWalkLocation';
import { loadTags, saveTags } from '../facts/preferenceStore';
import { DEFAULT_TAGS, summariseFeedback, type Reaction } from '../facts/preferences';
import { distanceMeters, nextUpcoming, pickNextFact } from '../facts/proximity';
import { torontoSeed } from '../facts/torontoSeed';
import { displayTag, type FactTag, type PointOfInterest } from '../facts/types';
import { fetchNearbyWikipedia } from '../facts/wikipedia';
import { rewriteFact } from '../llm/rewriteFact';
import { log, logError } from '../log';
import { currentVoice, narrate, stopNarration } from '../speech/narrator';
import { FactCard, type HeroFact } from './FactCard';
import { SettingsPanel } from './SettingsPanel';
import { TuneSheet } from './TuneSheet';
import { colors, radius } from '../theme/tokens';

interface NarratedFact {
  poi: PointOfInterest;
  /** What was actually spoken: the LLM rewrite when a key is set, else the raw fact. */
  spoken: string;
  /** The tag shown on the card, chosen when the fact was narrated. */
  tag: FactTag;
  /** Why it fired: "118 m away" or "random". */
  why: string;
  at: number;
}

/** Re-query Wikipedia after moving this far from the last query point. */
const REFETCH_DISTANCE_M = 300;

/** Used by "Random fact" when there is no GPS fix, so the feature works at home. */
const HOME_TEST_COORD = { latitude: 43.6426, longitude: -79.3871 }; // CN Tower

const keyOf = (item: NarratedFact) => `${item.poi.id}-${item.at}`;

const clockTime = (at: number) => {
  const d = new Date(at);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export function WalkScreen() {
  const [walking, setWalking] = useState(false);
  const { permission, position, error } = useWalkLocation(walking);
  const [history, setHistory] = useState<NarratedFact[]>([]);
  const [pois, setPois] = useState<PointOfInterest[]>(torontoSeed);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [speakingKey, setSpeakingKey] = useState<string | null>(null);
  const [shownKey, setShownKey] = useState<string | null>(null);
  const [reactions, setReactions] = useState<Record<string, Reaction>>({});
  const [tags, setTags] = useState<FactTag[]>(DEFAULT_TAGS);
  const [tuneOpen, setTuneOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const narratedIds = useRef(new Set<string>());
  const speaking = useRef(false);
  const lastFetchAt = useRef<{ latitude: number; longitude: number } | null>(null);
  const apiKey = useRef<string | null>(null);
  const onKeyChange = useCallback((key: string | null) => {
    apiKey.current = key;
    setHasKey(!!key);
  }, []);

  // Tag preferences live on the device and survive a relaunch.
  useEffect(() => {
    loadTags().then(setTags).catch((e) => logError('settings', e));
  }, []);
  // Read through a ref so the trigger effect does not restart on every toggle.
  const tagsRef = useRef(tags);
  tagsRef.current = tags;
  const reactionsRef = useRef(reactions);
  reactionsRef.current = reactions;
  const historyRef = useRef(history);
  historyRef.current = history;

  const toggleTag = (tag: FactTag) => {
    setTags((current) => {
      const next = current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag];
      log('settings', 'tags', next.join(', ') || 'none');
      void saveTags(next).catch((e) => logError('settings', e));
      return next;
    });
  };

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
    const selected = tagsRef.current.length ? tagsRef.current : DEFAULT_TAGS;
    const tag = displayTag(poi, selected);
    log('trigger', why, poi.name, key ? 'with LLM' : 'raw');
    let spoken = poi.fact;
    if (key) {
      // The device is the source of truth for preferences; a compact summary
      // rides along with the request so the model can lean towards what stuck.
      const reacted = historyRef.current
        .map((h) => ({ tag: h.tag, reaction: reactionsRef.current[keyOf(h)] }))
        .filter((r): r is { tag: FactTag; reaction: Reaction } => !!r.reaction);
      try {
        const text = await rewriteFact(poi, key, { tag, feedback: summariseFeedback(reacted) });
        if (text) spoken = text;
        else log('llm', 'empty response, using raw text');
      } catch (e) {
        logError('llm', e);
      }
    }
    log('narrate', spoken);
    const item: NarratedFact = { poi, spoken, tag, why, at: Date.now() };
    const itemKey = keyOf(item);
    setHistory((h) => [item, ...h]);
    setShownKey(itemKey);
    setSpeakingKey(itemKey);
    narrate(`${poi.name}. ${spoken}`, key)
      .catch((e) => logError('narrate', e))
      .finally(() => {
        log('narrate', 'done, voice:', currentVoice());
        speaking.current = false;
        setSpeakingKey((current) => (current === itemKey ? null : current));
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

  // Narrate the nearest untriggered place within range, preferring selected tags.
  useEffect(() => {
    if (!walking || !position || speaking.current) return;
    const next = pickNextFact(
      position.latitude,
      position.longitude,
      pois,
      narratedIds.current,
      tagsRef.current,
    );
    if (!next) return;
    void speakFact(next.poi, `${Math.round(next.distance)} m away`);
  }, [walking, position, pois, speakFact]);

  const toggleWalk = () => {
    log('walk', walking ? 'stop' : 'start');
    if (walking) {
      stopNarration();
      speaking.current = false;
      setSpeakingKey(null);
    } else {
      narratedIds.current.clear();
      lastFetchAt.current = null;
      setHistory([]);
      setReactions({});
      setShownKey(null);
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

  const shown = useMemo(
    () => history.find((h) => keyOf(h) === shownKey) ?? history[0] ?? null,
    [history, shownKey],
  );
  const shownIsSpeaking = !!shown && keyOf(shown) === speakingKey;

  const react = (item: NarratedFact, reaction: Reaction) => {
    const key = keyOf(item);
    setReactions((current) => {
      const next = { ...current };
      if (next[key] === reaction) delete next[key];
      else next[key] = reaction;
      log('feedback', item.poi.name, item.tag, next[key] ?? 'cleared');
      return next;
    });
  };

  const replay = () => {
    if (!shown) return;
    narrate(`${shown.poi.name}. ${shown.spoken}`, apiKey.current).catch((e) =>
      logError('narrate', e),
    );
  };

  const hero: HeroFact | null = shown && {
    key: keyOf(shown),
    name: shown.poi.name,
    spoken: shown.spoken,
    tag: shown.tag,
    why: shown.why,
    reaction: reactions[keyOf(shown)] ?? null,
  };
  const kicker = shownIsSpeaking
    ? 'Now playing'
    : shown && history[0] && keyOf(shown) === keyOf(history[0])
      ? 'Last heard'
      : 'Earlier';
  const emptyText = !walking
    ? 'Start a walk. The fact for each place you pass shows here, read aloud.'
    : position
      ? 'Listening for places nearby…'
      : 'Waiting for a GPS fix…';

  // The status line: one row of dot plus text describing what the walk is doing.
  const upcoming =
    walking && position && !shownIsSpeaking
      ? nextUpcoming(position.latitude, position.longitude, pois, narratedIds.current)
      : null;
  let status: string;
  let dotColor: string = colors.neutral700;
  if (permission === 'denied') {
    status = 'Location permission denied. Enable it in Settings.';
  } else if (error) {
    status = error;
  } else if (fetchError) {
    status = `Wikipedia lookup failed: ${fetchError}`;
  } else if (!walking) {
    status = history.length
      ? `Walk ended · ${pois.length} places loaded`
      : `${pois.length} places loaded`;
  } else if (!position) {
    status = 'Waiting for a GPS fix…';
    dotColor = colors.accent700;
  } else if (shownIsSpeaking && shown) {
    status = `Speaking · ${shown.poi.name}`;
    dotColor = colors.accent;
  } else if (upcoming) {
    status = `Next up · ${upcoming.poi.name} · ${Math.round(upcoming.distance)} m`;
    dotColor = colors.accent700;
  } else {
    const accuracy = position.accuracy != null ? ` · ±${Math.round(position.accuracy)} m` : '';
    status = `${position.latitude.toFixed(5)}, ${position.longitude.toFixed(5)}${accuracy} · ${pois.length} places loaded`;
    dotColor = colors.accent700;
  }

  const earlier = history.filter((h) => !shown || keyOf(h) !== keyOf(shown));

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>WalkCompanion</Text>
          <Pressable
            onPress={() => setSettingsOpen(true)}
            accessibilityLabel="Settings"
            style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
          >
            <Text style={styles.iconGlyph}>⚙</Text>
          </Pressable>
        </View>

        <View style={styles.statusRow}>
          <View style={[styles.dot, { backgroundColor: dotColor }]} />
          <Text style={styles.statusText} numberOfLines={1}>
            {status}
          </Text>
        </View>

        <FactCard
          fact={hero}
          kicker={kicker}
          speaking={shownIsSpeaking}
          rewritten={hasKey}
          emptyText={emptyText}
          onReact={(reaction) => shown && react(shown, reaction)}
          onPress={replay}
        />

        <View style={styles.actionRow}>
          <Pressable
            onPress={toggleWalk}
            style={({ pressed }) => [styles.mainButton, pressed && styles.mainButtonPressed]}
          >
            <View style={[styles.mainGlyph, walking && styles.mainGlyphSquare]} />
            <Text style={styles.mainButtonText}>{walking ? 'Stop walk' : 'Start walk'}</Text>
          </Pressable>
          <Pressable
            onPress={() => setTuneOpen(true)}
            style={({ pressed }) => [styles.tuneButton, pressed && styles.tuneButtonPressed]}
          >
            <Text style={styles.tuneButtonText}>Tune · {tags.length ? tags.length : 'all'}</Text>
          </Pressable>
        </View>

        <View style={styles.listHeader}>
          <Text style={styles.listHeaderText}>EARLIER ON THIS WALK</Text>
          <Pressable
            onPress={randomFact}
            disabled={busy}
            style={({ pressed }) => [styles.ghost, pressed && styles.ghostPressed]}
          >
            <Text style={[styles.ghostText, busy && styles.disabled]}>
              {busy ? 'Loading…' : 'Random fact'}
            </Text>
          </Pressable>
        </View>

        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {earlier.length === 0 && (
            <Text style={styles.listEmpty}>Facts you pass appear here for replay.</Text>
          )}
          {earlier.map((item) => {
            const reaction = reactions[keyOf(item)];
            return (
              <Pressable key={keyOf(item)} onPress={() => setShownKey(keyOf(item))} style={styles.row}>
                <View style={styles.rowMain}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {item.poi.name}
                  </Text>
                  <Text style={styles.rowMeta}>
                    {item.tag} · {clockTime(item.at)}
                  </Text>
                </View>
                {reaction && (
                  <Text
                    style={[
                      styles.rowReaction,
                      { color: reaction === 'like' ? colors.accent : colors.neutral400 },
                    ]}
                  >
                    {reaction === 'like' ? 'More like this' : 'Less of this'}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <TuneSheet
        visible={tuneOpen}
        selected={tags}
        onToggle={toggleTag}
        onClose={() => setTuneOpen(false)}
      />
      <SettingsPanel
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onKeyChange={onKeyChange}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 6 },
  header: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 18, fontWeight: '500', letterSpacing: -0.18, color: colors.text },
  iconButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md },
  iconButtonPressed: { backgroundColor: colors.neutralPress },
  iconGlyph: { fontSize: 20, color: colors.neutral400 },
  statusRow: { height: 24, flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, color: colors.neutral500, flex: 1 },
  disabled: { opacity: 0.35 },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  mainButton: {
    flex: 1,
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  mainButtonPressed: { backgroundColor: colors.accentPress },
  mainButtonText: { fontSize: 16, fontWeight: '500', color: colors.accent },
  mainGlyph: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
  mainGlyphSquare: { borderRadius: 2 },
  tuneButton: {
    height: 52,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tuneButtonPressed: { backgroundColor: colors.neutralPress },
  tuneButtonText: { fontSize: 14, color: colors.text },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 18,
    marginBottom: 4,
  },
  listHeaderText: { fontSize: 11, letterSpacing: 0.88, color: colors.neutral500 },
  ghost: { height: 28, justifyContent: 'center', paddingHorizontal: 3, borderRadius: radius.sm },
  ghostPressed: { backgroundColor: colors.accentPress },
  ghostText: { fontSize: 12, color: colors.accent },
  list: { flex: 1, marginHorizontal: -20 },
  listContent: { paddingHorizontal: 20, paddingBottom: 20 },
  listEmpty: { fontSize: 12, color: colors.neutral600, paddingVertical: 8 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    // A flat hairline: the design's end-fading rule needs expo-linear-gradient.
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  rowMain: { flex: 1, minWidth: 0 },
  rowName: { fontSize: 14, fontWeight: '500', color: colors.text },
  rowMeta: { fontSize: 11, color: colors.neutral500, marginTop: 1 },
  rowReaction: { fontSize: 11 },
});
