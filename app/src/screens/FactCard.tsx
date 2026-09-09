import { useEffect, useRef } from 'react';
import { Animated, Easing, PanResponder, StyleSheet, Text, View } from 'react-native';
import type { Reaction } from '../facts/preferences';
import type { FactTag } from '../facts/types';
import { colors, radius } from '../theme/tokens';

const CARD_HEIGHT = 292;
/** Drag past this many pixels to commit a reaction. */
const COMMIT_PX = 90;
/** Stamps reach their peak opacity at this drag distance. */
const STAMP_PX = 80;
/** Peak opacity of the like/dislike glyph, which overlays the card text. */
const STAMP_OPACITY = 0.5;
/** After a reaction commits, the glyph holds this long, then fades out. */
const STAMP_HOLD_MS = 1500;
const STAMP_FADE_MS = 400;
/** Movement under this counts as a tap, not a drag. */
const TAP_PX = 6;

export interface HeroFact {
  key: string;
  name: string;
  spoken: string;
  tag: FactTag;
  /** Trigger reason, e.g. "118 m away" or "random". */
  why: string;
  reaction: Reaction | null;
}

interface Props {
  fact: HeroFact | null;
  /** 'Now playing' while speech is running, else 'Last heard' or 'Earlier'. */
  kicker: string;
  speaking: boolean;
  /** True when a key is set, so the footer credits the rewrite. */
  rewritten: boolean;
  emptyText: string;
  onReact: (reaction: Reaction) => void;
  /** Tap the card to hear the fact again. */
  onPress: () => void;
}

