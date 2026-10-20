import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import React from 'react';
import { ScrollView, View } from 'react-native';

export interface FilterOption<T extends string> {
  id: T;
  label: string;
  count?: number;
}

/** Horizontally scrolling filter pills with optional counts. */
export function FilterChips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: FilterOption<T>[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
      {options.map((o) => {
        const active = o.id === value;
        return (
          <Pressable
            key={o.id}
            onPress={() => onChange(o.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            className={`rounded-full border px-3.5 py-1.5 ${
              active ? 'border-brand bg-brand' : 'border-border bg-background'
            }`}
          >
            <Text
              size="sm"
              className={`font-medium ${active ? 'text-brand-foreground' : 'text-foreground'}`}
            >
              {o.label}
              {o.count !== undefined ? ` · ${o.count}` : ''}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const TONES = {
  neutral: { box: 'bg-secondary', text: 'text-muted-foreground' },
  good: { box: 'bg-emerald-500/15', text: 'text-emerald-700 dark:text-emerald-400' },
  warn: { box: 'bg-amber-500/15', text: 'text-amber-700 dark:text-amber-400' },
  bad: { box: 'bg-red-500/10', text: 'text-red-600 dark:text-red-400' },
} as const;

/** Small status label. */
export function Pill({ label, tone = 'neutral' }: { label: string; tone?: keyof typeof TONES }) {
  const t = TONES[tone];
  return (
    <View className={`self-start rounded-full px-2.5 py-0.5 ${t.box}`}>
      <Text size="xs" className={`font-semibold ${t.text}`}>
        {label}
      </Text>
    </View>
  );
}
