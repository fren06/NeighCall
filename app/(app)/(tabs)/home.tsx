import { BulletinBanner } from '@/components/feed/BulletinBanner';
import { PostCard, PostCardSkeleton } from '@/components/feed/PostCard';
import { Button, ButtonText } from '@/components/ui/button';
import { Fab, FabIcon, FabLabel } from '@/components/ui/fab';
import { Heading } from '@/components/ui/heading';
import { Icon } from '@/components/ui/icon';
import { Pressable } from '@/components/ui/pressable';
import { SafeAreaView } from '@/components/ui/safe-area-view';
import { Text } from '@/components/ui/text';
import * as api from '@/lib/api';
import { useSession } from '@/lib/session';
import { useNotify } from '@/lib/use-notify';
import type { Bulletin, Estate, FeedPost, User } from '@/types/models';
import { router, useFocusEffect } from 'expo-router';
import { Bell, Inbox, Plus } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, View } from 'react-native';

type Filter = 'all' | 'for_you' | 'urgent' | 'mine';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'for_you', label: 'For you' },
  { id: 'urgent', label: 'Urgent' },
  { id: 'mine', label: 'My posts' },
];

const matchesSkills = (post: FeedPost, user: User) =>
  !!post.analysis && (user.skills as string[]).includes(post.analysis.category);

function applyFilter(posts: FeedPost[], filter: Filter, user: User) {
  switch (filter) {
    case 'for_you':
      return posts.filter((p) => !p.is_mine && p.status !== 'resolved' && matchesSkills(p, user));
    case 'urgent':
      return posts.filter((p) => p.analysis?.urgency === 'high' && p.status !== 'resolved');
    case 'mine':
      return posts.filter((p) => p.is_mine);
    default:
      return posts;
  }
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function Home() {
  const { user } = useSession();
  const notify = useNotify();
  const [estate, setEstate] = useState<Estate>();
  const [posts, setPosts] = useState<FeedPost[]>();
  const [bulletins, setBulletins] = useState<Bulletin[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const [feed, notices] = await Promise.all([
      api.getFeed(user),
      api.getActiveBulletins(user.estate_id),
    ]);
    setPosts(feed);
    setBulletins(notices);
  }, [user]);

  useEffect(() => {
    if (user) api.getEstate(user.estate_id).then(setEstate);
  }, [user?.estate_id]);

  // Reload whenever the tab regains focus, e.g. after creating a post.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const visible = useMemo(
    () => (posts && user ? applyFilter(posts, filter, user) : []),
    [posts, filter, user]
  );

  if (!user) return null;

  const openPost = (post: FeedPost) =>
    router.push({ pathname: '/post/[id]', params: { id: post.id } });

  const report = async (post: FeedPost) => {
    await api.createReport(user.id, 'post', post.id, 'Reported from feed');
    notify('Report sent', 'Estate management will review this post.');
  };

  const header = (
    <View className="gap-5 pb-4">
      <View className="flex-row items-start justify-between pt-2">
        <View className="flex-1 gap-0.5">
          <Text size="sm" className="text-muted-foreground" numberOfLines={1}>
            {estate?.name ?? ' '}
          </Text>
          <Heading size="xl">
            {greeting()}, {user.name.split(' ')[0]}
          </Heading>
        </View>
        <Pressable
          accessibilityLabel="Notifications"
          className="h-10 w-10 items-center justify-center rounded-full bg-secondary"
          onPress={() => notify('No new notifications')}
        >
          <Icon as={Bell} size="md" className="text-foreground" />
        </Pressable>
      </View>

      {bulletins.map((b) => (
        <BulletinBanner key={b.id} bulletin={b} />
      ))}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-2"
      >
        {FILTERS.map(({ id, label }) => {
          const active = filter === id;
          return (
            <Pressable
              key={id}
              onPress={() => setFilter(id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              className={`rounded-full border px-4 py-2 ${
                active ? 'border-primary bg-primary' : 'border-border bg-transparent'
              }`}
            >
              <Text
                size="sm"
                className={`font-medium ${active ? 'text-primary-foreground' : 'text-foreground'}`}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <FlatList
        data={posts ? visible : []}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            matchesSkills={matchesSkills(item, user)}
            onPress={() => openPost(item)}
            onOfferHelp={() => openPost(item)}
            onReport={() => report(item)}
          />
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={
          posts ? (
            <EmptyState filter={filter} />
          ) : (
            <View className="gap-3">
              <PostCardSkeleton />
              <PostCardSkeleton />
            </View>
          )
        }
        ItemSeparatorComponent={() => <View className="h-3" />}
        contentContainerClassName="w-full max-w-xl self-center px-4 pb-28"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      />

      <Fab
        size="lg"
        placement="bottom right"
        className="bg-brand shadow-lg"
        onPress={() => router.push('/new-post')}
        accessibilityLabel="Ask for help"
      >
        <FabIcon as={Plus} className="text-brand-foreground" />
        <FabLabel className="font-semibold text-brand-foreground">Ask for help</FabLabel>
      </Fab>
    </SafeAreaView>
  );
}

function EmptyState({ filter }: { filter: Filter }) {
  const copy: Record<Filter, string> = {
    all: 'No requests yet. Be the first to ask your neighbours for a hand.',
    for_you: 'Nothing matching your skills right now. Add more skills in your profile.',
    urgent: 'No urgent requests right now.',
    mine: "You haven't posted anything yet.",
  };
  return (
    <View className="items-center gap-3 py-16">
      <View className="h-14 w-14 items-center justify-center rounded-full bg-secondary">
        <Icon as={Inbox} size="lg" className="text-muted-foreground" />
      </View>
      <Text className="max-w-xs text-center text-muted-foreground">{copy[filter]}</Text>
      {(filter === 'all' || filter === 'mine') && (
        <Button variant="brand" onPress={() => router.push('/new-post')}>
          <ButtonText>Ask for help</ButtonText>
        </Button>
      )}
    </View>
  );
}
