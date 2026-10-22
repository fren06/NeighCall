import { TextField } from '@/components/form/TextField';
import { Screen } from '@/components/Screen';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Divider } from '@/components/ui/divider';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import * as api from '@/lib/api';
import { useSession } from '@/lib/session';
import type { Estate, User, UserStatus } from '@/types/models';
import { Ban, CircleAlert, CircleX, Clock } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';

const COPY: Record<
  Exclude<UserStatus, 'approved'>,
  { icon: typeof Clock; title: string; body: string; tone: string }
> = {
  pending: {
    icon: Clock,
    title: "We're verifying your address",
    body: "Your estate management will check your details against their resident registry. We'll send you a notification as soon as you're approved.",
    tone: 'bg-secondary',
  },
  needs_info: {
    icon: CircleAlert,
    title: 'Management needs more info',
    body: 'Please check the note below and update your details.',
    tone: 'bg-amber-500/15',
  },
  rejected: {
    icon: CircleX,
    title: "We couldn't verify you",
    body: "Your address didn't match the estate's resident registry. Contact your management office if you think this is a mistake.",
    tone: 'bg-destructive/15',
  },
  suspended: {
    icon: Ban,
    title: 'Account suspended',
    body: 'Your access has been suspended by estate management. Contact your management office for details.',
    tone: 'bg-destructive/15',
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
  const copy = COPY[user.status];

  return (
    <Screen>
      <VStack className="flex-1 gap-6">
        <VStack className="items-center gap-4 pt-8">
          <View className={`h-16 w-16 items-center justify-center rounded-full ${copy.tone}`}>
            <Icon as={copy.icon} className="h-7 w-7 text-foreground" />
          </View>
          <Heading size="lg" className="text-center">
            {copy.title}
          </Heading>
          <Text className="text-center text-muted-foreground">{copy.body}</Text>
        </VStack>

        {user.admin_note && (
          <Card className="gap-1">
            <Text size="xs" className="font-medium uppercase text-muted-foreground">
              Note from management
            </Text>
            <Text>{user.admin_note}</Text>
          </Card>
        )}

        {user.status === 'needs_info' ? (
          <ResubmitForm user={user} onSaved={setUser} />
        ) : (
          <Card className="gap-3">
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

        {__DEV__ && <DevApprovalPanel user={user} onChange={setUser} />}
      </VStack>
    </Screen>
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

/** Dev-only stand-in for the admin portal so the flow can be tested end to end. */
function DevApprovalPanel({ user, onChange }: { user: User; onChange: (u: User) => void }) {
  const act = async (status: UserStatus, note?: string) =>
    onChange(await api.devSetStatus(user.id, status, note));

  return (
    <Card className="gap-3 border-dashed">
      <Text size="xs" className="font-medium uppercase text-muted-foreground">
        Dev: simulate admin
      </Text>
      <HStack className="flex-wrap gap-2">
        <Button size="sm" onPress={() => act('approved')}>
          <ButtonText>Approve</ButtonText>
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onPress={() =>
            act('needs_info', 'We could not find this unit number in Block ' + user.block + '. Please double-check it.')
          }
        >
          <ButtonText>Request info</ButtonText>
        </Button>
        <Button size="sm" variant="destructive" onPress={() => act('rejected')}>
          <ButtonText>Reject</ButtonText>
        </Button>
      </HStack>
    </Card>
  );
}
