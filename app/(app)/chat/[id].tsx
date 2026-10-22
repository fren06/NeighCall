import { MessageBubble } from '@/components/chat/MessageBubble';
import { displayName, PersonAvatar } from '@/components/PersonAvatar';
import {
  AlertDialog,
  AlertDialogBackdrop,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
} from '@/components/ui/alert-dialog';
import { Button, ButtonIcon, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Icon } from '@/components/ui/icon';
import { KeyboardAvoidingView } from '@/components/ui/keyboard-avoiding-view';
import { Menu, MenuItem, MenuItemLabel } from '@/components/ui/menu';
import { Pressable } from '@/components/ui/pressable';
import { SafeAreaView } from '@/components/ui/safe-area-view';
import { Text } from '@/components/ui/text';
import * as api from '@/lib/api';
import { useSession } from '@/lib/session';
import { useNotify } from '@/lib/use-notify';
import type { ChatMessage, ConversationSummary } from '@/types/models';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ArrowLeft,
  EllipsisVertical,
  FileText,
  Flag,
  IdCard,
  SendHorizontal,
  VenetianMask,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Platform, TextInput, View } from 'react-native';

type Dialog = { kind: 'share' } | { kind: 'report-message'; id: string } | { kind: 'report-peer' };

export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useSession();
  const notify = useNotify();
  const [summary, setSummary] = useState<ConversationSummary | null>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user || !id) return;
    try {
      const data = await api.getConversation(user, id);
      setSummary(data.summary);
      setMessages(data.messages);
    } catch {
      setSummary(null);
    }
  }, [user, id]);

  useEffect(() => {
    load();
    return id ? api.subscribeToConversation(id, load) : undefined;
  }, [load, id]);

  if (!user) return null;

  if (summary === null) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-background">
        <Text className="text-muted-foreground">This conversation isn't available.</Text>
        <Button variant="outline" onPress={() => router.back()}>
          <ButtonText>Go back</ButtonText>
        </Button>
      </SafeAreaView>
    );
  }
  if (!summary) return <SafeAreaView className="flex-1 bg-background" />;

  const isRequester = summary.my_role === 'requester';
  const iAmAnonymous = isRequester && summary.is_anonymous_post && !summary.is_identity_revealed;
  const sharedByMe = messages.some((m) => m.type === 'identity_card' && m.from === 'me');
  const openPost = () =>
    router.push({ pathname: '/post/[id]', params: { id: summary.post_id } });

  const menuItems = [
    <MenuItem key="post" textValue="View request" onPress={openPost}>
      <Icon as={FileText} size="sm" className="mr-2 text-foreground" />
      <MenuItemLabel>View request</MenuItemLabel>
    </MenuItem>,
    !sharedByMe && (
      <MenuItem key="share" textValue="Share my details" onPress={() => setDialog({ kind: 'share' })}>
        <Icon as={IdCard} size="sm" className="mr-2 text-foreground" />
        <MenuItemLabel>Share my details</MenuItemLabel>
      </MenuItem>
    ),
    <MenuItem
      key="report"
      textValue="Report user"
      onPress={() => setDialog({ kind: 'report-peer' })}
    >
      <Icon as={Flag} size="sm" className="mr-2 text-destructive" />
      <MenuItemLabel className="text-destructive">Report user</MenuItemLabel>
    </MenuItem>,
  ].filter((item): item is React.JSX.Element => !!item);

  const send = async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    try {
      await api.sendMessage(user, summary.id, text);
      await load(); // don't wait for the realtime ping to show our own message
    } catch (e) {
      setDraft(text);
      notify("Couldn't send", (e as Error).message);
    }
  };

  const confirmDialog = async () => {
    if (!dialog) return;
    setBusy(true);
    try {
      if (dialog.kind === 'share') {
        await api.shareIdentity(user, summary.id);
        await load();
      } else {
        if (dialog.kind === 'report-message') {
          await api.createReport(user.id, 'message', dialog.id, 'Reported from chat');
        } else {
          await api.reportChatPeer(user, summary.id, 'Reported from chat');
        }
        notify('Report sent', 'Estate management will review it.');
      }
    } catch (e) {
      notify('Something went wrong', (e as Error).message);
    } finally {
      setBusy(false);
      setDialog(null);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="w-full max-w-xl flex-row items-center gap-2 self-center border-b border-border px-2 py-2">
        <Button variant="ghost" size="icon" onPress={() => router.back()} accessibilityLabel="Back">
          <ButtonIcon as={ArrowLeft} />
        </Button>
        <PersonAvatar person={summary.peer} />
        <View className="flex-1">
          <Text className="font-semibold" numberOfLines={1}>
            {displayName(summary.peer)}
          </Text>
          <Text size="xs" className="text-muted-foreground" numberOfLines={1}>
            {summary.peer.kind === 'public' ? `Block ${summary.peer.block} · ` : ''}
            {isRequester ? 'Offered to help you' : 'You offered to help'}
          </Text>
        </View>
        <Menu
          placement="bottom right"
          trigger={(triggerProps) => (
            <Pressable {...triggerProps} hitSlop={8} accessibilityLabel="Chat options" className="p-2">
              <Icon as={EllipsisVertical} size="md" className="text-foreground" />
            </Pressable>
          )}
        >
          {menuItems}
        </Menu>
      </View>

      {/* Request this chat is about */}
      <Pressable
        onPress={openPost}
        className="w-full max-w-xl self-center border-b border-border px-4 py-2.5"
      >
        <Text size="xs" className="text-muted-foreground">
          Request
        </Text>
        <Text size="sm" className="font-medium" numberOfLines={1}>
          {summary.post_title}
        </Text>
      </Pressable>

      {/* Privacy banner */}
      {(iAmAnonymous || summary.peer.kind === 'anonymous') && (
        <View className="w-full max-w-xl flex-row items-center gap-3 self-center bg-secondary px-4 py-3">
          <Icon as={VenetianMask} size="md" className="text-muted-foreground" />
          <Text size="sm" className="flex-1 text-muted-foreground">
            {iAmAnonymous
              ? `You're anonymous here. ${displayName(summary.peer).split(' ')[0]} can't see your name or unit until you share them.`
              : "This neighbour is anonymous. They can choose to share their details with you."}
          </Text>
          {iAmAnonymous && (
            <Button size="sm" variant="brand" onPress={() => setDialog({ kind: 'share' })}>
              <ButtonText>Share</ButtonText>
            </Button>
          )}
        </View>
      )}

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <FlatList
          inverted
          data={[...messages].reverse()}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => (
            <MessageBubble
              message={item}
              onLongPress={
                item.from === 'them'
                  ? () => setDialog({ kind: 'report-message', id: item.id })
                  : undefined
              }
            />
          )}
          contentContainerClassName="w-full max-w-xl self-center px-4 py-3"
          keyboardShouldPersistTaps="handled"
        />

        {/* Composer */}
        <View className="w-full max-w-xl flex-row items-end gap-2 self-center border-t border-border px-3 py-2">
          {!sharedByMe && (
            <Button
              variant="ghost"
              size="icon"
              onPress={() => setDialog({ kind: 'share' })}
              accessibilityLabel="Share my details"
            >
              <ButtonIcon as={IdCard} />
            </Button>
          )}
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Message"
            placeholderTextColor="#8a8a8a"
            multiline
            className="max-h-28 min-h-10 flex-1 rounded-2xl border border-border px-4 py-2 text-foreground web:outline-none"
            onSubmitEditing={Platform.OS === 'web' ? send : undefined}
            submitBehavior={Platform.OS === 'web' ? 'submit' : 'newline'}
          />
          <Button
            variant="brand"
            size="icon"
            className="rounded-full"
            onPress={send}
            isDisabled={!draft.trim()}
            accessibilityLabel="Send"
          >
            <ButtonIcon as={SendHorizontal} />
          </Button>
        </View>
      </KeyboardAvoidingView>

      <AlertDialog isOpen={!!dialog} onClose={() => setDialog(null)}>
        <AlertDialogBackdrop />
        <AlertDialogContent className="gap-3">
          <AlertDialogHeader>
            <Heading size="md">
              {dialog?.kind === 'share' ? 'Share your details?' : 'Report this?'}
            </Heading>
          </AlertDialogHeader>
          <AlertDialogBody>
            <Text size="sm" className="text-muted-foreground">
              {dialog?.kind === 'share'
                ? `${displayName(summary.peer)} will see your full name, block and unit number, and phone number. ${
                    isRequester && !summary.is_identity_revealed ? "You'll no longer be anonymous in this chat. " : ''
                  }This can't be undone.`
                : 'Estate management will review it. The other person is not told who reported them.'}
            </Text>
          </AlertDialogBody>
          <AlertDialogFooter className="gap-2">
            <Button variant="outline" onPress={() => setDialog(null)}>
              <ButtonText>Cancel</ButtonText>
            </Button>
            <Button
              variant={dialog?.kind === 'share' ? 'brand' : 'destructive'}
              onPress={confirmDialog}
              isDisabled={busy}
            >
              {busy && <ButtonSpinner />}
              <ButtonText>{dialog?.kind === 'share' ? 'Share details' : 'Report'}</ButtonText>
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SafeAreaView>
  );
}
