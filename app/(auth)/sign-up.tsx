import { EstateSelect } from '@/components/form/EstateSelect';
import { SkillPicker } from '@/components/form/SkillPicker';
import { TextField } from '@/components/form/TextField';
import { Screen } from '@/components/Screen';
import { Button, ButtonIcon, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Progress, ProgressFilledTrack } from '@/components/ui/progress';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { getEstates } from '@/lib/api';
import { useSession } from '@/lib/session';
import type { Estate, SignUpInput } from '@/types/models';
import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';

type Form = SignUpInput & { confirmPassword: string };
type Errors = Partial<Record<keyof Form, string>>;

const EMPTY: Form = {
  name: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
  estate_id: '',
  block: '',
  unit_number: '',
  street: '',
  skills: [],
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateAccount(f: Form): Errors {
  const e: Errors = {};
  if (!f.name.trim()) e.name = 'Enter your full name.';
  if (!EMAIL_RE.test(f.email.trim())) e.email = 'Enter a valid email address.';
  if (f.phone.replace(/\D/g, '').length < 9) e.phone = 'Enter a valid phone number.';
  if (f.password.length < 8) e.password = 'Use at least 8 characters.';
  if (f.confirmPassword !== f.password) e.confirmPassword = 'Passwords do not match.';
  return e;
}

function validateAddress(f: Form): Errors {
  const e: Errors = {};
  if (!f.estate_id) e.estate_id = 'Choose your estate.';
  if (!f.block.trim()) e.block = 'Required.';
  if (!f.unit_number.trim()) e.unit_number = 'Required.';
  if (!f.street.trim()) e.street = 'Enter your street.';
  return e;
}

export default function SignUp() {
  const { signUp } = useSession();
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [submitError, setSubmitError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [estates, setEstates] = useState<Estate[]>([]);

  useEffect(() => {
    getEstates().then(setEstates);
  }, []);

  const set = <K extends keyof Form>(key: K) => (value: Form[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const next = () => {
    const e = validateAccount(form);
    setErrors(e);
    if (Object.keys(e).length === 0) setStep(2);
  };

  const submit = async () => {
    const e = validateAddress(form);
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    setSubmitError(undefined);
    setBusy(true);
    try {
      const { confirmPassword, ...input } = form;
      await signUp(input);
      // Index sends the new (pending) account to the right screen.
      router.replace('/');
    } catch (err) {
      setSubmitError((err as Error).message);
      setBusy(false);
    }
  };

  const back = () => (step === 2 ? setStep(1) : router.back());

  return (
    <Screen>
      <VStack className="gap-6">
        <HStack className="items-center gap-3">
          <Button variant="ghost" size="icon" onPress={back} accessibilityLabel="Back">
            <ButtonIcon as={ArrowLeft} />
          </Button>
          <VStack className="flex-1 gap-1.5">
            <Text size="xs" className="text-muted-foreground">
              Step {step} of 2
            </Text>
            <Progress value={step * 50} className="h-1">
              <ProgressFilledTrack />
            </Progress>
          </VStack>
        </HStack>

        {step === 1 ? (
          <VStack className="gap-5">
            <VStack className="gap-1">
              <Heading size="xl">Create your account</Heading>
              <Text className="text-muted-foreground">
                Your details stay private unless you choose to share them.
              </Text>
            </VStack>

            <TextField
              label="Full name"
              value={form.name}
              onChangeText={set('name')}
              error={errors.name}
              autoComplete="name"
            />
            <TextField
              label="Email"
              value={form.email}
              onChangeText={set('email')}
              error={errors.email}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
            <TextField
              label="Phone number"
              value={form.phone}
              onChangeText={set('phone')}
              error={errors.phone}
              placeholder="+60 12-345 6789"
              keyboardType="phone-pad"
              autoComplete="tel"
            />
            <TextField
              label="Password"
              value={form.password}
              onChangeText={set('password')}
              error={errors.password}
              helper="At least 8 characters."
              secureTextEntry
              autoComplete="new-password"
            />
            <TextField
              label="Confirm password"
              value={form.confirmPassword}
              onChangeText={set('confirmPassword')}
              error={errors.confirmPassword}
              secureTextEntry
              autoComplete="new-password"
            />

            <Button size="lg" onPress={next}>
              <ButtonText>Continue</ButtonText>
            </Button>
          </VStack>
        ) : (
          <VStack className="gap-5">
            <VStack className="gap-1">
              <Heading size="xl">Where do you live?</Heading>
              <Text className="text-muted-foreground">
                Estate management checks this against their resident registry.
              </Text>
            </VStack>

            <EstateSelect
              estates={estates}
              value={form.estate_id}
              onChange={set('estate_id')}
              error={errors.estate_id}
            />
            <HStack className="gap-3">
              <TextField
                className="flex-1"
                label="Block"
                value={form.block}
                onChangeText={set('block')}
                error={errors.block}
                placeholder="B"
                autoCapitalize="characters"
              />
              <TextField
                className="flex-1"
                label="Unit no."
                value={form.unit_number}
                onChangeText={set('unit_number')}
                error={errors.unit_number}
                placeholder="12-03"
              />
            </HStack>
            <TextField
              label="Street"
              value={form.street}
              onChangeText={set('street')}
              error={errors.street}
              placeholder="Jalan Melati 3"
            />

            <VStack className="gap-2">
              <Text className="font-medium">
                Skills you can offer <Text className="text-muted-foreground">(optional)</Text>
              </Text>
              <Text size="sm" className="text-muted-foreground">
                We'll notify you when a neighbour needs help with one of these.
              </Text>
              <SkillPicker value={form.skills} onChange={set('skills')} />
            </VStack>

            {submitError && <Text className="text-destructive">{submitError}</Text>}

            <Button size="lg" onPress={submit} isDisabled={busy}>
              {busy && <ButtonSpinner />}
              <ButtonText>Submit for approval</ButtonText>
            </Button>
          </VStack>
        )}
      </VStack>
    </Screen>
  );
}
