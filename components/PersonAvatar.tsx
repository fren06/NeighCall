import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import type { AuthorDisplay } from '@/types/models';
import { VenetianMask } from 'lucide-react-native';
import React from 'react';
import { View } from 'react-native';

const SIZES = {
  sm: { box: 'h-9 w-9', text: 'sm' as const },
  md: { box: 'h-10 w-10', text: 'md' as const },
  lg: { box: 'h-12 w-12', text: 'lg' as const },
};

/** Initial for a named person, mask icon for an anonymous one. */
export function PersonAvatar({
  person,
  size = 'sm',
}: {
  person: AuthorDisplay;
  size?: keyof typeof SIZES;
}) {
  const s = SIZES[size];
  return (
    <View className={`${s.box} items-center justify-center rounded-full bg-secondary`}>
      {person.kind === 'anonymous' ? (
        <Icon as={VenetianMask} size="sm" className="text-muted-foreground" />
      ) : (
        <Text size={s.text} className="font-semibold">
          {person.name.charAt(0)}
        </Text>
      )}
    </View>
  );
}

export const displayName = (person: AuthorDisplay) =>
  person.kind === 'anonymous' ? person.alias : person.name;
