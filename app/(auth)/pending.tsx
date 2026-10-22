import { TextField } from '@/components/form/TextField';
import { Screen } from '@/components/Screen';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Divider } from '@/components/ui/divider';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Icon } from '@/components/ui/icon';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import * as api from '@/lib/api';
import { useSession } from '@/lib/session';
import type { Estate, User, UserStatus } from '@/types/models';
import { Ban, Check, CircleAlert, CircleX, HandHeart } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';

type WaitingStatus = Exclude<UserStatus, 'approved'>;

// Pending and needs-info show the welcome-style header and progress steps.
// Rejected and suspended are final, so they get a plain status icon instead.
const COPY: Record<WaitingStatus, { title: (first: string) => string; body: string }> = {
  pending: {
    title: (first) => `Thanks for joining, ${first}!`,
    body: "Your estate management is checking your address against their resident registry. You'll be let in as soon as they approve.",
  },
  needs_info: {
    title: () => 'Management needs more info',
    body: 'Please check the note below and update your details.',
  },
  rejected: {
    title: () => "We couldn't verify you",
    body: "Your address didn't match the estate's resident registry. Contact your management office if you think this is a mistake.",
  },
  suspended: {
    title: () => 'Account suspended',
    body: 'Your access has been suspended by estate management. Contact your management office for details.',
  },
};


