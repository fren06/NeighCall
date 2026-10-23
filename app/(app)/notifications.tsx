import { Button, ButtonIcon, ButtonText } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Pressable } from '@/components/ui/pressable';
import { SafeAreaView } from '@/components/ui/safe-area-view';
import { Text } from '@/components/ui/text';
import * as api from '@/lib/api';
import { useInbox } from '@/lib/inbox';
import { timeAgo } from '@/lib/post-meta';
import type { AppNotification, NotificationKind } from '@/types/models';
import { router, type Href } from 'expo-router';
import {
  ArrowLeft,
  Bell,
  HandHelping,
  type LucideIcon,
  Megaphone,
  MessageCircle,
  PartyPopper,
  Sparkles,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';

const KIND_ICON: Record<NotificationKind, LucideIcon> = {
  skill_match: Sparkles,
  offer: HandHelping,
  message: MessageCircle,
  bulletin: Megaphone,
  account: PartyPopper,
};

export default function Notifications() {
  const { unread, version, refresh } = useInbox();
  const [items, setItems] = useState<AppNotification[]>();
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await api.getNotifications());
    } catch {
      setItems((current) => current ?? []);
    }
  }, []);

  // Reloads on open and whenever a new notification arrives.
  useEffect(() => {
    load();
  }, [load, version]);

  const open = async (n: AppNotification) => {
    if (!n.read_at) {
      setItems((list) => list?.map((x) => (x.url === n.url ? { ...x, read_at: 'now' } : x)));
      api.markNotificationsRead(n.url).then(refresh, () => {});
    }
    if (n.url) router.navigate(n.url as Href);
  };

  const markAllRead = async () => {
    setItems((list) => list?.map((x) => ({ ...x, read_at: x.read_at ?? 'now' })));
    await api.markNotificationsRead().catch(() => {});
    refresh();
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="w-full max-w-xl flex-row items-center gap-2 self-center border-b border-border px-2 py-2">
        <Button variant="ghost" size="icon" onPress={() => router.back()} accessibilityLabel="Back">
          <ButtonIcon as={ArrowLeft} />
        </Button>
        <Text className="flex-1 font-semibold">Notifications</Text>
        {unread > 0 && (
          <Button variant="link" size="sm" onPress={markAllRead} className="mr-2">
            <ButtonText>Mark all read</ButtonText>
          </Button>
        )}
      </View>

      <FlatList
        data={items ?? []}
        keyExtractor={(n) => n.id}
        contentContainerClassName="w-full max-w-xl self-center pb-10"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              refresh();
              setRefreshing(false);
            }}
          />
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => open(item)}
            className={`flex-row items-start gap-3 px-4 py-3 data-[active=true]:bg-secondary ${
              item.read_at ? '' : 'bg-secondary/50'
            }`}
          >
            <View className="h-10 w-10 items-center justify-center rounded-full bg-secondary">
              <Icon as={KIND_ICON[item.kind] ?? Bell} size="md" className="text-foreground" />
            </View>
            <View className="flex-1 gap-0.5">
              <View className="flex-row items-center gap-2">
                <Text
                  className={`flex-1 ${item.read_at ? 'font-medium' : 'font-semibold'}`}
                  numberOfLines={1}
                >
                  {item.title}
                </Text>
                <Text size="xs" className="text-muted-foreground">
                  {timeAgo(item.created_at)}
                </Text>
              </View>
              {item.body ? (
                <Text size="sm" className="text-muted-foreground" numberOfLines={2}>
                  {item.body}
                </Text>
              ) : null}
            </View>
            {!item.read_at && <View className="mt-2 h-2.5 w-2.5 rounded-full bg-brand" />}
          </Pressable>
        )}
        ListEmptyComponent={
          items ? (
            <View className="items-center gap-3 px-8 py-20">
              <View className="h-14 w-14 items-center justify-center rounded-full bg-secondary">
                <Icon as={Bell} size="lg" className="text-muted-foreground" />
              </View>
              <Text className="text-center text-muted-foreground">
                You're all caught up. You'll see requests that match your skills, offers of help,
                messages and estate notices here.
              </Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}
