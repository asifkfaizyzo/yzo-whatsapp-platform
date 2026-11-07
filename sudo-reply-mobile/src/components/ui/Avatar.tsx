// sudo-reply-mobile/src/components/ui/Avatar.tsx (do not remove this comment)
import React from 'react';
import { View, Text, Image, StyleSheet, ViewStyle, ImageStyle, StyleProp } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';

interface AvatarProps {
  name?: string;
  uri?: string | null;
  size?: number;
  style?: StyleProp<ViewStyle | ImageStyle>;
}

/**
 * Converts styled Unicode text (fancy fonts: 𝓐𝓁ℯ𝓍, 𝗔𝗹𝗲𝘹, 𝕬𝓁𝖊𝖍, Ⓐ𝓁ℯⓧ),
 * accented letters (É, ü), and fullwidth letters into standard ASCII letters (A-Z).
 * Strips all numbers, symbols, and emojis.
 */
function normalizeToAscii(str: string): string {
  let result = '';

  for (const char of str) {
    const cp = char.codePointAt(0);
    if (!cp) continue;

    // Standard English A-Z / a-z
    if ((cp >= 65 && cp <= 90) || (cp >= 97 && cp <= 122)) {
      result += char;
      continue;
    }

    // Preserve spaces between names
    if (char === ' ' || char === '\t') {
      result += ' ';
      continue;
    }

    // Accented letters (e.g. É -> E, ü -> u)
    const decomp = char.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const decompCp = decomp.codePointAt(0);
    if (decompCp && ((decompCp >= 65 && decompCp <= 90) || (decompCp >= 97 && decompCp <= 122))) {
      result += decomp;
      continue;
    }

    // Fancy / Styled Unicode Fonts (Bold, Italic, Script, Fraktur, Sans, Monospace, etc.)
    let mappedCode = -1;

    if (cp >= 0x1D400 && cp <= 0x1D7FF) {
      const bases = [
        0x1D400, 0x1D41A, // Bold (Upper, Lower)
        0x1D434, 0x1D44E, // Italic
        0x1D468, 0x1D482, // Bold Italic
        0x1D49C, 0x1D4B6, // Script
        0x1D4D0, 0x1D4E1, // Bold Script
        0x1D504, 0x1D51E, // Fraktur
        0x1D538, 0x1D552, // Double-struck
        0x1D56C, 0x1D586, // Bold Fraktur
        0x1D5A0, 0x1D5BA, // Sans-serif
        0x1D5D4, 0x1D5EE, // Sans-serif Bold
        0x1D608, 0x1D622, // Sans-serif Italic
        0x1D63C, 0x1D656, // Sans-serif Bold Italic
        0x1D670, 0x1D68A, // Monospace
      ];

      for (let i = 0; i < bases.length; i++) {
        const base = bases[i];
        if (cp >= base && cp < base + 26) {
          const isUpper = i % 2 === 0;
          mappedCode = (isUpper ? 65 : 97) + (cp - base);
          break;
        }
      }
    } else if (cp >= 0xFF21 && cp <= 0xFF3A) {
      // Fullwidth Upper (Ａ-𝟩)
      mappedCode = 65 + (cp - 0xFF21);
    } else if (cp >= 0xFF41 && cp <= 0xFF5A) {
      // Fullwidth Lower (ａ-ｚ)
      mappedCode = 97 + (cp - 0xFF41);
    } else if (cp >= 0x24B6 && cp <= 0x24CF) {
      // Circled Upper (Ⓐ-Ⓩ)
      mappedCode = 65 + (cp - 0x24B6);
    } else if (cp >= 0x24D0 && cp <= 0x24E9) {
      // Circled Lower (ⓐ-ⓩ)
      mappedCode = 97 + (cp - 0x24D0);
    }

    if (mappedCode !== -1) {
      result += String.fromCharCode(mappedCode);
    }
  }

  return result;
}

function getInitials(name?: string): string {
  if (!name) return '?';

  const cleanName = normalizeToAscii(name).trim();
  if (!cleanName) return '?';

  const parts = cleanName.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return parts[0].substring(0, 2).toUpperCase();
}

function hashColor(name?: string): string {
  if (!name) return colors.primary;
  const palette = ['#125EF2', '#22C55E', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length];
}

export const Avatar: React.FC<AvatarProps> = ({
  name,
  uri,
  size = 44,
  style,
}) => {
  const initials = getInitials(name);
  const bgColor = hashColor(name);

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[{ width: size, height: size, borderRadius: size / 2 }, style as ImageStyle]}
      />
    );
  }

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bgColor,
        },
        styles.container,
        style,
      ]}
    >
      <Text style={[styles.text, { fontSize: size * 0.38, lineHeight: size * 0.38 }]}>
        {initials}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    ...typography.label,
    color: colors.white,
    fontWeight: '700',
    includeFontPadding: false,    
    textAlignVertical: 'center',  
  },
});