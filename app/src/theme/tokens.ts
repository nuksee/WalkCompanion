/**
 * Nocturne design tokens, the source of truth for the app's look.
 * Dark ground, Inter, outlined primary actions, accent used as line and glow
 * rather than as a large fill. Never pure black or pure white.
 */
export const colors = {
  bg: '#161826',
  surface: '#232532',
  text: '#e9e9ed',
  accent: '#9184d9',
  accent100: '#f5f4ff',
  accent200: '#e7e5fe',
  accent400: '#b5abfc',
  accent700: '#5d5294',
  accent800: '#423a6a',
  neutral100: '#f3f5fe',
  neutral300: '#cfd3e5',
  neutral400: '#b2b6ca',
  neutral500: '#9397ab',
  neutral600: '#75798c',
  neutral700: '#595d6c',
  neutral800: '#3f424d',
  neutral900: '#292b31',
  divider: 'rgba(233,233,237,0.16)',
  /** Pressed fills for the outlined buttons. */
  accentPress: 'rgba(145,132,217,0.22)',
  neutralPress: 'rgba(233,233,237,0.14)',
  scrim: 'rgba(41,43,49,0.6)',
} as const;

export const radius = { sm: 4, md: 8, lg: 14 } as const;

/** 0.7x scale, rounded where the layout needs whole pixels. */
export const space = { 1: 3, 2: 6, 3: 8, 4: 11, 6: 17, 8: 22 } as const;
