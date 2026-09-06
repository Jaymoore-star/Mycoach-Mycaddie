import { useAuthActions } from '@convex-dev/auth/react';
import { useRouter } from 'expo-router';
import { ArrowLeft, Eye, EyeOff, Lock, LogIn, Mail } from 'lucide-react-native';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { ThemedText } from '@/components/ui/text';
import { FontSize, Radius, Spacing } from '@/constants/theme';
import { useOAuthSignIn } from '@/hooks/use-oauth-sign-in';
import { useTheme } from '@/hooks/use-theme';
import { GoogleIcon } from '@/components/ui/google-icon';

type Flow = 'signIn' | 'signUp';

export default function SignInScreen() {
  const colors = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signIn } = useAuthActions();

  const [flow, setFlow] = useState<Flow>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const google = useOAuthSignIn('google');
  const busy = submitting || google.inProgress;

  async function handleSubmit() {
    setError(null);

    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    if (flow === 'signUp' && password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setSubmitting(true);
    try {
      await signIn('password', { email: email.trim(), password, flow });
      // Stack.Protected in the root layout swaps to the tabs automatically
      // once isAuthenticated flips, so there is no navigation call here.
    } catch {
      setError(
        flow === 'signIn'
          ? 'Incorrect email or password.'
          : 'Could not create that account. It may already exist.',
      );
      setSubmitting(false);
    }
  }

  const inputStyle = [
    styles.input,
    { backgroundColor: colors.backgroundElement, borderColor: colors.border, color: colors.text },
  ];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Pressable
        onPress={() => router.back()}
        style={[styles.back, { top: insets.top + Spacing.four }]}
        hitSlop={12}>
        <ArrowLeft size={20} color={colors.textSecondary} />
        <ThemedText variant="label" tone="secondary">
          Back
        </ThemedText>
      </Pressable>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.eight, paddingBottom: insets.bottom + Spacing.six },
        ]}
        keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <ThemedText variant="caption" tone="accent" uppercase style={styles.centered}>
            Dominus Golf · Elite Academy
          </ThemedText>
          <ThemedText variant="title" style={[styles.centered, styles.title]}>
            {flow === 'signIn' ? 'Welcome back' : 'Create your account'}
          </ThemedText>
          <ThemedText variant="body" tone="secondary" style={styles.centered}>
            {flow === 'signIn'
              ? "Let's get you under 80."
              : 'Start the 90-day program today.'}
          </ThemedText>
        </View>

        <View style={styles.form}>
          <View style={styles.field}>
            <Mail size={18} color={colors.textMuted} style={styles.fieldIcon} />
            <TextInput
              style={inputStyle}
              placeholder="you@example.com"
              placeholderTextColor={colors.textMuted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              editable={!submitting}
            />
          </View>

          <View style={styles.field}>
            <Lock size={18} color={colors.textMuted} style={styles.fieldIcon} />
            <TextInput
              style={[...inputStyle, styles.inputWithTrailing]}
              placeholder="Password"
              placeholderTextColor={colors.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoComplete={flow === 'signIn' ? 'current-password' : 'new-password'}
              editable={!submitting}
            />
            <Pressable
              onPress={() => setShowPassword((v) => !v)}
              style={styles.trailing}
              hitSlop={8}
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}>
              {showPassword ? (
                <EyeOff size={18} color={colors.textMuted} />
              ) : (
                <Eye size={18} color={colors.textMuted} />
              )}
            </Pressable>
          </View>

          {(error || google.error) && (
            <ThemedText variant="label" tone="destructive" accessibilityRole="alert">
              {error ?? google.error}
            </ThemedText>
          )}

          <Button
            label={flow === 'signIn' ? 'Sign In' : 'Create Account'}
            icon={<LogIn size={18} color={colors.primaryText} />}
            onPress={handleSubmit}
            loading={submitting}
            disabled={busy}
          />
        </View>

        <View style={styles.divider}>
          <View style={[styles.rule, { backgroundColor: colors.border }]} />
          <ThemedText variant="caption" tone="muted" uppercase>
            or
          </ThemedText>
          <View style={[styles.rule, { backgroundColor: colors.border }]} />
        </View>

        <Button
          label="Continue with Google"
          variant="secondary"
          icon={<GoogleIcon />}
          onPress={() => void google.start()}
          loading={google.inProgress}
          disabled={busy}
        />

        <View style={styles.switchRow}>
          <ThemedText variant="body" tone="secondary">
            {flow === 'signIn' ? 'New to MyCoach?' : 'Already have an account?'}
          </ThemedText>
          <Pressable
            onPress={() => {
              setFlow(flow === 'signIn' ? 'signUp' : 'signIn');
              setError(null);
            }}
            hitSlop={8}>
            <ThemedText variant="body" tone="accent" style={styles.switchLink}>
              {flow === 'signIn' ? 'Create an account' : 'Sign in'}
            </ThemedText>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  // flexGrow + centred justification keeps the form vertically centred on tall
  // screens, but still lets it scroll when the keyboard shrinks the viewport.
  content: { paddingHorizontal: Spacing.five, flexGrow: 1, justifyContent: 'center' },
  back: {
    position: 'absolute',
    left: Spacing.five,
    zIndex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  header: { gap: Spacing.two, marginBottom: Spacing.six },
  centered: { textAlign: 'center' },
  title: { marginTop: Spacing.one },
  form: { gap: Spacing.three },
  field: { justifyContent: 'center' },
  fieldIcon: { position: 'absolute', left: Spacing.four, zIndex: 1 },
  input: {
    height: 54,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.lg,
    paddingLeft: 46,
    paddingRight: Spacing.four,
    fontSize: FontSize.base,
  },
  inputWithTrailing: { paddingRight: 46 },
  trailing: { position: 'absolute', right: Spacing.four },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    marginVertical: Spacing.five,
  },
  rule: { flex: 1, height: StyleSheet.hairlineWidth },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.one,
    marginTop: Spacing.six,
  },
  switchLink: { fontWeight: '600' },
});
