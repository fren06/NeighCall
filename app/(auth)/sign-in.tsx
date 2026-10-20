import { TextField } from '@/components/form/TextField';
import { Screen } from '@/components/Screen';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useSession } from '@/lib/session';
import { router } from 'expo-router';
import React, { useState } from 'react';

export default function SignIn() {
  const { signIn } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(undefined);
    setBusy(true);
    try {
      await signIn(email, password);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <Screen>
      <VStack className="gap-6">
        <VStack className="gap-1">
          <Heading size="xl">Welcome back</Heading>
          <Text className="text-muted-foreground">Sign in to your NeighCall account.</Text>
        </VStack>

        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />
        <TextField
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
          onSubmitEditing={submit}
        />

        {error && <Text className="text-destructive">{error}</Text>}

        <Button size="lg" onPress={submit} isDisabled={busy || !email || !password}>
          {busy && <ButtonSpinner />}
          <ButtonText>Sign in</ButtonText>
        </Button>
        <Button variant="link" onPress={() => router.replace('/sign-up')}>
          <ButtonText>New here? Create an account</ButtonText>
        </Button>

        {__DEV__ && (
          <Text size="xs" className="text-center text-muted-foreground">
            Demo account: aisyah@example.com / password
          </Text>
        )}
      </VStack>
    </Screen>
  );
}
