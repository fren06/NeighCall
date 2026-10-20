import { displayName, PersonAvatar } from '@/components/PersonAvatar';
import { Heading } from '@/components/ui/heading';
import { Icon } from '@/components/ui/icon';
import { Pressable } from '@/components/ui/pressable';
import { SafeAreaView } from '@/components/ui/safe-area-view';
import { Text } from '@/components/ui/text';
import * as api from '@/lib/api';
import { timeAgo } from '@/lib/post-meta';
import { useSession } from '@/lib/session';
import type { ChatMessage, ConversationSummary } from '@/types/models';
import { router, useFocusEffect } from 'expo-router';
import { MessageCircle } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { SectionList, View } from 'react-native';

function preview(message?: ChatMessage) {
  if (!message) return '';
  const prefix = message.from === 'me' ? 'You: ' : '';
  if (message.type === 'identity_card') {
    return message.from === 'me' ? 'You shared your details' : 'Shared their contact details';
  }
  return prefix + (message.text ?? '');
}

export default function Chats() {
  const { user } = useSession();
  const [conversations, setConversations] = useState<ConversationSummary[]>();

  useFocusEffect(
    useCallback(() => {
      if (user) api.getConversations(user).then(setConversations);
    }, [user])
  );

  const sections = [
    {
      title: 'My requests',
      data: conversations?.filter((c) => c.my_role === 'requester') ?? [],
    },
    {
      title: 'Helping others',
      data: conversations?.filter((c) => c.my_role === 'helper') ?? [],
    },
  ].filter((s) => s.data.length > 0);

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <SectionList
        sections={sections}
        keyExtractor={(c) => c.id}
        stickySectionHeadersEnabled={false}
        contentContainerClassName="w-full max-w-xl self-center pb-10"
        ListHeaderComponent={
          <View className="px-4 pb-2 pt-2">
            <Heading size="xl">Chats</Heading>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <Text size="xs" className="px-4 pb-1 pt-4 font-semibold uppercase tracking-wide text-muted-foreground">
            {section.title}
          </Text>
        )}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: '/chat/[id]', params: { id: item.id } })}
            className="flex-row items-center gap-3 px-4 py-3 data-[active=true]:bg-secondary"
          >
            <PersonAvatar person={item.peer} size="lg" />
            <View className="flex-1 gap-0.5">
              <View className="flex-row items-center gap-2">
                <Text className="flex-1 font-semibold" numberOfLines={1}>
                  {displayName(item.peer)}
                </Text>
                <Text size="xs" className="text-muted-foreground">
                  {timeAgo(item.updated_at)}
                </Text>
              </View>
              <Text size="xs" className="text-muted-foreground" numberOfLines={1}>
                {item.post_title}
              </Text>
              <Text size="sm" numberOfLines={1}>
                {preview(item.last_message)}
              </Text>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          conversations ? (
            <View className="items-center gap-3 px-8 py-20">
              <View className="h-14 w-14 items-center justify-center rounded-full bg-secondary">
                <Icon as={MessageCircle} size="lg" className="text-muted-foreground" />
              </View>
              <Text className="text-center text-muted-foreground">
                No conversations yet. Tap "Offer help" on a request, or wait for a
                neighbour to offer help on yours.
              </Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}
