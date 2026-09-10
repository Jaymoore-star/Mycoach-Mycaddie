import { Stack, useRouter } from 'expo-router';
import {
  BarChart2,
  Briefcase,
  CalendarDays,
  ChevronRight,
  Flame,
  GraduationCap,
  Radio,
  Target,
} from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { ThemedText } from '@/components/ui/text';
import { PHASES, PHASE_ORDER, PROGRAM_DAYS } from '@/constants/golf';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Ordered so a new golfer can work top to bottom on day one. */
const STEPS = [
  {
    icon: CalendarDays,
    title: 'Do today’s session',
    href: '/program' as const,
    body:
      'The 90-Day Program picks your drills from the phase you are in and the coach you chose. Tick each drill as you finish it, then advance the day.',
    detail: 'One program day per calendar day - the next unlocks at midnight.',
  },
  {
    icon: GraduationCap,
    title: 'Know your coach',
    href: '/(tabs)/coach' as const,
    body:
      'Each coach teaches one level of the system, from Que’s fundamentals to Dom’s tour-standard work. Your drills come from whichever coach is assigned.',
    detail: 'Switch coach when you move up a level, not before.',
  },
  {
    icon: Briefcase,
    title: 'Take the caddie on course',
    href: '/(tabs)/caddie' as const,
    body:
      'Pick a course and tee, then open Shot conditions on each hole to set distance, lie, wind, elevation and pin position. The caddie returns a club and a playing yardage.',
    detail: 'Score every hole as you go; 18 holes makes the round count.',
  },
  {
    icon: Radio,
    title: 'Log range sessions',
    href: '/launch' as const,
    body:
      'Enter carry, ball speed, smash and spin from a launch monitor. Carry distances roll straight into My Bag.',
    detail: 'Blank fields are treated as not measured, so they never skew an average.',
  },
  {
    icon: Target,
    title: 'Set up your bag',
    href: '/bag' as const,
    body:
      'Your real carry distances drive every club recommendation. They build from logged shots, or you can type them in if you already know them.',
    detail: 'A hand-set number always wins over the measured average.',
  },
  {
    icon: BarChart2,
    title: 'Watch the numbers',
    href: '/handicap' as const,
    body:
      'My Handicap follows WHS. My Stats shows where you miss. My Analytics shows which hole types cost you strokes.',
    detail: 'The handicap needs three complete rounds before it issues an index.',
  },
  {
    icon: Flame,
    title: 'Keep the streak',
    href: '/streak' as const,
    body:
      'Any practice session or round keeps a streak alive. Set a weekly target you can actually hit.',
    detail: 'A missed day pauses the program; it never loses your progress.',
  },
] as const;

export default function GuideScreen() {
  const colors = useTheme();
  const router = useRouter();

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'How to Use' }} />
      <Screen
        eyebrow="Getting started"
        title="How to Use"
        subtitle={`Everything in the app in the order you'll need it.`}>
        <Card eyebrow="The idea" title={`${PROGRAM_DAYS} days, greens to tee`}>
          <ThemedText variant="body" tone="secondary">
            The program works backwards from the hole. You start on the putter, because
            putting is roughly 40% of your strokes, and finish with the driver. Each phase
            runs {PHASES.putting.daysAllocated} days.
          </ThemedText>

          <View style={styles.phaseList}>
            {PHASE_ORDER.map((p, i) => (
              <View key={p} style={styles.phaseRow}>
                <View style={[styles.phaseNum, { backgroundColor: colors.backgroundElement }]}>
                  <ThemedText variant="caption" tone="accent">
                    {i + 1}
                  </ThemedText>
                </View>
                <ThemedText variant="caption" tone="secondary" style={styles.phaseLabel}>
                  {PHASES[p].label}
                </ThemedText>
                <ThemedText variant="caption" tone="muted">
                  {PHASES[p].daysAllocated}d
                </ThemedText>
              </View>
            ))}
          </View>
        </Card>

        <ThemedText variant="heading" style={styles.sectionHeading}>
          Working through it
        </ThemedText>

        <View style={styles.list}>
          {STEPS.map(({ icon: Icon, title, body, detail, href }, i) => (
            <Card key={title} onPress={() => router.push(href)} style={styles.step}>
              <View style={styles.stepHead}>
                <View style={[styles.stepNum, { backgroundColor: colors.backgroundElement }]}>
                  <ThemedText variant="caption" tone="accent">
                    {i + 1}
                  </ThemedText>
                </View>
                <Icon size={18} color={colors.primary} />
                <ThemedText variant="heading" style={styles.stepTitle}>
                  {title}
                </ThemedText>
                <ChevronRight size={16} color={colors.textMuted} />
              </View>
              <ThemedText variant="caption" tone="secondary">
                {body}
              </ThemedText>
              <ThemedText variant="caption" tone="muted">
                {detail}
              </ThemedText>
            </Card>
          ))}
        </View>

        <ThemedText variant="heading" style={styles.sectionHeading}>
          Worth knowing
        </ThemedText>

        <View style={styles.list}>
          <Card eyebrow="Honesty" title="Ticking a drill proves nothing">
            <ThemedText variant="caption" tone="secondary">
              Drill checkboxes are self-reported and always will be. What the app can
              verify is logged shot data and skills-test thresholds - those are measured
              against your level, and they are what make a handicap real.
            </ThemedText>
          </Card>

          <Card eyebrow="Distances" title="Carry, not total">
            <ThemedText variant="caption" tone="secondary">
              Every club number in the app is a carry distance - where the ball lands, not
              where it stops rolling. Club selection only works if you use the same
              measure throughout.
            </ThemedText>
          </Card>

          <Card eyebrow="Course data" title="Yardages are approximate">
            <ThemedText variant="caption" tone="secondary">
              The built-in course library is a starting point, not an official scorecard.
              Trust your rangefinder over the number on screen, and set the distance by
              hand in Shot conditions.
            </ThemedText>
          </Card>
        </View>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  sectionHeading: { marginTop: Spacing.five, marginBottom: Spacing.two },
  list: { gap: Spacing.two },
  phaseList: { gap: Spacing.one, marginTop: Spacing.two },
  phaseRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  phaseNum: {
    width: 22,
    height: 22,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phaseLabel: { flex: 1 },
  step: { gap: Spacing.two },
  stepHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  stepNum: {
    width: 22,
    height: 22,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepTitle: { flex: 1 },
});
