import { Icon } from '@/components/ui/icon';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { timeAgo } from '@/lib/post-meta';
import type { Bulletin } from '@/types/models';
import { Megaphone } from 'lucide-react-native';
import React, { useState } from 'react';
import { View } from 'react-native';

/** Official notice from estate management, pinned above the feed. Tap to expand. */
export function BulletinBanner({
  bulletin,
  className = '',
  onPress,
}: {
  bulletin: Bulletin;
  className?: string;
  /** Called on tap as well as expanding, e.g. to pause the carousel. */
  onPress?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Pressable
      onPress={() => {
        setExpanded((e) => !e);
        onPress?.();
      }}
      accessibilityRole="button"
      accessibilityHint={expanded ? 'Collapse notice' : 'Expand notice'}
      className={`gap-2 rounded-xl bg-primary p-4 ${className}`}
    >
      <View className="flex-row items-center gap-2">
        <Icon as={Megaphone} size="sm" className="text-primary-foreground" />
        <Text size="xs" className="flex-1 font-semibold uppercase tracking-wide text-primary-foreground/70">
          Management{bulletin.is_high_priority ? ' · Important' : ''}
        </Text>
        <Text size="xs" className="text-primary-foreground/60">
          {timeAgo(bulletin.created_at)}
        </Text>
      </View>
      <Text className="font-semibold text-primary-foreground">{bulletin.title}</Text>
      <Text
        size="sm"
        numberOfLines={expanded ? undefined : 2}
        className="text-primary-foreground/80"
      >
        {bulletin.body}
      </Text>
    </Pressable>
  );
}
