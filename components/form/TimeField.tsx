import {
  DateTimePicker,
  DateTimePickerIcon,
  DateTimePickerInput,
  DateTimePickerTrigger,
} from '@/components/ui/date-time-picker';
import { Text } from '@/components/ui/text';
import { Clock } from 'lucide-react-native';
import React from 'react';
import { View } from 'react-native';

const pad = (n: number) => n.toString().padStart(2, '0');

/** "HH:mm" → Date today at that time. */
function toDate(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

/** Time-of-day picker that reads and writes 24h "HH:mm" strings. */
export function TimeField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (hhmm: string) => void;
  disabled?: boolean;
}) {
  return (
    <View className="flex-1 gap-1.5">
      <Text size="xs" className="text-muted-foreground">
        {label}
      </Text>
      <DateTimePicker
        mode="time"
        format="HH:mm"
        is24Hour
        value={toDate(value)}
        disabled={disabled}
        onChange={(d) => d && onChange(`${pad(d.getHours())}:${pad(d.getMinutes())}`)}
      >
        <DateTimePickerTrigger>
          <DateTimePickerInput />
          <DateTimePickerIcon as={Clock} />
        </DateTimePickerTrigger>
      </DateTimePicker>
    </View>
  );
}
