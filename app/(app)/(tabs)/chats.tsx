import { Heading } from '@/components/ui/heading';
import { Icon } from '@/components/ui/icon';
import { SafeAreaView } from '@/components/ui/safe-area-view';
import { Text } from '@/components/ui/text';
import { MessageCircle } from 'lucide-react-native';
import React from 'react';
import { View } from 'react-native';

// Placeholder until the chat flow is built.
export default function Chats() {
  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <View className="w-full max-w-xl self-center px-4 pt-2">
        <Heading size="xl">Chats</Heading>
      </View>
      <View className="flex-1 items-center justify-center gap-3 px-8">
        <View className="h-14 w-14 items-center justify-center rounded-full bg-secondary">
          <Icon as={MessageCircle} size="lg" className="text-muted-foreground" />
        </View>
        <Text className="text-center text-muted-foreground">
          No conversations yet. When you offer help on a post, or a neighbour offers to
          help you, the chat shows up here.
        </Text>
      </View>
    </SafeAreaView>
  );
}
