import { Button, ButtonIcon, ButtonText } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import type { ChatMessage, IdentityCard } from '@/types/models';
import { format } from 'date-fns';
import { Phone, ShieldCheck } from 'lucide-react-native';
import React from 'react';
import { Linking, Pressable, View } from 'react-native';

type Props = {
  message: ChatMessage;
  onLongPress?: () => void;
};

export function MessageBubble({ message, onLongPress }: Props) {
  if (message.type === 'system') {
    return (
      <View className="my-2 items-center px-6">
        <Text size="xs" className="text-center text-muted-foreground">
          {message.text}
        </Text>
      </View>
    );
  }

  const mine = message.from === 'me';
  const time = format(new Date(message.created_at), 'h:mm a');

  if (message.type === 'identity_card' && message.identity_card) {
    return (
      <View className={`my-1 max-w-[85%] ${mine ? 'self-end' : 'self-start'}`}>
        <IdentityCardView card={message.identity_card} mine={mine} />
        <Text size="xs" className={`mt-1 text-muted-foreground ${mine ? 'text-right' : ''}`}>
          {time}
        </Text>
      </View>
    );
  }

  return (
    <Pressable
      onLongPress={onLongPress}
      delayLongPress={400}
      className={`my-0.5 max-w-[80%] ${mine ? 'self-end' : 'self-start'}`}
    >
      <View
        className={`rounded-2xl px-3.5 py-2 ${
          mine ? 'rounded-br-md bg-primary' : 'rounded-bl-md bg-secondary'
        }`}
      >
        <Text className={mine ? 'text-primary-foreground' : 'text-foreground'}>{message.text}</Text>
      </View>
      <Text size="xs" className={`mt-0.5 text-muted-foreground ${mine ? 'text-right' : ''}`}>
        {time}
      </Text>
    </Pressable>
  );
}

function IdentityCardView({ card, mine }: { card: IdentityCard; mine: boolean }) {
  return (
    <View className="gap-3 rounded-2xl border border-brand/40 bg-card p-4">
      <View className="flex-row items-center gap-2">
        <Icon as={ShieldCheck} size="sm" className="text-brand" />
        <Text size="xs" className="font-semibold uppercase tracking-wide text-brand">
          Verified resident
        </Text>
      </View>
      <View className="gap-0.5">
        <Text className="text-lg font-bold">{card.name}</Text>
        <Text size="sm" className="text-muted-foreground">
          Block {card.block}, Unit {card.unit_number}
        </Text>
        <Text size="sm" className="text-muted-foreground">
          {card.phone}
        </Text>
      </View>
      {!mine && (
        <Button
          size="sm"
          variant="outline"
          onPress={() => Linking.openURL(`tel:${card.phone.replace(/[^\d+]/g, '')}`)}
        >
          <ButtonIcon as={Phone} />
          <ButtonText>Call</ButtonText>
        </Button>
      )}
    </View>
  );
}
