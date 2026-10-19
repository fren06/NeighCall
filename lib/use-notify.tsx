import { Toast, ToastDescription, ToastTitle, useToast } from '@/components/ui/toast';
import React, { useCallback } from 'react';

/** Shows a short toast message at the top of the screen. */
export function useNotify() {
  const toast = useToast();
  return useCallback(
    (title: string, description?: string) =>
      toast.show({
        placement: 'top',
        duration: 3000,
        render: ({ id }) => (
          <Toast nativeID={`toast-${id}`} action="muted" variant="solid">
            <ToastTitle>{title}</ToastTitle>
            {description && <ToastDescription>{description}</ToastDescription>}
          </Toast>
        ),
      }),
    [toast]
  );
}
