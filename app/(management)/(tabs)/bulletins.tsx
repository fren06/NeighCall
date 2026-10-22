import { Pill } from '@/components/management/Chips';
import { Button, ButtonIcon, ButtonText } from '@/components/ui/button';
import { Fab, FabIcon, FabLabel } from '@/components/ui/fab';
import { Heading } from '@/components/ui/heading';
import { SafeAreaView } from '@/components/ui/safe-area-view';
import { Text } from '@/components/ui/text';
import * as api from '@/lib/api';
import { timeAgo } from '@/lib/post-meta';
import { useSession } from '@/lib/session';
import { useNotify } from '@/lib/use-notify';
import type { Bulletin } from '@/types/models';
import { format } from 'date-fns';
import { router, useFocusEffect, type Href } from 'expo-router';
import { Plus, Trash2 } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';

function BulletinRow({ bulletin, onDeleted }: { bulletin: Bulletin; onDeleted: () => void }) {
  const { user } = useSession();
  const notify = useNotify();
  const [confirming, setConfirming] = useState(false);
  const expired = !!bulletin.pinned_until && bulletin.pinned_until < new Date().toISOString();

  const remove = async () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    await api.deleteBulletin(user!, bulletin.id);
    notify('Bulletin deleted');
    onDeleted();
  };

  return (
    <View className="gap-2 rounded-xl border border-border bg-card p-4">
      <View className="flex-row flex-wrap items-center gap-2">
        {bulletin.is_high_priority && <Pill label="Important" tone="bad" />}
        <Pill label={expired ? 'Expired' : 'Pinned'} tone={expired ? 'neutral' : 'good'} />
        <Text size="xs" className="text-muted-foreground">
          {timeAgo(bulletin.created_at)} ago
        </Text>
      </View>
      <Text className="font-semibold">{bulletin.title}</Text>
      <Text size="sm" className="text-muted-foreground">
        {bulletin.body}
      </Text>
      {bulletin.pinned_until && (
        <Text size="xs" className="text-muted-foreground">
          {expired ? 'Unpinned' : 'Pinned until'} {format(new Date(bulletin.pinned_until), 'd MMM, h:mm a')}
        </Text>
      )}
      <Button
        size="sm"
        variant={confirming ? 'destructive' : 'ghost'}
        className="self-start"
        onPress={remove}
      >
        <ButtonIcon as={Trash2} />
        <ButtonText>{confirming ? 'Tap again to delete' : 'Delete'}</ButtonText>
      </Button>
    </View>
  );
}

export default function Bulletins() {
  const { user } = useSession();
  const [items, setItems] = useState<Bulletin[]>();
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (user) setItems(await api.getAllBulletins(user));
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <FlatList
        data={items ?? []}
        keyExtractor={(b) => b.id}
        renderItem={({ item }) => <BulletinRow bulletin={item} onDeleted={load} />}
        ItemSeparatorComponent={() => <View className="h-3" />}
        ListHeaderComponent={
          <View className="gap-1 pb-4 pt-4">
            <Heading size="2xl">Bulletins</Heading>
            <Text size="sm" className="text-muted-foreground">
              Official notices pinned on every resident's feed.
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View>
            <Text className="py-10 text-center text-muted-foreground">
              {items ? 'No bulletins yet.' : 'Loading…'}
            </Text>
          </View>
        }
        contentContainerClassName="w-full max-w-xl self-center px-4 pb-28"
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
      <Fab
        size="lg"
        placement="bottom right"
        className="bg-brand shadow-lg"
        onPress={() => router.push('/compose-bulletin' as Href)}
        accessibilityLabel="New bulletin"
      >
        <FabIcon as={Plus} className="text-brand-foreground" />
        <FabLabel className="font-semibold text-brand-foreground">New bulletin</FabLabel>
      </Fab>
    </SafeAreaView>
  );
}
