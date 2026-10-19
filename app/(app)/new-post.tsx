import { Button, ButtonIcon, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { KeyboardAvoidingView } from '@/components/ui/keyboard-avoiding-view';
import { Pressable } from '@/components/ui/pressable';
import { SafeAreaView } from '@/components/ui/safe-area-view';
import { ScrollView } from '@/components/ui/scroll-view';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { Textarea, TextareaInput } from '@/components/ui/textarea';
import * as api from '@/lib/api';
import { categoryMeta, URGENCY_META } from '@/lib/post-meta';
import { useSession } from '@/lib/session';
import { palette } from '@/lib/theme';
import { useIsDark } from '@/lib/theme-mode';
import { useNotify } from '@/lib/use-notify';
import type { PostAnalysis } from '@/types/models';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { BellRing, Camera, ImagePlus, Sparkles, VenetianMask, X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Image, Platform, View } from 'react-native';

const MIN_LENGTH = 15;
const MAX_LENGTH = 500;

export default function NewPost() {
  const { user } = useSession();
  const notify = useNotify();
  const colors = palette[useIsDark() ? 'dark' : 'light'];

  const [content, setContent] = useState('');
  const [imageUri, setImageUri] = useState<string>();
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [analysis, setAnalysis] = useState<PostAnalysis>();
  const [matches, setMatches] = useState(0);
  const [analyzing, setAnalyzing] = useState(false);
  const [posting, setPosting] = useState(false);

  const trimmed = content.trim();
  const canPost = trimmed.length >= MIN_LENGTH && !posting;

  // Re-run the AI preview shortly after the user stops typing.
  useEffect(() => {
    if (!user || trimmed.length < MIN_LENGTH) {
      setAnalysis(undefined);
      setAnalyzing(false);
      return;
    }
    let cancelled = false;
    setAnalyzing(true);
    const timer = setTimeout(async () => {
      const result = await api.analyzePost(user, trimmed, isAnonymous);
      const count = await api.countSkillMatches(user, result.category);
      if (cancelled) return;
      setAnalysis(result);
      setMatches(count);
      setAnalyzing(false);
    }, 700);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmed, isAnonymous, user]);

  if (!user) return null;

  const pickImage = async (source: 'camera' | 'library') => {
    if (source === 'camera') {
      const { granted } = await ImagePicker.requestCameraPermissionsAsync();
      if (!granted) {
        notify('Camera access needed', 'Allow camera access in your phone settings to take a photo.');
        return;
      }
    }
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.7,
    };
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
    if (!result.canceled) setImageUri(result.assets[0].uri);
  };

  const submit = async () => {
    if (!canPost) return;
    setPosting(true);
    try {
      const { notified } = await api.createPost(user, {
        content: trimmed,
        media_uri: imageUri,
        is_anonymous: isAnonymous,
      });
      notify(
        'Request posted',
        notified > 0
          ? `${notified} ${notified === 1 ? 'neighbour' : 'neighbours'} with matching skills were alerted.`
          : 'Your request is now on the community feed.'
      );
      router.back();
    } catch (e) {
      notify("Couldn't post", (e as Error).message);
      setPosting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="w-full max-w-xl flex-row items-center gap-2 self-center border-b border-border px-2 py-2">
        <Button variant="ghost" size="icon" onPress={() => router.back()} accessibilityLabel="Close">
          <ButtonIcon as={X} />
        </Button>
        <Text className="flex-1 font-semibold">Ask for help</Text>
        <Button variant="brand" size="sm" onPress={submit} isDisabled={!canPost} className="mr-2">
          {posting && <ButtonSpinner />}
          <ButtonText>Post</ButtonText>
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
          {/* Who it's posted as */}
          <View className="flex-row items-center gap-3">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-secondary">
              {isAnonymous ? (
                <Icon as={VenetianMask} size="sm" className="text-muted-foreground" />
              ) : (
                <Text className="font-semibold">{user.name.charAt(0)}</Text>
              )}
            </View>
            <View>
              <Text size="sm" className="font-semibold">
                {isAnonymous ? 'Anonymous neighbour' : user.name}
              </Text>
              <Text size="xs" className="text-muted-foreground">
                {isAnonymous ? 'Your name and block are hidden' : `Block ${user.block} · Visible to your estate`}
              </Text>
            </View>
          </View>

          {/* Description */}
          <View className="gap-1.5">
            <Textarea className="h-40 rounded-xl">
              <TextareaInput
                value={content}
                onChangeText={(t) => setContent(t.slice(0, MAX_LENGTH))}
                placeholder="What do you need help with? e.g. My kitchen sink is leaking and I don't have a pipe wrench…"
                multiline
                textAlignVertical="top"
                autoFocus
              />
            </Textarea>
            <View className="flex-row justify-between">
              <Text size="xs" className="text-muted-foreground">
                {trimmed.length < MIN_LENGTH
                  ? `At least ${MIN_LENGTH} characters`
                  : 'Add details like when and where'}
              </Text>
              <Text size="xs" className="text-muted-foreground">
                {content.length}/{MAX_LENGTH}
              </Text>
            </View>
          </View>

          {/* Photo */}
          {imageUri ? (
            <View>
              <Image source={{ uri: imageUri }} className="h-48 w-full rounded-xl" resizeMode="cover" />
              <Pressable
                onPress={() => setImageUri(undefined)}
                accessibilityLabel="Remove photo"
                className="absolute right-2 top-2 h-8 w-8 items-center justify-center rounded-full bg-black/60"
              >
                <Icon as={X} size="sm" className="text-white" />
              </Pressable>
            </View>
          ) : (
            <View className="flex-row gap-3">
              {Platform.OS !== 'web' && (
                <Button variant="outline" className="flex-1" onPress={() => pickImage('camera')}>
                  <ButtonIcon as={Camera} />
                  <ButtonText>Take photo</ButtonText>
                </Button>
              )}
              <Button variant="outline" className="flex-1" onPress={() => pickImage('library')}>
                <ButtonIcon as={ImagePlus} />
                <ButtonText>Add photo</ButtonText>
              </Button>
            </View>
          )}

          {/* Anonymous toggle */}
          <View className="flex-row items-center gap-4 rounded-xl border border-border p-4">
            <View className="flex-1 gap-1">
              <Text className="font-semibold">Post anonymously</Text>
              <Text size="sm" className="text-muted-foreground">
                Neighbours see an alias like "Neighbor #402". You can choose to share
                your details later in a private chat.
              </Text>
            </View>
            <Switch
              value={isAnonymous}
              onValueChange={setIsAnonymous}
              trackColor={{ true: colors.brand, false: colors.border }}
              thumbColor="#ffffff"
              accessibilityLabel="Post anonymously"
            />
          </View>

          {/* AI preview */}
          <AiPreview analysis={analysis} analyzing={analyzing} matches={matches} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function AiPreview({
  analysis,
  analyzing,
  matches,
}: {
  analysis?: PostAnalysis;
  analyzing: boolean;
  matches: number;
}) {
  const category = analysis && categoryMeta(analysis.category);
  const urgency = analysis && URGENCY_META[analysis.urgency];

  return (
    <View className="gap-3 rounded-xl bg-secondary p-4">
      <View className="flex-row items-center gap-2">
        <Icon as={Sparkles} size="sm" className="text-brand" />
        <Text size="sm" className="flex-1 font-semibold">
          AI preview
        </Text>
        {analyzing && <Spinner size="small" />}
      </View>

      {!analysis ? (
        <Text size="sm" className="text-muted-foreground">
          Start describing your request and we'll suggest a category, urgency, and
          the alert your neighbours will receive.
        </Text>
      ) : (
        <View className={`gap-3 ${analyzing ? 'opacity-50' : ''}`}>
          <View className="rounded-lg bg-background p-3">
            <Text size="xs" className="mb-1 text-muted-foreground">
              Notification neighbours will see
            </Text>
            <Text className="font-semibold">{analysis.punchline}</Text>
          </View>

          <View className="flex-row flex-wrap gap-2">
            {urgency && (
              <View className={`flex-row items-center gap-1.5 rounded-full px-2.5 py-1 ${urgency.bg}`}>
                <View className={`h-1.5 w-1.5 rounded-full ${urgency.dot}`} />
                <Text size="xs" className={`font-medium ${urgency.text}`}>
                  {urgency.label}
                </Text>
              </View>
            )}
            {category && (
              <View className="flex-row items-center gap-1.5 rounded-full bg-background px-2.5 py-1">
                <Icon as={category.icon} size="2xs" className="text-foreground" />
                <Text size="xs" className="font-medium">
                  {category.label}
                </Text>
              </View>
            )}
            {analysis.tools_needed.map((tool) => (
              <View key={tool} className="rounded-full bg-background px-2.5 py-1">
                <Text size="xs" className="text-muted-foreground">
                  🔧 {tool}
                </Text>
              </View>
            ))}
          </View>

          <View className="flex-row items-center gap-2">
            <Icon as={BellRing} size="xs" className="text-muted-foreground" />
            <Text size="xs" className="flex-1 text-muted-foreground">
              {matches > 0
                ? `${matches} ${matches === 1 ? 'neighbour' : 'neighbours'} with ${category?.label} skills will be alerted`
                : 'No skill matches yet. Your request will still appear on the feed'}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}
