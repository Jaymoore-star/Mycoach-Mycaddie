import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from './text';

/**
 * Chart primitives.
 *
 * Every chart here plots a single series, so colour carries magnitude or
 * change-over-time rather than identity: one hue (brand gold) and direct
 * labels, no categorical palette and therefore no legend. Where a value needs
 * a good/bad reading, a status colour is used *and* the number is shown, so
 * meaning is never colour-alone.
 *
 * Marks follow the house spec: 2px strokes, >=8px end markers, 4px rounded
 * data-ends anchored to the baseline, a 2px gap between adjacent fills, and a
 * recessive baseline. Labels are selective - first, last and extremes - never
 * a number on every point.
 */

type SparklineProps = {
  values: number[];
  /** Series colour; defaults to brand gold. */
  color?: string;
  height?: number;
  /** Lower is better (scores, handicap), so the trend arrow flips. */
  lowerIsBetter?: boolean;
  /** Appended to the labelled first/last values. */
  unit?: string;
};

/** Line chart for a single measure over time. */
export function Sparkline({
  values,
  color,
  height = 96,
  lowerIsBetter = true,
  unit = '',
}: SparklineProps) {
  const colors = useTheme();
  const stroke = color ?? colors.primary;

  if (values.length < 2) {
    return (
      <View style={[styles.empty, { height, borderColor: colors.border }]}>
        <ThemedText variant="caption" tone="muted">
          {values.length === 0 ? 'No data yet' : 'One data point - need two to plot a trend'}
        </ThemedText>
      </View>
    );
  }

  // Fixed viewBox with a 1:1 coordinate space; the SVG scales to the card.
  const W = 300;
  const H = height;
  const pad = 10;

  const min = Math.min(...values);
  const max = Math.max(...values);
  // A flat series would divide by zero; centre it instead.
  const span = max - min || 1;

  const x = (i: number) => pad + (i / (values.length - 1)) * (W - pad * 2);
  const y = (v: number) => H - pad - ((v - min) / span) * (H - pad * 2);

  const path = values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(v)}`).join(' ');

  const first = values[0];
  const last = values[values.length - 1];
  const improving = lowerIsBetter ? last < first : last > first;

  return (
    <View style={styles.chartBlock}>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        {/* Recessive baseline - no grid, the labels carry the values. */}
        <Line
          x1={pad}
          y1={H - pad}
          x2={W - pad}
          y2={H - pad}
          stroke={colors.border}
          strokeWidth={1}
        />
        <Path d={path} stroke={stroke} strokeWidth={2} fill="none" strokeLinecap="round" />
        {/* End marker only: a dot on every point is noise. */}
        <Circle cx={x(values.length - 1)} cy={y(last)} r={5} fill={stroke} />
      </Svg>

      <View style={styles.chartFoot}>
        <ThemedText variant="caption" tone="muted">
          {first.toFixed(1)}
          {unit} first
        </ThemedText>
        <ThemedText
          variant="caption"
          style={{ color: improving ? colors.success : colors.textSecondary }}>
          {improving ? '▼ improving' : '▲ rising'}
        </ThemedText>
        <ThemedText variant="caption" tone="accent">
          {last.toFixed(1)}
          {unit} now
        </ThemedText>
      </View>
    </View>
  );
}

type BarRowProps = {
  label: string;
  value: number;
  /** Bar length is value/max; pass the largest value in the group. */
  max: number;
  /** Text shown at the end of the row. Defaults to the raw value. */
  display?: string;
  color?: string;
};

/**
 * One labelled horizontal bar.
 *
 * Used instead of a pie for breakdowns: a bar list reads the magnitude
 * directly, keeps every category labelled in text, and needs no categorical
 * palette.
 */
export function BarRow({ label, value, max, display, color }: BarRowProps) {
  const colors = useTheme();
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;

  return (
    <View style={styles.barRow}>
      <View style={styles.barHead}>
        <ThemedText variant="caption" tone="secondary" style={styles.barLabel}>
          {label}
        </ThemedText>
        <ThemedText variant="caption" tone="muted">
          {display ?? String(value)}
        </ThemedText>
      </View>
      <View style={[styles.barTrack, { backgroundColor: colors.backgroundElement }]}>
        <View
          style={[
            styles.barFill,
            { width: `${pct}%`, backgroundColor: color ?? colors.primary },
          ]}
        />
      </View>
    </View>
  );
}

type CalendarHeatProps = {
  /** Active dates as YYYY-MM-DD. */
  activeDates: string[];
  /** Local YYYY-MM-DD for "today". */
  today: string;
  /** How many days back to show. */
  days?: number;
};

/**
 * Activity calendar for the last N days.
 *
 * Sequential by definition - a day is either practised or not - so it uses one
 * hue at two steps rather than a rainbow, with today ringed.
 */
export function CalendarHeat({ activeDates, today, days = 91 }: CalendarHeatProps) {
  const colors = useTheme();
  const active = new Set(activeDates);

  const CELL = 12;
  const GAP = 2; // the 2px surface gap between adjacent fills
  const ROWS = 7;

  const cells: { date: string; on: boolean }[] = [];
  const end = new Date(`${today}T00:00:00Z`);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setUTCDate(d.getUTCDate() - i);
    const iso = d.toISOString().slice(0, 10);
    cells.push({ date: iso, on: active.has(iso) });
  }

  const cols = Math.ceil(cells.length / ROWS);
  const W = cols * (CELL + GAP);
  const H = ROWS * (CELL + GAP);

  return (
    <View style={styles.chartBlock}>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        {cells.map((c, i) => {
          const col = Math.floor(i / ROWS);
          const row = i % ROWS;
          const isToday = c.date === today;
          return (
            <Rect
              key={c.date}
              x={col * (CELL + GAP)}
              y={row * (CELL + GAP)}
              width={CELL}
              height={CELL}
              rx={3}
              fill={c.on ? colors.primary : colors.backgroundElement}
              stroke={isToday ? colors.text : 'none'}
              strokeWidth={isToday ? 1.5 : 0}
            />
          );
        })}
      </Svg>
      <View style={styles.chartFoot}>
        <ThemedText variant="caption" tone="muted">
          {days} days
        </ThemedText>
        <ThemedText variant="caption" tone="muted">
          {cells.filter((c) => c.on).length} active
        </ThemedText>
        <ThemedText variant="caption" tone="muted">
          today ringed
        </ThemedText>
      </View>
    </View>
  );
}

/** Large single figure - the right form when there is one number to report. */
export function HeroStat({
  value,
  label,
  hint,
  tone = 'accent',
}: {
  value: string;
  label: string;
  hint?: string;
  tone?: 'accent' | 'default';
}) {
  const colors = useTheme();
  return (
    <View style={styles.hero}>
      <ThemedText
        variant="stat"
        style={[styles.heroValue, { color: tone === 'accent' ? colors.primary : colors.text }]}>
        {value}
      </ThemedText>
      <ThemedText variant="caption" tone="muted" uppercase>
        {label}
      </ThemedText>
      {hint && (
        <ThemedText variant="caption" tone="secondary" style={styles.heroHint}>
          {hint}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  chartBlock: { gap: Spacing.two, marginTop: Spacing.two },
  chartFoot: { flexDirection: 'row', justifyContent: 'space-between' },
  empty: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },

  barRow: { gap: Spacing.one },
  barHead: { flexDirection: 'row', justifyContent: 'space-between' },
  barLabel: { flex: 1 },
  barTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  // 4px rounded data-end, anchored to the baseline at the left.
  barFill: { height: '100%', borderRadius: 4 },

  hero: { alignItems: 'center', gap: 2 },
  heroValue: { fontSize: 48, lineHeight: 54 },
  heroHint: { textAlign: 'center' },
});
