import { Button, ButtonText } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input, InputField } from '@/components/ui/input';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { SKILLS } from '@/types/models';
import { Check, Plus, X } from 'lucide-react-native';
import React, { useState } from 'react';
import { View } from 'react-native';

const MAX_CUSTOM_LENGTH = 30;
const KNOWN_IDS: string[] = SKILLS.map((s) => s.id);

/**
 * Toggleable chips for the skill tags used in AI matching, plus an "Other"
 * option for anything not on the list. Custom skills are stored as the text
 * the user typed and can be removed by tapping their chip.
 */
export function SkillPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (skills: string[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');

  const custom = value.filter((s) => !KNOWN_IDS.includes(s));

  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((s) => s !== id) : [...value, id]);

  const addCustom = () => {
    const skill = draft.trim().slice(0, MAX_CUSTOM_LENGTH);
    if (!skill) return;
    const exists = value.some((s) => s.toLowerCase() === skill.toLowerCase());
    if (!exists) onChange([...value, skill]);
    setDraft('');
  };

  return (
    <View className="gap-3">
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

        {custom.map((skill) => (
          <Pressable
            key={skill}
            onPress={() => toggle(skill)}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${skill}`}
            className="flex-row items-center gap-1.5 rounded-full border border-primary bg-primary px-3 py-1.5"
          >
            <Text size="sm" className="text-primary-foreground">
              {skill}
            </Text>
            <Icon as={X} size="xs" className="text-primary-foreground" />
          </Pressable>
        ))}

        <Pressable
          onPress={() => setAdding((a) => !a)}
          accessibilityRole="button"
          accessibilityState={{ expanded: adding }}
          className={`flex-row items-center gap-1.5 rounded-full border border-dashed px-3 py-1.5 ${
            adding ? 'border-primary' : 'border-border'
          }`}
        >
          <Icon as={Plus} size="xs" className="text-foreground" />
          <Text size="sm">Other</Text>
        </Pressable>
      </View>

      {adding && (
        <View className="flex-row items-center gap-2">
          <Input className="flex-1">
            <InputField
              value={draft}
              onChangeText={(t) => setDraft(t.slice(0, MAX_CUSTOM_LENGTH))}
              onSubmitEditing={addCustom}
              placeholder="e.g. Gardening, Tailoring"
              returnKeyType="done"
              autoFocus
            />
          </Input>
          <Button size="sm" variant="brand" isDisabled={!draft.trim()} onPress={addCustom}>
            <ButtonText>Add</ButtonText>
          </Button>
        </View>
      )}
    </View>
  );
}
