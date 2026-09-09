import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import type { Coord } from '../facts/demoRoute';
import { log } from '../log';
import { colors, radius } from '../theme/tokens';

interface Props {
  visible: boolean;
  /** Where the demo walk is now; the map opens here. */
  at: Coord;
  onPick: (coord: Coord) => void;
  onClose: () => void;
}

/** Roughly a few city blocks, so the first tap lands somewhere useful. */
const SPAN = 0.02;

/**
 * Demo mode only: tap the map to move the simulated walk somewhere else, so a
 * demo can jump to a neighbourhood with denser Wikipedia coverage.
 *
 * Unlike the Tune and Settings panels this is NOT a `Modal`. On Android a
 * `MapView` inside a `Modal` draws a grey surface with the Google logo and no
 * tiles, so this sheet is an absolutely positioned overlay in the normal view
 * tree instead. Keep it that way.
 */
export function DemoMapSheet({ visible, at, onPick, onClose }: Props) {
  const [picked, setPicked] = useState<Coord | null>(null);

  // Mounted only while open, so each opening starts from wherever the walk is.
  if (!visible) return null;
  const target = picked ?? at;
  const region = { ...at, latitudeDelta: SPAN, longitudeDelta: SPAN };
  log('map', 'opening at', at.latitude.toFixed(5), at.longitude.toFixed(5));

  return (
    <View style={styles.overlay}>
      <Pressable
        style={styles.scrim}
        onPress={() => {
          setPicked(null);
          onClose();
        }}
      />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.title}>Move the demo walk</Text>
        <Text style={styles.hint}>
          Tap anywhere to drop a pin. The simulated loop restarts around it.
        </Text>
        <View style={styles.mapFrame}>
          {/* No provider prop: the device's own map, Apple Maps on iOS and Google on Android. */}
          <MapView
            style={styles.map}
            initialRegion={region}
            // onMapReady fires when the view is up; onMapLoaded (Android) only
            // once tiles have actually rendered. Ready without loaded means the
            // map is drawing but the tiles are not arriving.
            onMapReady={() => log('map', 'ready')}
            onMapLoaded={() => log('map', 'tiles loaded')}
            onLayout={(e) => {
              const { width, height } = e.nativeEvent.layout;
              log('map', `laid out ${Math.round(width)}x${Math.round(height)}`);
            }}
            onRegionChangeComplete={(r) =>
              log('map', 'region', r.latitude.toFixed(4), r.longitude.toFixed(4), `Δ${r.latitudeDelta.toFixed(4)}`)
            }
            onPress={(e) => setPicked(e.nativeEvent.coordinate)}
          >
            <Marker coordinate={target} />
          </MapView>
        </View>
        <Text style={styles.coord}>
          {target.latitude.toFixed(5)}, {target.longitude.toFixed(5)}
        </Text>
        <Pressable
          onPress={() => {
            setPicked(null);
            onPick(target);
          }}
          disabled={!picked}
          style={({ pressed }) => [
            styles.confirm,
            pressed && styles.confirmPressed,
            !picked && styles.disabled,
          ]}
        >
          <Text style={styles.confirmText}>Continue from here</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, justifyContent: 'flex-end' },
  scrim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.scrim },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.neutral500,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.neutral700,
    alignSelf: 'center',
  },
  title: { fontSize: 18, fontWeight: '500', color: colors.text, marginTop: 14 },
  hint: { fontSize: 12, color: colors.neutral500, marginTop: 4 },
  mapFrame: {
    height: 280,
    marginTop: 14,
    borderRadius: radius.md,
    // No overflow:'hidden' here: clipping the map surface is the other way
    // Android ends up with a blank map, so the corners stay square.
    borderWidth: 1,
    borderColor: colors.divider,
  },
  map: { flex: 1 },
  coord: { fontSize: 12, color: colors.neutral500, marginTop: 10, textAlign: 'center' },
  confirm: {
    height: 52,
    marginTop: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmPressed: { backgroundColor: colors.accentPress },
  confirmText: { fontSize: 16, fontWeight: '500', color: colors.accent },
  disabled: { opacity: 0.35 },
});
