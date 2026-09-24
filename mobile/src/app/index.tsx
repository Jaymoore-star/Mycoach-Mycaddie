import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Briefcase, ChevronDown, GraduationCap, LogIn, TrendingUp } from 'lucide-react-native';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { ThemedText } from '@/components/ui/text';
import { PHASE_BLURBS, PHASE_LABELS, PHASE_ORDER } from '@/constants/golf';
import { GOLD, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** The three core tools, from FEATURES in the web app's Index.tsx. */
const FEATURES = [
  {
    icon: GraduationCap,
    title: 'My Coach',
    desc: 'A structured 90-day program with daily drills, coaching cues, and skills gates - calibrated to your handicap level.',
    accent: GOLD,
  },
  {
    icon: Briefcase,
    title: 'My Caddie',
    desc: 'On-course AI caddie that gives club recommendations, reads wind and lie, tracks your scorecard, and calculates strokes gained.',
    accent: '#7dba8a',
  },
  {
    icon: TrendingUp,
    title: 'My Game',
    desc: 'Shot logging with launch monitor support, handicap index tracking, performance charts, and CSV exports.',
    accent: '#7aaddd',
  },
] as const;

/**
 * The hero is dark in both themes.
 *
 * It used to be scrimmed with the theme background, which in light mode is a
 * cream wash: the photo went milky and the grey secondary text sat on it at
 * barely any contrast - the first thing a new golfer, or a Play reviewer, read.
 * A charcoal scrim with fixed light text reads the same whatever the theme,
 * and matches the store's feature graphic.
 */
const HERO_SCRIM = '#141311';
const HERO_TEXT = '#F2F0ED';
const HERO_TEXT_SOFT = 'rgba(242, 240, 237, 0.86)';
const HERO_TEXT_FAINT = 'rgba(242, 240, 237, 0.72)';

const PROOF_POINTS = [
  'Structured greens-to-tee methodology',
  "Skills gates to ensure you're ready before advancing",
  'Personalized drills for your handicap level',
  'Voice-enabled on-course caddie',
  'WHS-standard handicap calculation',
  'Practice streak tracking to keep you consistent',
];

export default function LandingScreen() {
  const colors = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.seven }}>
      {/* ─── Hero ────────────────────────────────────────────────────────── */}
      <View style={[styles.hero, { height: height * 0.82, paddingTop: insets.top }]}>
        <Image
          source={require('@/assets/images/hero-course.jpg')}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
        {/* Scrim keeps the wordmark legible over the course photo. */}
        <View style={[StyleSheet.absoluteFill, styles.scrim]} />
        <View style={[styles.goldLine, { top: insets.top }]} />

        <View style={styles.heroContent}>
          <ThemedText variant="caption" uppercase style={[styles.wordmark, styles.onPhotoGold]}>
            Dominus Golf · Elite Academy
          </ThemedText>

          <ThemedText variant="display" style={[styles.title, styles.onPhoto]}>
            MyCoach <ThemedText variant="display" style={styles.onPhotoGold}>/ MyCaddie</ThemedText>
          </ThemedText>

          <ThemedText variant="body" style={[styles.tagline, styles.onPhoto, styles.onPhotoSoft]}>
            Your personal AI coach with 36 years of top-10 instructor knowledge and an elite
            on-course caddie - all in one app.
          </ThemedText>

          <ThemedText variant="heading" style={[styles.promise, styles.onPhotoGold]}>
            90 days to score under 80.
          </ThemedText>

          <Button
            label="Sign In"
            icon={<LogIn size={18} color={colors.primaryText} />}
            onPress={() => router.push('/sign-in')}
            style={styles.cta}
          />
        </View>

        <View style={styles.scrollCue}>
          <ThemedText variant="caption" uppercase style={[styles.onPhoto, styles.onPhotoFaint]}>
            See how it works
          </ThemedText>
          <ChevronDown size={20} color={HERO_TEXT_FAINT} />
        </View>
      </View>

      {/* ─── Three core tools ────────────────────────────────────────────── */}
      <View style={styles.section}>
        <ThemedText variant="caption" tone="accent" uppercase style={styles.centered}>
          What&apos;s inside
        </ThemedText>
        <ThemedText variant="title" style={[styles.centered, styles.sectionTitle]}>
          Three tools. One goal.
        </ThemedText>
        <ThemedText variant="body" tone="secondary" style={[styles.centered, styles.sectionBlurb]}>
          Everything you need to practice smarter, play better, and break 80 - in one app.
        </ThemedText>

        <View style={styles.featureList}>
          {FEATURES.map(({ icon: Icon, title, desc, accent }) => (
            <View
              key={title}
              style={[
                styles.feature,
                { borderColor: `${accent}55`, backgroundColor: `${accent}14` },
              ]}>
              <View style={[styles.featureIcon, { backgroundColor: `${accent}22` }]}>
                <Icon size={22} color={accent} />
              </View>
              <ThemedText variant="heading">{title}</ThemedText>
              <ThemedText variant="body" tone="secondary">
                {desc}
              </ThemedText>
            </View>
          ))}
        </View>
      </View>

      {/* ─── The six phases ──────────────────────────────────────────────── */}
      <View style={styles.section}>
        <ThemedText variant="caption" tone="accent" uppercase style={styles.centered}>
          The method
        </ThemedText>
        <ThemedText variant="title" style={[styles.centered, styles.sectionTitle]}>
          Greens to tee.
        </ThemedText>

        <View style={styles.phaseList}>
          {PHASE_ORDER.map((phase, i) => (
            <View key={phase} style={[styles.phase, { borderColor: colors.border }]}>
              <View style={[styles.phaseNum, { backgroundColor: colors.backgroundElement }]}>
                <ThemedText variant="label" tone="accent">
                  {i + 1}
                </ThemedText>
              </View>
              <View style={styles.phaseText}>
                <ThemedText variant="heading">{PHASE_LABELS[phase]}</ThemedText>
                <ThemedText variant="caption" tone="muted">
                  {PHASE_BLURBS[phase]}
                </ThemedText>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* ─── Proof points ────────────────────────────────────────────────── */}
      <View style={styles.section}>
        <View style={[styles.proofBox, { borderColor: colors.border, backgroundColor: colors.card }]}>
          {PROOF_POINTS.map((point) => (
            <View key={point} style={styles.proofRow}>
              <View style={[styles.dot, { backgroundColor: colors.primary }]} />
              <ThemedText variant="body" tone="secondary" style={styles.proofText}>
                {point}
              </ThemedText>
            </View>
          ))}
        </View>

        <Button label="Get Started" onPress={() => router.push('/sign-in')} style={styles.cta} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hero: { justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  // 0.72 is set by the gold, not the cream: gold is a mid-tone, and this is
  // what keeps the large gold lines above 3:1 even where they cross a cloud.
  // The cream text clears 6:1 there.
  scrim: { backgroundColor: HERO_SCRIM, opacity: 0.72 },
  // A faint shadow, not a glow: it only matters where the text crosses a
  // bright cloud, and there it stops the letters dissolving into the sky.
  onPhoto: {
    color: HERO_TEXT,
    textShadowColor: 'rgba(0, 0, 0, 0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  onPhotoSoft: { color: HERO_TEXT_SOFT },
  onPhotoFaint: { color: HERO_TEXT_FAINT },
  onPhotoGold: {
    color: GOLD,
    textShadowColor: 'rgba(0, 0, 0, 0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  goldLine: { position: 'absolute', left: 0, right: 0, height: 2, backgroundColor: GOLD },
  heroContent: { paddingHorizontal: Spacing.five, alignItems: 'center' },
  wordmark: { textAlign: 'center' },
  title: { textAlign: 'center', marginTop: Spacing.three },
  tagline: { textAlign: 'center', marginTop: Spacing.four, maxWidth: 340 },
  promise: { textAlign: 'center', marginTop: Spacing.four },
  cta: { marginTop: Spacing.five, alignSelf: 'stretch', marginHorizontal: Spacing.two },
  scrollCue: { position: 'absolute', bottom: Spacing.five, alignItems: 'center', gap: Spacing.one },

  section: { paddingHorizontal: Spacing.five, paddingTop: Spacing.seven },
  centered: { textAlign: 'center' },
  sectionTitle: { marginTop: Spacing.two },
  sectionBlurb: { marginTop: Spacing.two },

  featureList: { gap: Spacing.three, marginTop: Spacing.five },
  feature: { borderWidth: 1, borderRadius: Radius.xl, padding: Spacing.four, gap: Spacing.two },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },

  phaseList: { gap: Spacing.two, marginTop: Spacing.five },
  phase: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.lg,
    padding: Spacing.three,
  },
  phaseNum: { width: 32, height: 32, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  phaseText: { flex: 1, gap: 2 },

  proofBox: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.xl,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  proofRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  dot: { width: 6, height: 6, borderRadius: 3 },
  proofText: { flex: 1 },
});
