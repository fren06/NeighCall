import { Icon } from '@/components/ui/icon';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { SKILLS, type SkillId } from '@/types/models';
import { Check } from 'lucide-react-native';
import React from 'react';
import { View } from 'react-native';

/** Toggleable chips for the skill tags used in AI matching. */
export function SkillPicker({
  value,
  onChange,
}: {
  value: SkillId[];
  onChange: (skills: SkillId[]) => void;
}) {
  const toggle = (id: SkillId) =>
    onChange(value.includes(id) ? value.filter((s) => s !== id) : [...value, id]);

  return (
    <View className="flex-row flex-wrap gap-2">
      {SKILLS.map(({ id, label }) => {
        const selected = value.includes(id);
        return (
          <Pressable
            key={id}
            onPress={() => toggle(id)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selected }}
            className={`flex-row items-center gap-1.5 rounded-full border px-3 py-1.5 ${
              selected ? 'border-primary bg-primary' : 'border-border bg-transparent'
            }`}
          >
            {selected && <Icon as={Check} size="xs" className="text-primary-foreground" />}
            <Text
              size="sm"
              className={selected ? 'text-primary-foreground' : 'text-foreground'}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
