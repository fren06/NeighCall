import { FilterChips } from '@/components/management/Chips';
import { TextField } from '@/components/form/TextField';
import { Button, ButtonIcon, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { KeyboardAvoidingView } from '@/components/ui/keyboard-avoiding-view';
import { SafeAreaView } from '@/components/ui/safe-area-view';
import { ScrollView } from '@/components/ui/scroll-view';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { Textarea, TextareaInput } from '@/components/ui/textarea';
import * as api from '@/lib/api';
import { useSession } from '@/lib/session';
import { useNotify } from '@/lib/use-notify';
import { router } from 'expo-router';
import { X } from 'lucide-react-native';
import React, { useState } from 'react';
import { Platform, View } from 'react-native';

const PIN_OPTIONS = [
  { id: '1', label: '1 day' },
  { id: '3', label: '3 days' },
  { id: '7', label: '1 week' },
  { id: '14', label: '2 weeks' },
];

const MAX_BODY = 600;

export default function ComposeBulletin() {
  const { user } = useSession();
  const notify = useNotify();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [important, setImportant] = useState(false);
  const [pin, setPin] = useState('3');
  const [sending, setSending] = useState(false);

  if (!user) return null;
  const canSend = title.trim().length > 0 && body.trim().length > 0 && !sending;

  const send = async () => {
    setSending(true);
    try {
      const { notified, held_back } = await api.publishBulletin(user, {
        title,
        body,
        is_high_priority: important,
        pin_days: Number(pin),
      });
      notify(
        'Bulletin published',
        `${notified} resident${notified === 1 ? '' : 's'} notified` +
          (held_back ? `, ${held_back} held until quiet hours end.` : '.')
      );
      router.back();
    } catch (e) {
      notify("Couldn't publish", (e as Error).message);
      setSending(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="w-full max-w-xl flex-row items-center gap-2 self-center border-b border-border px-2 py-2">
        <Button variant="ghost" size="icon" onPress={() => router.back()} accessibilityLabel="Close">
          <ButtonIcon as={X} />
        </Button>
        <Text className="flex-1 font-semibold">New bulletin</Text>
        <Button variant="brand" size="sm" onPress={send} isDisabled={!canSend} className="mr-2">
          {sending && <ButtonSpinner />}
          <ButtonText>Publish</ButtonText>
        </Button>
      </View>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerClassName="w-full max-w-xl self-center gap-5 px-4 py-4 pb-10"
          keyboardShouldPersistTaps="handled"
        >
          <TextField
            label="Title"
            value={title}
            onChangeText={(t) => setTitle(t.slice(0, 80))}
            placeholder="e.g. Water maintenance on Thursday"
            autoFocus
          />

          <View className="gap-1.5">
            <Text size="sm" className="font-medium">
              Message
            </Text>
            <Textarea className="h-36 rounded-xl">
              <TextareaInput
                value={body}
                onChangeText={(t) => setBody(t.slice(0, MAX_BODY))}
                placeholder="What do residents need to know?"
                multiline
                textAlignVertical="top"
              />
            </Textarea>
            <Text size="xs" className="self-end text-muted-foreground">
              {body.length}/{MAX_BODY}
            </Text>
          </View>

          <View className="gap-2">
            <Text size="sm" className="font-medium">
              Keep pinned for
            </Text>
            <FilterChips options={PIN_OPTIONS} value={pin} onChange={setPin} />
          </View>

          <View className="flex-row items-center gap-3 rounded-xl border border-border bg-card p-4">
            <View className="flex-1 gap-0.5">
              <Text className="font-semibold">Mark as important</Text>
              <Text size="xs" className="text-muted-foreground">
                Sends a high-priority push that bypasses residents' quiet hours. Use for outages,
                security and safety notices.
              </Text>
            </View>
            <Switch value={important} onValueChange={setImportant} accessibilityLabel="Mark as important" />
          </View>

          <Text size="xs" className="text-muted-foreground">
            Every approved resident gets a push notification. Ordinary notices are held back for
            anyone currently in quiet hours.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
