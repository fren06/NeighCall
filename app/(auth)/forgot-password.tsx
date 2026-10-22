import { TextField } from '@/components/form/TextField';
import { Screen } from '@/components/Screen';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import * as api from '@/lib/api';
import { router } from 'expo-router';
import React, { useState } from 'react';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    setError(undefined);
    setBusy(true);
    try {
      await api.requestPasswordReset(email);
      setSent(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <VStack className="gap-6">
        <VStack className="gap-1">
          <Heading size="xl">Reset password</Heading>
          <Text className="text-muted-foreground">
            Enter your email and we'll send you a link to choose a new password.
          </Text>
        </VStack>

        {sent ? (
          <Text>If an account exists for {email.trim()}, a reset link is on its way.</Text>
        ) : (
          <>
            <TextField
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              onSubmitEditing={submit}
            />
            {error && <Text className="text-destructive">{error}</Text>}
            <Button size="lg" onPress={submit} isDisabled={busy || !email}>
              {busy && <ButtonSpinner />}
              <ButtonText>Send reset link</ButtonText>
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
