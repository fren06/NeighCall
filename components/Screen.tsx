import { KeyboardAvoidingView } from '@/components/ui/keyboard-avoiding-view';
import { SafeAreaView } from '@/components/ui/safe-area-view';
import { ScrollView } from '@/components/ui/scroll-view';
import React from 'react';
import { Platform } from 'react-native';

/** Safe-area, keyboard-aware, scrollable page with a centred max-width column. */
export function Screen({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerClassName={`grow px-6 py-8 w-full max-w-md self-center ${className}`}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
