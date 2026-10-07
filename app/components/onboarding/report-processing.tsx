import { useEffect } from 'react';
import { Image, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { Colors, FontSize, Radius, Spacing, Typography, SurfaceStyles } from '../../../src/constants/theme';

const PROCESSING_IMAGE = require('../../../assets/mascote-relatorio/Mascote tecnológico com laptop e ícones flutuantes.png');

function ProcessingRing() {
  const rotation = useSharedValue(0);
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    if (reducedMotion) return;
    rotation.set(0);
    rotation.set(withRepeat(withTiming(360, { duration: 1700, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(rotation);
  }, [reducedMotion, rotation]);
  const spinStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.get()}deg` }] }));
  return <View style={styles.ringTrack} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><Animated.View style={[styles.ringActive, spinStyle]} /></View>;
}

export function ReportBackdrop({ viewBox = '0 0 390 820', preserveAspectRatio = 'xMidYMid slice', variant = 'report' }: { viewBox?: string; preserveAspectRatio?: string; variant?: 'report' | 'account' } = {}) {
  if (variant === 'account') return (
    <View pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants" style={styles.background}>
      <Svg width="100%" height="100%" viewBox="0 0 390 820" preserveAspectRatio="none">
        <Path d="M-30 145 C35 80 100 85 165 145 C205 182 235 92 286 82 C349 66 391 105 415 160 L415 250 C346 243 325 188 260 197 C184 209 168 160 117 173 C58 190 28 234 -30 218 Z" fill={Colors.accentLight} opacity="0.45" />
        <Path d="M-28 186 C28 138 45 223 92 197 C137 172 173 136 228 153 C290 172 305 136 350 164 C386 187 403 224 414 254 L414 295 C346 286 319 251 267 258 C204 270 185 225 137 228 C63 235 40 260 -28 250 Z" fill={Colors.accentGlow} opacity="0.22" />
        <Path d="M-40 385 C39 327 68 419 134 394 C207 366 238 313 313 335 C367 351 401 389 423 430 L423 497 C341 460 297 403 237 422 C159 447 121 426 71 455 C29 479 -15 465 -40 447 Z" fill={Colors.accentLight} opacity="0.24" />
        <Path d="M-35 683 C25 631 66 662 112 708 C158 754 217 677 280 684 C355 692 364 755 418 741 L418 820 L-35 820 Z" fill={Colors.accentLight} opacity="0.32" />
        <Path d="M-25 762 C36 704 76 782 139 765 C219 744 231 704 304 741 C350 764 380 776 415 765 L415 820 L-25 820 Z" fill={Colors.accentGlow} opacity="0.16" />
      </Svg>
    </View>
  );
  return (
      <View pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants" style={styles.background}>
        <Svg width="100%" height="100%" viewBox={viewBox} preserveAspectRatio={preserveAspectRatio}>
          <Defs>
            <RadialGradient id="topGlow"><Stop offset="0" stopColor={Colors.accentLight} stopOpacity="0.85" /><Stop offset="1" stopColor={Colors.accentLight} stopOpacity="0" /></RadialGradient>
            <RadialGradient id="bottomGlow"><Stop offset="0" stopColor={Colors.accentGlow} stopOpacity="0.8" /><Stop offset="1" stopColor={Colors.accentGlow} stopOpacity="0" /></RadialGradient>
          </Defs>
          <Path d="M250 -80 C247 42 337 51 411 114 L410 -80 Z" fill={Colors.accentLight} opacity="0.65" />
          <Path d="M-52 138 C18 96 42 128 75 160 C111 195 153 135 210 106 C292 65 329 128 374 171 C421 217 407 308 348 332 C286 357 245 315 187 332 C103 357 37 330 -18 292 Z" fill={Colors.accentLight} opacity="0.62" />
          <Rect x="-30" y="100" width="450" height="350" fill="url(#topGlow)" />
          <Path d="M-45 306 C15 266 32 315 52 347 C79 390 131 379 161 423 C196 472 152 519 77 507 C19 498 -17 469 -45 433 Z" fill={Colors.accentGlow} opacity="0.42" />
          <Path d="M-55 690 C17 633 39 711 112 721 C167 729 207 736 245 820 L-55 820 Z" fill={Colors.accentGlow} opacity="0.72" />
          <Path d="M392 557 C342 530 332 598 354 633 C373 664 414 654 431 611 Z" fill={Colors.accentLight} opacity="0.65" />
          <Rect x="-100" y="615" width="390" height="275" fill="url(#bottomGlow)" />
        </Svg>
      </View>
  );
}

export default function ReportProcessing() {
  const { width, height } = useWindowDimensions();
  const compact = height < 700;
  const illustrationSize = Math.min(width, compact ? height * 0.41 : height * 0.46, 405);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ReportBackdrop />


      <View style={[styles.content, compact && styles.contentCompact]}>
        <View style={[styles.hero, { width: illustrationSize, height: illustrationSize }]}>
          <View pointerEvents="none" accessible={false} style={styles.heroHalo} />
          <Image source={PROCESSING_IMAGE} style={styles.illustration} resizeMode="contain" accessibilityLabel="Lumio trabalhando no notebook" />
        </View>
        <View style={styles.copy}>
          <Text style={styles.title}>Organizando tudo pra você...</Text>
          <Text style={styles.subtitle}>Estou analisando suas respostas e preparando uma experiência personalizada para o seu negócio.</Text>
        </View>
        <View style={styles.card} accessibilityRole="progressbar" accessibilityLabel="Processando suas informações">
          <ProcessingRing />
          <View style={styles.cardCopy}>
            <Text style={styles.cardTitle}>Processando suas informações...</Text>
            <Text style={styles.cardSubtitle}>Isso pode levar alguns segundos.</Text>
          </View>
        </View>
      </View>
      <View style={styles.bottomSpace} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F3FFF9', overflow: 'hidden' },
  background: { ...StyleSheet.absoluteFillObject },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl, gap: Spacing.md, transform: [{ translateY: -14 }] },
  contentCompact: { gap: Spacing.sm },
  hero: { alignItems: 'center', justifyContent: 'center', maxWidth: '100%', marginBottom: -32 },
  heroHalo: { position: 'absolute', width: '82%', height: '77%', borderRadius: Radius.full, backgroundColor: Colors.accentLight, opacity: 0.3, transform: [{ rotate: '-18deg' }] },
  illustration: { width: '100%', height: '100%' },
  copy: { alignItems: 'center', gap: Spacing.md, maxWidth: 390 },
  title: { fontFamily: Typography.bold, fontSize: FontSize.xxxl, lineHeight: 40, color: '#202B38', textAlign: 'center' },
  subtitle: { fontFamily: Typography.regular, fontSize: FontSize.md, lineHeight: 23, color: Colors.textSecondary, textAlign: 'center' },
  card: {
      ...SurfaceStyles.card,
    width: '100%', maxWidth: 390, minHeight: 104, flexDirection: 'row', alignItems: 'center', gap: Spacing.lg, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xl, marginTop: Spacing.sm, borderRadius: Radius.xl },
  ringTrack: { width: 44, height: 44, borderRadius: 22, borderWidth: 5, borderColor: Colors.accentLight, alignItems: 'center', justifyContent: 'center' },
  ringActive: { position: 'absolute', width: 44, height: 44, borderRadius: 22, borderWidth: 5, borderColor: 'transparent', borderTopColor: Colors.accent, borderRightColor: Colors.accent },
  cardCopy: { flex: 1, gap: Spacing.xs },
  cardTitle: { fontFamily: Typography.semibold, fontSize: FontSize.sm, color: Colors.primary },
  cardSubtitle: { fontFamily: Typography.regular, fontSize: FontSize.sm, color: Colors.textSecondary },
  bottomSpace: { height: Spacing.xl },
});
