import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Ban } from 'lucide-react-native';
import React from 'react';
import { View } from 'react-native';

/** Shown to a suspended resident: what happened and what they can still do. */
export function SuspendedNotice({ note }: { note?: string | null }) {
  return (
    <View
      accessibilityRole="alert"
      className="flex-row gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4"
    >
      <Icon as={Ban} size="md" className="mt-0.5 text-destructive" />
      <View className="flex-1 gap-1">
        <Text className="font-semibold text-destructive">Your account is suspended</Text>
        {note ? <Text size="sm">{note}</Text> : null}
        <Text size="sm" className="text-muted-foreground">
          You can still read the feed, but you can't post, offer help or send messages. Contact
          your estate management office for help.
        </Text>
      </View>
    </View>
  );
}
