import { useQuery } from 'convex/react';
import { useMemo } from 'react';
import { Alert } from 'react-native';

import { api } from '@/convex/_generated/api';

import { errorMessage } from './errors';

/** Mirrors the `reason` validator in `convex/reports.ts`. */
export type ReportReason = 'harmful' | 'inaccurate';

const ALREADY_TITLE = 'Already reported';
const ALREADY_BODY = 'You have already reported this. We review every report.';

/**
 * The responses this golfer has already reported, for showing "Reported" in
 * place of the button. Empty while loading, which errs towards asking - the
 * server still refuses to store a second report.
 */
export function useReportedTargets(): Set<string> {
  const targets = useQuery(api.reports.myReportedTargets, {});
  return useMemo(() => new Set(targets ?? []), [targets]);
}

/**
 * Asks why the golfer is reporting something the AI said, then sends it.
 *
 * Google Play requires apps that generate content with AI to let users flag
 * it. Two reasons and Cancel, because that is all an Android alert can hold -
 * a fourth button is silently dropped.
 *
 * `alreadyReported` short-circuits the question: asking for a reason and then
 * discarding the answer is worse than saying so up front. The server keeps
 * one report per golfer per response regardless, and says so if the screen
 * did not know.
 */
export function reportAiContent(
  send: (reason: ReportReason) => Promise<{ alreadyReported: boolean }>,
  options: { alreadyReported?: boolean; onReported?: () => void } = {},
) {
  if (options.alreadyReported) {
    Alert.alert(ALREADY_TITLE, ALREADY_BODY);
    return;
  }

  const submit = (reason: ReportReason) => {
    send(reason).then(
      ({ alreadyReported }) => {
        options.onReported?.();
        if (alreadyReported) Alert.alert(ALREADY_TITLE, ALREADY_BODY);
        else Alert.alert('Thanks for telling us', 'We review every report.');
      },
      (e: unknown) => Alert.alert('Could not send the report', errorMessage(e, 'Please try again.')),
    );
  };

  Alert.alert('Report this response', 'What is wrong with it?', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Wrong or misleading', onPress: () => submit('inaccurate') },
    { text: 'Harmful or offensive', style: 'destructive', onPress: () => submit('harmful') },
  ]);
}