/** Four bars that pulse while narration plays. */
function Equaliser({ visible }: { visible: boolean }) {
  const bars = useRef([0, 1, 2, 3].map(() => new Animated.Value(0.35))).current;

  useEffect(() => {
    if (!visible) {
      bars.forEach((b) => b.setValue(0.35));
      return;
    }
    const loops = bars.map((bar, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(bar, { toValue: 1, duration: 450, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(bar, { toValue: 0.35, duration: 450, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [visible, bars]);

  return (
    <View style={[styles.equaliser, { opacity: visible ? 1 : 0 }]}>
      {bars.map((bar, i) => (
        <Animated.View key={i} style={[styles.bar, { transform: [{ scaleY: bar }] }]} />
      ))}
    </View>
  );
}

/**
 * The hero card: the fact currently being spoken, or the last one heard.
 * Drag right to like, left to dislike; release past 90 px commits, otherwise
 * the card springs back. A committed reaction keeps its stamp visible.
 */
export function FactCard({ fact, kicker, speaking, rewritten, emptyText, onReact, onPress }: Props) {
  const dragX = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  // Committed-reaction stamps: shown at peak, held briefly, then faded out.
  const likeHold = useRef(new Animated.Value(0)).current;
  const dislikeHold = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const reaction = fact?.reaction ?? null;
    const active = reaction === 'like' ? likeHold : reaction === 'dislike' ? dislikeHold : null;
    likeHold.setValue(0);
    dislikeHold.setValue(0);
    if (!active) return;
    active.setValue(STAMP_OPACITY);
    const fade = Animated.sequence([
      Animated.delay(STAMP_HOLD_MS),
      Animated.timing(active, { toValue: 0, duration: STAMP_FADE_MS, useNativeDriver: false }),
    ]);
    fade.start();
    return () => fade.stop();
  }, [fact?.key, fact?.reaction, likeHold, dislikeHold]);
  // PanResponder is created once, so it reads the live values through refs.
  const factRef = useRef(fact);
  factRef.current = fact;
  const onReactRef = useRef(onReact);
  onReactRef.current = onReact;
  const onPressRef = useRef(onPress);
  onPressRef.current = onPress;

  // While speaking the card pulses: an animated shadow on iOS, an animated
  // border colour on Android, which has no coloured elevation.
  useEffect(() => {
    if (!speaking) {
      glow.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(glow, { toValue: 0, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [speaking, glow]);

  // The springs below stay on the JS driver on purpose: this card also animates
  // borderColor and shadow (JS-only props) on the same view, and React Native
  // cannot mix native- and JS-driven values on one node.
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: (_e, g) => dragX.setValue(g.dx),
      onStartShouldSetPanResponder: () => true,
      onPanResponderRelease: (_e, g) => {
        if (factRef.current && Math.abs(g.dx) > COMMIT_PX) {
          onReactRef.current(g.dx > 0 ? 'like' : 'dislike');
        } else if (Math.abs(g.dx) < TAP_PX && Math.abs(g.dy) < TAP_PX) {
          onPressRef.current();
        }
        Animated.spring(dragX, { toValue: 0, useNativeDriver: false, bounciness: 6, speed: 14 }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(dragX, { toValue: 0, useNativeDriver: false }).start();
      },
    }),
  ).current;

  if (!fact) {
    return (
      <View style={styles.slot}>
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>✦</Text>
          <Text style={styles.emptyText}>{emptyText}</Text>
        </View>
      </View>
    );
  }

  const rotate = dragX.interpolate({
    inputRange: [-220, 220],
    outputRange: ['-10deg', '10deg'],
    extrapolate: 'clamp',
  });
  // Stamps sit centred over the text, so they never exceed half opacity.
  const dragLike = dragX.interpolate({ inputRange: [0, STAMP_PX], outputRange: [0, STAMP_OPACITY], extrapolate: 'clamp' });
  const dragDislike = dragX.interpolate({ inputRange: [-STAMP_PX, 0], outputRange: [STAMP_OPACITY, 0], extrapolate: 'clamp' });
  // While dragging the stamp tracks the finger; after a commit the hold value
  // keeps it visible for a moment, then fades it. Clamp so the two never stack.
  const clamp = { inputRange: [0, STAMP_OPACITY], outputRange: [0, STAMP_OPACITY], extrapolate: 'clamp' as const };
  const likeOpacity = Animated.add(dragLike, likeHold).interpolate(clamp);
  const dislikeOpacity = Animated.add(dragDislike, dislikeHold).interpolate(clamp);

  return (
    <View style={styles.slot}>
      {/* The deck-of-cards hint peeking out behind the hero. */}
      <View style={styles.deck} />
      <Animated.View
        {...pan.panHandlers}
        style={[
          styles.card,
          {
            transform: [{ translateX: dragX }, { rotate }],
            borderColor: speaking
              ? glow.interpolate({ inputRange: [0, 1], outputRange: [colors.accent, colors.accent400] })
              : colors.neutral800,
            shadowColor: colors.accent,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: speaking ? glow.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.5] }) : 0,
            shadowRadius: speaking ? glow.interpolate({ inputRange: [0, 1], outputRange: [9, 20] }) : 0,
          },
        ]}
      >
        <View style={styles.cardTop}>
          <Text style={styles.kicker}>{kicker.toUpperCase()}</Text>
          <View style={styles.tagPill}>
            <Text style={styles.tagPillText}>{fact.tag}</Text>
          </View>
        </View>
        <Text style={styles.name}>{fact.name}</Text>
        <Text style={styles.body}>{fact.spoken}</Text>
        <View style={styles.cardFoot}>
          <Text style={styles.meta} numberOfLines={1}>
            {rewritten ? 'Rewritten by Gemini' : 'Wikipedia'} · {fact.why} · tap to hear again
          </Text>
          <Equaliser visible={speaking} />
        </View>

        <Animated.View pointerEvents="none" style={[styles.stamp, { opacity: likeOpacity }]}>
          <Text style={styles.stampLikeGlyph}>♥</Text>
        </Animated.View>
        <Animated.View pointerEvents="none" style={[styles.stamp, { opacity: dislikeOpacity }]}>
          <Text style={styles.stampDislikeGlyph}>✖</Text>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: { height: CARD_HEIGHT, marginTop: 10 },
  deck: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    bottom: -8,
    borderRadius: radius.lg,
    backgroundColor: colors.neutral900,
    opacity: 0.5,
  },
  card: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radius.lg,
    // Flat surface: the design's 160deg gradient needs expo-linear-gradient,
    // which the handoff allows skipping to avoid a new dependency.
    backgroundColor: colors.surface,
    borderWidth: 1,
    paddingVertical: 18,
    paddingHorizontal: 20,
    gap: 8,
    elevation: 0,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kicker: { fontSize: 10, letterSpacing: 1, color: colors.accent, fontWeight: '500' },
  tagPill: {
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: colors.neutral800,
  },
  tagPillText: { fontSize: 11, color: colors.neutral100 },
  name: {
    fontSize: 24,
    fontWeight: '500',
    lineHeight: 27.6,
    letterSpacing: -0.36,
    color: colors.text,
    marginTop: 6,
  },
  body: { fontSize: 15, lineHeight: 22.5, color: colors.neutral300, flex: 1 },
  cardFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  meta: { fontSize: 12, color: colors.neutral500, flexShrink: 1 },
  equaliser: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 14 },
  bar: { width: 3, height: 14, borderRadius: 2, backgroundColor: colors.accent },
  // Swipe feedback: a bare glyph rather than a bordered stamp, so the drag
  // reads at a glance without competing with the fact text.
  // Centred over the whole card, at half opacity so the text stays readable.
  stamp: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stampLikeGlyph: { fontSize: 76, lineHeight: 88, color: colors.accent },
  // Heavy glyph in near-white: the thin grey cross vanished at half opacity on the dark card.
  stampDislikeGlyph: { fontSize: 72, lineHeight: 88, color: colors.neutral100, fontWeight: '700' },
  empty: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.neutral800,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 24,
  },
  emptyIcon: { fontSize: 26, color: colors.neutral700 },
  emptyText: { fontSize: 13, lineHeight: 19.5, color: colors.neutral500, textAlign: 'center' },
});
