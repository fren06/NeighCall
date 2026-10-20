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
import { ArrowLeft, HandHelping, MessageCircle } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Image, View } from 'react-native';

export default function PostDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useSession();
  const offerHelp = useOfferHelp();
  const [post, setPost] = useState<FeedPost | null>();

  useEffect(() => {
    if (user && id) api.getPost(user, id).then((p) => setPost(p ?? null));
  }, [user, id]);

  const { analysis, author } = post ?? {};
  const canHelp = post && !post.is_mine && post.status !== 'resolved';

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="w-full max-w-xl flex-row items-center gap-2 self-center px-2 py-2">
        <Button variant="ghost" size="icon" onPress={() => router.back()} accessibilityLabel="Back">
          <ButtonIcon as={ArrowLeft} />
        </Button>
        <Text className="font-semibold">Request</Text>
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