export default function Pending() {
  const { user, setUser, signOut } = useSession();
  const [estate, setEstate] = useState<Estate>();

  useEffect(() => {
    if (user) api.getEstate(user.estate_id).then(setEstate);
  }, [user?.estate_id]);

  // Pick up decisions made by management (approve, request info, ...).
  const userId = user?.id;
  const knownStatus = user?.status;
  const knownNote = user?.admin_note;
  useEffect(() => {
    if (!userId) return;
    const timer = setInterval(async () => {
      const latest = await api.getUser(userId);
      if (latest && (latest.status !== knownStatus || latest.admin_note !== knownNote)) {
        setUser(latest);
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [userId, knownStatus, knownNote, setUser]);

  if (!user || user.status === 'approved') return null;
  const status = user.status;
  const copy = COPY[status];
  const waiting = status === 'pending' || status === 'needs_info';

  return (
    <Screen>
      <VStack className="flex-1 gap-6">
        <VStack className="items-center gap-4 pt-8">
          {waiting ? (
            <View className="h-20 w-20 items-center justify-center rounded-3xl bg-primary">
              <Icon as={HandHeart} className="h-10 w-10 text-primary-foreground" />
            </View>
          ) : (
            <View className="h-16 w-16 items-center justify-center rounded-full bg-destructive/15">
              <Icon as={status === 'suspended' ? Ban : CircleX} className="h-7 w-7 text-foreground" />
            </View>
          )}
          <Heading size="xl" className="text-center">
            {copy.title(user.name.split(' ')[0])}
          </Heading>
          <Text className="text-center text-muted-foreground">{copy.body}</Text>
        </VStack>

        {waiting && <ProgressSteps needsInfo={status === 'needs_info'} />}

        {status === 'pending' && (
          <HStack className="items-center justify-center gap-2">
            <Spinner size="small" className="text-muted-foreground" />
            <Text size="sm" className="text-muted-foreground">
              This page updates by itself, no need to refresh.
            </Text>
          </HStack>
        )}

        {user.admin_note && (
          <Card className="gap-1">
            <Text size="xs" className="font-medium uppercase text-muted-foreground">
              Note from management
            </Text>
            <Text>{user.admin_note}</Text>
          </Card>
        )}

        {status === 'needs_info' ? (
          <ResubmitForm user={user} onSaved={setUser} />
        ) : (
          <Card className="gap-3">
            <Text size="xs" className="font-semibold uppercase tracking-wide text-muted-foreground">
              Your submitted details
            </Text>
            <Detail label="Name" value={user.name} />
            <Divider />
            <Detail label="Estate" value={estate?.name ?? '…'} />
            <Divider />
            <Detail label="Address" value={`Block ${user.block}, ${user.unit_number}, ${user.street}`} />
          </Card>
        )}

        <View className="flex-1" />

        <Button variant="outline" onPress={signOut}>
          <ButtonText>Sign out</ButtonText>
        </Button>
      </VStack>
    </Screen>
  );
}

type StepState = 'done' | 'current' | 'attention' | 'upcoming';

/** Account created → management review → join the community. */
function ProgressSteps({ needsInfo }: { needsInfo: boolean }) {
  const steps: { title: string; detail: string; state: StepState }[] = [
    { title: 'Account created', detail: 'Your details were sent to management.', state: 'done' },
    needsInfo
      ? { title: 'Action needed', detail: 'Update your details so management can finish the review.', state: 'attention' }
      : { title: 'Management review', detail: 'Checking your address against the resident registry.', state: 'current' },
    { title: 'Join your neighbours', detail: 'Post requests, offer help and chat.', state: 'upcoming' },
  ];

  return (
    <Card className="gap-0">
      {steps.map((step, i) => (
        <HStack key={step.title} className="gap-3">
          <View className="items-center">
            <StepMarker state={step.state} number={i + 1} />
            {i < steps.length - 1 && <View className="my-1 w-0.5 flex-1 bg-border" />}
          </View>
          <VStack className={`flex-1 gap-0.5 ${i < steps.length - 1 ? 'pb-5' : ''}`}>
            <Text
              className={`font-semibold ${
                step.state === 'upcoming' ? 'text-muted-foreground' : ''
              } ${step.state === 'attention' ? 'text-amber-700 dark:text-amber-400' : ''}`}
            >
              {step.title}
            </Text>
            <Text size="sm" className="text-muted-foreground">
              {step.detail}
            </Text>
          </VStack>
        </HStack>
      ))}
    </Card>
  );
}

function StepMarker({ state, number }: { state: StepState; number: number }) {
  if (state === 'done') {
    return (
      <View className="h-7 w-7 items-center justify-center rounded-full bg-brand">
        <Icon as={Check} size="sm" className="text-brand-foreground" />
      </View>
    );
  }
  if (state === 'current') {
    return (
      <View className="h-7 w-7 items-center justify-center rounded-full border-2 border-brand">
        <View className="h-2.5 w-2.5 rounded-full bg-brand" />
      </View>
    );
  }
  if (state === 'attention') {
    return (
      <View className="h-7 w-7 items-center justify-center rounded-full bg-amber-500/15">
        <Icon as={CircleAlert} size="sm" className="text-amber-600 dark:text-amber-400" />
      </View>
    );
  }
  return (
    <View className="h-7 w-7 items-center justify-center rounded-full border border-border">
      <Text size="xs" className="font-semibold text-muted-foreground">
        {number}
      </Text>
    </View>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <HStack className="justify-between gap-4">
      <Text size="sm" className="text-muted-foreground">
        {label}
      </Text>
      <Text size="sm" className="flex-1 text-right font-medium">
        {value}
      </Text>
    </HStack>
  );
}

function ResubmitForm({ user, onSaved }: { user: User; onSaved: (u: User) => void }) {
  const [block, setBlock] = useState(user.block);
  const [unit, setUnit] = useState(user.unit_number);
  const [street, setStreet] = useState(user.street);
  const [phone, setPhone] = useState(user.phone);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      onSaved(
        await api.updateProfile(user.id, { block, unit_number: unit, street, phone })
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <VStack className="gap-4">
      <HStack className="gap-3">
        <TextField className="flex-1" label="Block" value={block} onChangeText={setBlock} />
        <TextField className="flex-1" label="Unit no." value={unit} onChangeText={setUnit} />
      </HStack>
      <TextField label="Street" value={street} onChangeText={setStreet} />
      <TextField label="Phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <Button onPress={save} isDisabled={busy}>
        {busy && <ButtonSpinner />}
        <ButtonText>Resubmit for approval</ButtonText>
      </Button>
    </VStack>
  );
}
