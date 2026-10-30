/**
 * Sudo Reply Brand Colors
 * Light theme tokens. Dark mode can be added later by swapping this object.
 */
export const colors = {
  // ── Brand ──
  primary:        '#125EF2',
  primaryLight:   '#E8F0FE',
  primaryDark:    '#0D47B5',

  // ── Neutrals ──
  white:          '#FFFFFF',
  background:     '#F8F9FA',
  surface:        '#FFFFFF',
  lightGrey:      '#EEEEEE',
  border:         '#E0E0E0',
  secondaryGrey:  '#A6A6A6',
  darkGrey:       '#363636',
  black:          '#1A1A1A',

  // ── Semantic ──
  success:        '#22C55E',
  successLight:   '#DCFCE7',
  warning:        '#F59E0B',
  warningLight:   '#FEF3C7',
  error:          '#EF4444',
  errorLight:     '#FEE2E2',
  info:           '#3B82F6',
  infoLight:      '#DBEAFE',

  // ── Status Badges ──
  statusRunning:    '#3B82F6',
  statusScheduled:  '#8B5CF6',
  statusCompleted:  '#22C55E',
  statusFailed:     '#EF4444',
  statusOpen:       '#F59E0B',
  statusResolved:   '#22C55E',
  statusPending:    '#A6A6A6',

  // ── Availability ──
  available:      '#22C55E',
  away:           '#F59E0B',
  offline:        '#A6A6A6',

  // ── Tab Bar ──
  tabActive:      '#125EF2',
  tabInactive:    '#A6A6A6',
  tabBarBg:       '#FFFFFF',
  tabBarBorder:   '#EEEEEE',
} as const;

export type ColorToken = keyof typeof colors;