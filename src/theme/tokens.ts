// Organic design-system tokens, ported from the Venn design project.
// Light values come from styles.css; dark values from the design's themeStyle override.

export type Tokens = {
  bg: string;
  surface: string;
  text: string;
  accent: string;
  accent2: string;
  divider: string;
  accent100: string;
  accent200: string;
  accent300: string;
  accent400: string;
  accent600: string;
  accent700: string;
  accent800: string;
  accent2_100: string;
  accent2_600: string;
  accent2_700: string;
  accent2_800: string;
  neutral100: string;
  neutral400: string;
  neutral500: string;
  neutral600: string;
  neutral800: string;
  vRaise: string;
  vSunk: string;
  scrim: string;
  /** text at ~55-70% strength, precomputed (no color-mix in RN) */
  textMuted: string;
  textFaint: string;
};

export const light: Tokens = {
  bg: '#f5ead8',
  surface: '#ebddc5',
  text: '#201e1d',
  accent: '#c67139',
  accent2: '#7a8a5e',
  divider: 'rgba(32,30,29,0.16)',
  accent100: '#fff2eb',
  accent200: '#ffe1d0',
  accent300: '#ffc6a5',
  accent400: '#f6a06b',
  accent600: '#b2622d',
  accent700: '#8c491a',
  accent800: '#643312',
  accent2_100: '#f0fae1',
  accent2_600: '#728157',
  accent2_700: '#56633f',
  accent2_800: '#3d472b',
  neutral100: '#f9f4ed',
  neutral400: '#c0b6a5',
  neutral500: '#a19786',
  neutral600: '#82796a',
  neutral800: '#474238',
  vRaise: '#fffaf2',
  vSunk: '#e3d4ba',
  scrim: 'rgba(32,30,29,0.5)',
  textMuted: 'rgba(32,30,29,0.6)',
  textFaint: 'rgba(32,30,29,0.45)',
};

export const dark: Tokens = {
  bg: '#26231e',
  surface: '#3a352d',
  text: '#f7f1e6',
  accent: '#f0975f',
  accent2: '#aebf92',
  divider: 'rgba(247,241,230,0.17)',
  accent100: '#4a2a13',
  accent200: '#6b3a17',
  accent300: '#8c491a',
  accent400: '#f6a06b',
  accent600: '#f6a06b',
  accent700: '#ffc6a5',
  accent800: '#ffdcc4',
  accent2_100: '#333c26',
  accent2_600: '#8fa073',
  accent2_700: '#ccdbb2',
  accent2_800: '#e1eecc',
  neutral100: '#3a352d',
  neutral400: '#645c50',
  neutral500: '#82796a',
  neutral600: '#a19786',
  neutral800: '#eee7db',
  vRaise: '#332e27',
  vSunk: '#1d1b17',
  scrim: 'rgba(0,0,0,0.55)',
  textMuted: 'rgba(247,241,230,0.6)',
  textFaint: 'rgba(247,241,230,0.45)',
};

export const fonts = {
  heading: 'Caprasimo_400Regular',
  body: 'Figtree_400Regular',
  bodySemi: 'Figtree_600SemiBold',
  bodyBold: 'Figtree_700Bold',
  mono: 'Menlo',
};

export const shadow = {
  sm: {
    shadowColor: '#2e2b25',
    shadowOpacity: 0.14,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  md: {
    shadowColor: '#2e2b25',
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  lg: {
    shadowColor: '#2e2b25',
    shadowOpacity: 0.22,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
};

export const shadowDark = {
  sm: { ...shadow.sm, shadowColor: '#000', shadowOpacity: 0.5 },
  md: { ...shadow.md, shadowColor: '#000', shadowOpacity: 0.5 },
  lg: { ...shadow.lg, shadowColor: '#000', shadowOpacity: 0.6 },
};
