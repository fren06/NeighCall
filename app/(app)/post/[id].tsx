import { displayName, PersonAvatar } from '@/components/PersonAvatar';
import { Button, ButtonIcon, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { SafeAreaView } from '@/components/ui/safe-area-view';
import { ScrollView } from '@/components/ui/scroll-view';
import { Text } from '@/components/ui/text';
import * as api from '@/lib/api';
import { categoryMeta, STATUS_META, timeAgo, URGENCY_META } from '@/lib/post-meta';
import { useSession } from '@/lib/session';
import { useOfferHelp } from '@/lib/use-offer-help';
import type { FeedPost } from '@/types/models';
import { router, useLocalSearchParams } from 'expo-router';
import { useNotify } from '@/lib/use-notify';
import { ArrowLeft, CheckCircle2, HandHelping, MessageCircle, Trash2 } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Alert, Image, Platform, View } from 'react-native';

export default function PostDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useSession();
  const offerHelp = useOfferHelp();
  const notify = useNotify();
  const [post, setPost] = useState<FeedPost | null>();

  useEffect(() => {
    if (user && id) api.getPost(user, id).then((p) => setPost(p ?? null));
  }, [user, id]);

  const setStatus = async (status: 'open' | 'in_progress' | 'resolved') => {
    if (!user || !post) return;
    try {
      await api.updatePostStatus(user, post.id, status);
      setPost({ ...post, status });
      notify('Request updated', STATUS_META[status].label);
    } catch (e) {
      notify("Couldn't update", (e as Error).message);
    }
  };

  const remove = async () => {
    if (!user || !post) return;
    await api.deletePost(user, post.id);
    notify('Request deleted');
    router.back();
  };

  const confirmRemove = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Delete this request and its chats?')) remove();
      return;
    }
    Alert.alert('Delete request?', 'This also removes its chats.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: remove },
    ]);
  };

  const { analysis, author } = post ?? {};
  const canHelp = post && !post.is_mine && post.status !== 'resolved';

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="w-full max-w-xl flex-row items-center gap-2 self-center px-2 py-2">
        <Button variant="ghost" size="icon" onPress={() => router.back()} accessibilityLabel="Back">
          <ButtonIcon as={ArrowLeft} />
        </Button>
        <Text className="flex-1 font-semibold">Request</Text>
        {post?.is_mine && (
          <Button variant="ghost" size="icon" onPress={confirmRemove} accessibilityLabel="Delete request">
            <ButtonIcon as={Trash2} />
          </Button>
        )}
      </View>

      {post === null && (
        <Text className="p-6 text-center text-muted-foreground">This post no longer exists.</Text>
      )}

      {post && author && (
        <>
          <ScrollView contentContainerClassName="w-full max-w-xl self-center gap-5 px-4 pb-8">
            <View className="flex-row items-center gap-3">
              <PersonAvatar person={author} size="md" />
              <View>
                <Text className="font-semibold">
                  {displayName(author)}
                </Text>
                <Text size="xs" className="text-muted-foreground">
                  {author.kind === 'public' ? `Block ${author.block} · ` : 'Anonymous · '}
                  {timeAgo(post.created_at)} · {STATUS_META[post.status].label}
                </Text>
              </View>
            </View>

            {analysis && <Heading size="lg">{analysis.punchline}</Heading>}
            <Text className="leading-relaxed">{post.content}</Text>
            {post.media_url && (
              <Image source={{ uri: post.media_url }} className="h-64 w-full rounded-xl" resizeMode="cover" />
            )}

            {analysis && (
              <View className="gap-3 rounded-xl bg-secondary p-4">
                <Text size="xs" className="font-semibold uppercase text-muted-foreground">
                  AI summary
                </Text>
                <Detail label="Category" value={categoryMeta(analysis.category).label} />
                <Detail label="Urgency" value={URGENCY_META[analysis.urgency].label} />
                {analysis.tools_needed.length > 0 && (
                  <Detail label="Tools needed" value={analysis.tools_needed.join(', ')} />
                )}
              </View>
            )}
          </ScrollView>

          {post.is_mine && post.status !== 'resolved' && (
            <View className="w-full max-w-xl flex-row gap-2 self-center border-t border-border p-4">
              {post.status === 'open' && (
                <Button className="flex-1" variant="outline" onPress={() => setStatus('in_progress')}>
                  <ButtonText>Mark in progress</ButtonText>
                </Button>
              )}
              <Button className="flex-1" variant="brand" onPress={() => setStatus('resolved')}>
                <ButtonIcon as={CheckCircle2} />
                <ButtonText>Mark resolved</ButtonText>
              </Button>
            </View>
          )}
          {post.is_mine && post.status === 'resolved' && (
            <View className="w-full max-w-xl self-center border-t border-border p-4">
              <Button variant="outline" onPress={() => setStatus('open')}>
                <ButtonText>Reopen request</ButtonText>
              </Button>
            </View>
          )}

          {post.is_mine && post.helper_count > 0 && (
            <View className="w-full max-w-xl self-center border-t border-border p-4">
              <Button size="lg" variant="outline" onPress={() => router.push('/chats')}>
                <ButtonIcon as={MessageCircle} />
                <ButtonText>
                  {post.helper_count} {post.helper_count === 1 ? 'neighbour' : 'neighbours'} offered help
                </ButtonText>
              </Button>
            </View>
          )}

          {canHelp && (
            <View className="w-full max-w-xl self-center border-t border-border p-4">
              <Button
                size="lg"
                variant="brand"
                onPress={() => offerHelp(post.id)}
              >
                <ButtonIcon as={HandHelping} />
                <ButtonText>Offer help</ButtonText>
              </Button>
            </View>
          )}
        </>
      )}
    </SafeAreaView>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between gap-4">
      <Text size="sm" className="text-muted-foreground">
        {label}
      </Text>
      <Text size="sm" className="flex-1 text-right font-medium">
        {value}
      </Text>
    </View>
  );
}
