import { FilterChips, Pill } from '@/components/management/Chips';
import { Button, ButtonIcon, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Pressable } from '@/components/ui/pressable';
import { SafeAreaView } from '@/components/ui/safe-area-view';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/form/TextField';
import * as api from '@/lib/api';
import { useSession } from '@/lib/session';
import { timeAgo } from '@/lib/post-meta';
import { useNotify } from '@/lib/use-notify';
import { SKILLS, type User, type UserStatus } from '@/types/models';
import { router, useFocusEffect, type Href } from 'expo-router';
import { Pencil, Trash2, UserPlus } from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';

type Filter = 'pending' | 'approved' | 'other';

const STATUS_PILL: Record<UserStatus, { label: string; tone: 'neutral' | 'good' | 'warn' | 'bad' }> = {
  pending: { label: 'Pending', tone: 'warn' },
  needs_info: { label: 'Info requested', tone: 'warn' },
  approved: { label: 'Approved', tone: 'good' },
  rejected: { label: 'Rejected', tone: 'bad' },
  suspended: { label: 'Suspended', tone: 'bad' },
};

const skillLabel = (id: string) => SKILLS.find((s) => s.id === id)?.label ?? id;

function ResidentCard({
  resident,
  onChange,
  onDeleted,
}: {
  resident: User;
  onChange: (u: User) => void;
  onDeleted: (id: string) => void;
}) {
  const { user: staff } = useSession();
  const notify = useNotify();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(resident.admin_note ?? '');
  const [busy, setBusy] = useState<UserStatus>();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const pill = STATUS_PILL[resident.status];

  const act = async (status: UserStatus, done: string) => {
    if (!staff) return;
    setBusy(status);
    try {
      const updated = await api.reviewResident(staff, resident.id, status, note);
      notify(done, resident.name);
      onChange(updated);
      setOpen(false);
    } catch (e) {
      notify("Couldn't update", (e as Error).message);
    } finally {
      setBusy(undefined);
    }
  };

  const remove = async () => {
    if (!staff) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    try {
      await api.adminDeleteUser(staff, resident.id);
      notify('Resident deleted', resident.name);
      onDeleted(resident.id);
    } catch (e) {
      notify("Couldn't delete", (e as Error).message);
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const actionButton = (
    status: UserStatus,
    label: string,
    done: string,
    variant: 'brand' | 'outline' | 'destructive'
  ) => (
    <Button
      key={status}
      size="sm"
      variant={variant}
      className="flex-1"
      isDisabled={!!busy}
      onPress={() => act(status, done)}
    >
      {busy === status && <ButtonSpinner />}
      <ButtonText>{label}</ButtonText>
    </Button>
  );

  const s = resident.status;
  return (
    <View className="gap-3 rounded-xl border border-border bg-card p-4">
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityHint={open ? 'Hide review options' : 'Show review options'}
        className="gap-2"
      >
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text className="font-semibold">{resident.name}</Text>
            <Text size="sm" className="text-muted-foreground">
              Block {resident.block} · Unit {resident.unit_number} · {resident.street}
            </Text>
          </View>
          <Pill label={pill.label} tone={pill.tone} />
        </View>
        <Text size="xs" className="text-muted-foreground">
          {resident.email} · {resident.phone} · registered {timeAgo(resident.created_at)} ago
        </Text>
        {resident.skills.length > 0 && (
          <Text size="xs" className="text-muted-foreground">
            Skills: {resident.skills.map(skillLabel).join(', ')}
          </Text>
        )}
        {!!resident.warning_count && (
          <Text size="xs" className="font-medium text-amber-700 dark:text-amber-400">
            {resident.warning_count} warning{resident.warning_count > 1 ? 's' : ''} issued
          </Text>
        )}
      </Pressable>

      {open && (
        <View className="gap-3 border-t border-border pt-3">
          <TextField
            label="Note to resident"
            helper={
              s === 'approved'
                ? 'Shown to the resident if you suspend them'
                : 'Required when asking for more info'
            }
            value={note}
            onChangeText={setNote}
            placeholder="e.g. Please confirm your unit number"
            multiline
          />
          <View className="flex-row gap-2">
            {(s === 'pending' || s === 'needs_info') && (
              <>
                {actionButton('approved', 'Approve', 'Resident approved', 'brand')}
                {actionButton('needs_info', 'Ask info', 'Info requested', 'outline')}
                {actionButton('rejected', 'Reject', 'Resident rejected', 'destructive')}
              </>
            )}
            {s === 'approved' &&
              actionButton('suspended', 'Suspend access', 'Resident suspended', 'destructive')}
            {(s === 'rejected' || s === 'suspended') &&
              actionButton('approved', 'Approve / reinstate', 'Resident approved', 'brand')}
          </View>
          <View className="flex-row gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onPress={() =>
                router.push({ pathname: '/user-form', params: { id: resident.id } } as Href)
              }
            >
              <ButtonIcon as={Pencil} />
              <ButtonText>Edit details</ButtonText>
            </Button>
            <Button
              size="sm"
              variant={confirmDelete ? 'destructive' : 'ghost'}
              className="flex-1"
              isDisabled={deleting}
              onPress={remove}
            >
              {deleting ? <ButtonSpinner /> : <ButtonIcon as={Trash2} />}
              <ButtonText>{confirmDelete ? 'Tap again to delete' : 'Delete'}</ButtonText>
            </Button>
          </View>
        </View>
      )}
    </View>
  );
}

export default function Users() {
  const { user } = useSession();
  const [residents, setResidents] = useState<User[]>();
  const [filter, setFilter] = useState<Filter>('pending');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (user) setResidents(await api.getResidents(user));
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const groups = useMemo(() => {
    const all = residents ?? [];
    return {
      pending: all.filter((r) => r.status === 'pending' || r.status === 'needs_info'),
      approved: all.filter((r) => r.status === 'approved'),
      other: all.filter((r) => r.status === 'rejected' || r.status === 'suspended'),
    };
  }, [residents]);

  const drop = (id: string) => setResidents((list) => list?.filter((r) => r.id !== id));

  const replace = (u: User) =>
    setResidents((list) => list?.map((r) => (r.id === u.id ? u : r)));

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <FlatList
        data={residents ? groups[filter] : []}
        keyExtractor={(r) => r.id}
        renderItem={({ item }) => (
          <ResidentCard resident={item} onChange={replace} onDeleted={drop} />
        )}
        ItemSeparatorComponent={() => <View className="h-3" />}
        ListHeaderComponent={
          <View className="gap-4 pb-4 pt-4">
            <View className="flex-row items-center justify-between gap-3">
              <Heading size="2xl">Users</Heading>
              <Button variant="brand" size="sm" onPress={() => router.push('/user-form' as Href)}>
                <ButtonIcon as={UserPlus} />
                <ButtonText>Add resident</ButtonText>
              </Button>
            </View>
            <FilterChips
              value={filter}
              onChange={setFilter}
              options={[
                { id: 'pending', label: 'To review', count: groups.pending.length },
                { id: 'approved', label: 'Approved', count: groups.approved.length },
                { id: 'other', label: 'Rejected / suspended', count: groups.other.length },
              ]}
            />
          </View>
        }
        ListEmptyComponent={
          <View>
            <Text className="py-10 text-center text-muted-foreground">
              {residents ? 'Nobody here right now.' : 'Loading…'}
            </Text>
          </View>
        }
        contentContainerClassName="w-full max-w-xl self-center px-4 pb-10"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
      />
    </SafeAreaView>
  );
}
