import { SkillPicker } from '@/components/form/SkillPicker';
import { TextField } from '@/components/form/TextField';
import { Button, ButtonIcon, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { KeyboardAvoidingView } from '@/components/ui/keyboard-avoiding-view';
import { SafeAreaView } from '@/components/ui/safe-area-view';
import { ScrollView } from '@/components/ui/scroll-view';
import { Text } from '@/components/ui/text';
import * as api from '@/lib/api';
import { useSession } from '@/lib/session';
import { useNotify } from '@/lib/use-notify';
import type { SkillId } from '@/types/models';
import { router } from 'expo-router';
import { Lock, X } from 'lucide-react-native';
import React, { useState } from 'react';
import { Platform, View } from 'react-native';

export default function EditProfile() {
  const { user, setUser } = useSession();
  const notify = useNotify();
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [skills, setSkills] = useState<SkillId[]>(user?.skills ?? []);
  const [phoneError, setPhoneError] = useState<string>();
  const [saving, setSaving] = useState(false);

  if (!user) return null;

  const dirty =
    phone !== user.phone ||
    skills.length !== user.skills.length ||
    skills.some((s) => !user.skills.includes(s));

  const save = async () => {
    if (phone.replace(/\D/g, '').length < 9) {
      setPhoneError('Enter a valid phone number.');
      return;
    }
    setSaving(true);
    try {
      setUser(await api.updatePreferences(user.id, { phone: phone.trim(), skills }));
      notify('Profile updated');
      router.back();
    } catch (e) {
      notify("Couldn't save", (e as Error).message);
      setSaving(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="w-full max-w-xl flex-row items-center gap-2 self-center border-b border-border px-2 py-2">
        <Button variant="ghost" size="icon" onPress={() => router.back()} accessibilityLabel="Close">
          <ButtonIcon as={X} />
        </Button>
        <Text className="flex-1 font-semibold">Edit profile</Text>
        <Button variant="brand" size="sm" onPress={save} isDisabled={!dirty || saving} className="mr-2">
          {saving && <ButtonSpinner />}
          <ButtonText>Save</ButtonText>
        </Button>
      </View>

      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerClassName="w-full max-w-xl self-center gap-6 px-4 py-5 pb-12"
          keyboardShouldPersistTaps="handled"
        >
          {/* Verified details: read-only */}
          <View className="gap-3 rounded-xl bg-secondary p-4">
            <View className="flex-row items-center gap-2">
              <Icon as={Lock} size="xs" className="text-muted-foreground" />
              <Text size="xs" className="font-semibold uppercase tracking-wide text-muted-foreground">
                Verified by management
              </Text>
            </View>
            <View className="gap-0.5">
              <Text className="font-semibold">{user.name}</Text>
              <Text size="sm" className="text-muted-foreground">
                Block {user.block}, {user.unit_number}, {user.street}
              </Text>
              <Text size="sm" className="text-muted-foreground">
                {user.email}
              </Text>
            </View>
            <Text size="xs" className="text-muted-foreground">
              Moved or need to fix your name or address? Contact your management
              office so they can re-verify it.
            </Text>
          </View>

          <TextField
            label="Phone number"
            value={phone}
            onChangeText={(t) => {
              setPhone(t);
              setPhoneError(undefined);
            }}
            error={phoneError}
            helper="Only shared when you tap “Share my details” in a chat."
            keyboardType="phone-pad"
            autoComplete="tel"
          />

          <View className="gap-2">
            <Text className="font-medium">Skills I can offer</Text>
            <Text size="sm" className="text-muted-foreground">
              We'll alert you when a neighbour's request matches one of these.
            </Text>
            <SkillPicker value={skills} onChange={setSkills} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
