import {
  FormControl,
  FormControlError,
  FormControlErrorText,
  FormControlLabel,
  FormControlLabelText,
} from '@/components/ui/form-control';
import {
  Select,
  SelectBackdrop,
  SelectContent,
  SelectDragIndicator,
  SelectDragIndicatorWrapper,
  SelectIcon,
  SelectInput,
  SelectItem,
  SelectPortal,
  SelectTrigger,
} from '@/components/ui/select';
import type { Estate } from '@/types/models';
import { ChevronDown } from 'lucide-react-native';
import React from 'react';

export function EstateSelect({
  estates,
  value,
  onChange,
  error,
}: {
  estates: Estate[];
  value: string;
  onChange: (estateId: string) => void;
  error?: string;
}) {
  const selected = estates.find((e) => e.id === value);
  return (
    <FormControl isInvalid={!!error}>
      <FormControlLabel>
        <FormControlLabelText>Estate</FormControlLabelText>
      </FormControlLabel>
      <Select
        selectedValue={value || null}
        initialLabel={selected?.name}
        onValueChange={onChange}
      >
        <SelectTrigger>
          <SelectInput placeholder="Select your estate" className="flex-1" />
          <SelectIcon as={ChevronDown} className="mr-3" />
        </SelectTrigger>
        <SelectPortal>
          <SelectBackdrop />
          <SelectContent>
            <SelectDragIndicatorWrapper>
              <SelectDragIndicator />
            </SelectDragIndicatorWrapper>
            {estates.map((e) => (
              <SelectItem key={e.id} value={e.id} label={`${e.name} — ${e.area}`} />
            ))}
          </SelectContent>
        </SelectPortal>
      </Select>
      {error && (
        <FormControlError>
          <FormControlErrorText>{error}</FormControlErrorText>
        </FormControlError>
      )}
    </FormControl>
  );
}
