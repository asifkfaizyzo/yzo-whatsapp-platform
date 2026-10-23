import { TextStyle } from 'react-native';

const fontFamily = {
  regular: 'System',
  medium: 'System',
  semiBold: 'System',
  bold: 'System',
};

export const typography: Record<string, TextStyle> = {
  // ── Headings ──
  h1: {
    fontFamily: fontFamily.bold,
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 34,
    letterSpacing: -0.5,
  },
  h2: {
    fontFamily: fontFamily.bold,
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
    letterSpacing: -0.3,
  },
  h3: {
    fontFamily: fontFamily.semiBold,
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 24,
  },
  h4: {
    fontFamily: fontFamily.semiBold,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  },

  // ── Body ──
  bodyLarge: {
    fontFamily: fontFamily.regular,
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
  },
  body: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
  },
  bodySmall: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
  },

  // ── Labels ──
  label: {
    fontFamily: fontFamily.medium,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  labelSmall: {
    fontFamily: fontFamily.medium,
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },

  // ── Caption ──
  caption: {
    fontFamily: fontFamily.regular,
    fontSize: 11,
    fontWeight: '400',
    lineHeight: 14,
  },

  // ── Button ──
  button: {
    fontFamily: fontFamily.semiBold,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  },
  buttonSmall: {
    fontFamily: fontFamily.semiBold,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
} as const;