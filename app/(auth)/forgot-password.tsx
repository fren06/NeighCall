import { TextField } from '@/components/form/TextField';
import { Screen } from '@/components/Screen';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import * as api from '@/lib/api';
import { useSession } from '@/lib/session';
import { useNotify } from '@/lib/use-notify';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';

const RESEND_SECONDS = 60;

type Errors = Partial<Record<'email' | 'code' | 'password' | 'confirm' | 'form', string>>;

/** Reset by emailed code: enter email → enter code + new password → signed in. */
export default function ForgotPassword() {
  const { setUser } = useSession();
  const notify = useNotify();
  const [step, setStep] = useState<'email' | 'reset'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  // Once the code is accepted the user is signed in behind the scenes; if
  // they leave before choosing a password, end that login again.
  const verified = useRef(false);
  const done = useRef(false);
  useEffect(
    () => () => {
      if (verified.current && !done.current) void api.cancelPasswordReset();
    },
    []
  );

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const sendCode = async () => {
    setErrors({});
    setBusy(true);
    try {
      await api.requestPasswordReset(email);
      setStep('reset');
      setResendIn(RESEND_SECONDS);
    } catch (e) {
      // e.g. "you can only request this after 42 seconds"
      setErrors({ [step === 'email' ? 'email' : 'code']: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    const e: Errors = {};
    if (!verified.current && !code.trim()) e.code = 'Enter the code from the email.';
    if (password.length < 8) e.password = 'Use at least 8 characters.';
    if (confirm !== password) e.confirm = 'Passwords do not match.';
    setErrors(e);
    if (Object.keys(e).length) return;

    setBusy(true);
    try {
      if (!verified.current) {
        try {
          await api.verifyResetCode(email, code);
          verified.current = true;
        } catch (err) {
          setErrors({ code: (err as Error).message });
          return;
        }
      }
      const user = await api.setNewPassword(password);
      done.current = true;
      setUser(user);
      notify('Password updated', "You're signed in with your new password.");
      router.replace('/');
    } catch (err) {
      setErrors({ password: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const startOver = () => {
    if (verified.current) void api.cancelPasswordReset();
    verified.current = false;
    setStep('email');
    setCode('');
    setPassword('');
    setConfirm('');
    setErrors({});
  };

  return (
    <Screen>
      <VStack className="gap-6">
        {step === 'email' ? (
          <>
            <VStack className="gap-1">
              <Heading size="xl">Reset password</Heading>
              <Text className="text-muted-foreground">
                Enter your email and we'll send you a code to choose a new password.
              </Text>
            </VStack>
            <TextField
              label="Email"
              value={email}
              onChangeText={(v) => {
                setEmail(v);
                setErrors({});
              }}
              error={errors.email}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              onSubmitEditing={sendCode}
            />
            <Button size="lg" onPress={sendCode} isDisabled={busy || !email.trim()}>
              {busy && <ButtonSpinner />}
              <ButtonText>Send code</ButtonText>
            </Button>
          </>
        ) : (
          <>
            <VStack className="gap-1">
              <Heading size="xl">Check your email</Heading>
              <Text className="text-muted-foreground">
                If an account exists for{' '}
                <Text className="font-medium text-foreground">{email.trim()}</Text>, we've sent it a
                code. It can take a minute, so check your spam folder too.
              </Text>
            </VStack>

            {verified.current ? (
              <Text size="sm" className="text-muted-foreground">
                Code accepted. Now choose your new password.
              </Text>
            ) : (
              <TextField
                label="Code"
                value={code}
                onChangeText={(v) => {
                  setCode(v);
                  setErrors((e) => ({ ...e, code: undefined }));
                }}
                error={errors.code}
                placeholder="123456"
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                maxLength={10}
              />
            )}
            <TextField
              label="New password"
              value={password}
              onChangeText={(v) => {
                setPassword(v);
                setErrors((e) => ({ ...e, password: undefined }));
              }}
              error={errors.password}
              helper="At least 8 characters."
              secureTextEntry
              autoComplete="new-password"
            />
            <TextField
              label="Confirm new password"
              value={confirm}
              onChangeText={(v) => {
                setConfirm(v);
                setErrors((e) => ({ ...e, confirm: undefined }));
              }}
              error={errors.confirm}
              secureTextEntry
              autoComplete="new-password"
              onSubmitEditing={reset}
            />
            <Button size="lg" onPress={reset} isDisabled={busy}>
              {busy && <ButtonSpinner />}
              <ButtonText>Set new password</ButtonText>
            </Button>

            {!verified.current && (
              <Button variant="link" onPress={sendCode} isDisabled={busy || resendIn > 0}>
                <ButtonText>
                  {resendIn > 0 ? `Send a new code in ${resendIn}s` : 'Send a new code'}
                </ButtonText>
              </Button>
            )}
            <Button variant="link" onPress={startOver}>
              <ButtonText>Use a different email</ButtonText>
            </Button>
          </>
        )}

        <Button variant="link" onPress={() => router.back()}>
          <ButtonText>Back to sign in</ButtonText>
        </Button>
      </VStack>
    </Screen>
  );
}
