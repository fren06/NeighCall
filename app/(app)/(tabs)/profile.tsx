import { TimeField } from '@/components/form/TimeField';
import { Button, ButtonIcon, ButtonText } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Divider } from '@/components/ui/divider';
import { Heading } from '@/components/ui/heading';
import { Icon } from '@/components/ui/icon';
import { Pressable } from '@/components/ui/pressable';
import { SafeAreaView } from '@/components/ui/safe-area-view';
import { ScrollView } from '@/components/ui/scroll-view';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import type { ModeType } from '@/components/ui/gluestack-ui-provider';
import * as api from '@/lib/api';
import { useSession } from '@/lib/session';
import { palette } from '@/lib/theme';
import { useIsDark, useThemeMode } from '@/lib/theme-mode';
import { useNotify } from '@/lib/use-notify';
import { skillLabel, type Estate, type NotificationPrefs } from '@/types/models';
import { router } from 'expo-router';
import { LogOut, Pencil, ShieldCheck } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';

const THEME_OPTIONS: { id: ModeType; label: string }[] = [
  { id: 'system', label: 'System' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
];

export default function Profile() {
  const { user, setUser, signOut } = useSession();
  const { mode, setMode } = useThemeMode();
  const colors = palette[useIsDark() ? 'dark' : 'light'];
  const notify = useNotify();
  const [estate, setEstate] = useState<Estate>();

  useEffect(() => {
    if (user) api.getEstate(user.estate_id).then(setEstate);
  }, [user?.estate_id]);

  if (!user) return null;
  const skills = user.skills.map((id) => ({ id, label: skillLabel(id) }));
  const prefs = user.notifications;

  // Settings toggles apply immediately; roll back if the save fails.
  const savePrefs = async (next: NotificationPrefs) => {
    const previous = user;
    setUser({ ...user, notifications: next });
    try {
      setUser(await api.updatePreferences(user.id, { notifications: next }));
    } catch {
      setUser(previous);
      notify("Couldn't save", 'Please try again.');
    }
  };
  const setQuiet = (changes: Partial<NotificationPrefs['quiet_hours']>) =>
    savePrefs({ ...prefs, quiet_hours: { ...prefs.quiet_hours, ...changes } });

  const switchColors = { trackColor: { true: colors.brand, false: colors.border }, thumbColor: '#ffffff' };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScrollView contentContainerClassName="w-full max-w-xl self-center gap-6 px-4 pb-12 pt-2">
        <Heading size="xl">Profile</Heading>

        {/* Identity */}
        <View className="flex-row items-center gap-4">
          <View className="h-16 w-16 items-center justify-center rounded-full bg-primary">
            <Text size="2xl" className="font-bold text-primary-foreground">
              {user.name.charAt(0)}
            </Text>
          </View>
          <View className="flex-1 gap-0.5">
            <Heading size="md">{user.name}</Heading>
            <Text size="sm" className="text-muted-foreground" numberOfLines={1}>
              {estate?.name ?? ' '}
            </Text>
            <View className="flex-row items-center gap-1">
              <Icon as={ShieldCheck} size="xs" className="text-brand" />
              <Text size="xs" className="font-medium text-brand">
                Verified resident
              </Text>
            </View>
          </View>
        </View>

        {/* Details + skills */}
        <Section
          title="My details"
          action={
            <Button size="sm" variant="outline" onPress={() => router.push('/edit-profile')}>
              <ButtonIcon as={Pencil} />
              <ButtonText>Edit</ButtonText>
            </Button>
          }
        >
          <Card className="gap-3">
            <Row label="Address" value={`Block ${user.block}, ${user.unit_number}, ${user.street}`} />
            <Divider />
            <Row label="Email" value={user.email} />
            <Divider />
            <Row label="Phone" value={user.phone} />
            <Divider />
            <View className="gap-2">
              <Text size="sm" className="text-muted-foreground">
                Skills I can offer
              </Text>
              {skills.length ? (
                <View className="flex-row flex-wrap gap-2">
                  {skills.map((s) => (
                    <View key={s.id} className="rounded-full bg-secondary px-3 py-1">
                      <Text size="sm">{s.label}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text size="sm">None yet. Add skills so neighbours can find you.</Text>
              )}
            </View>
          </Card>
        </Section>

        {/* Notifications */}
        <Section title="Notifications">
          <Card className="gap-4">
            <ToggleRow
              title="Skill-match alerts"
              description="Get notified when a neighbour needs help with one of your skills."
              value={prefs.skill_matches}
              onChange={(v) => savePrefs({ ...prefs, skill_matches: v })}
              switchProps={switchColors}
            />
            <Divider />
            <ToggleRow
              title="Quiet hours"
              description="Mute alerts overnight. Important notices from management still come through."
              value={prefs.quiet_hours.enabled}
              onChange={(v) => setQuiet({ enabled: v })}
              switchProps={switchColors}
            />
            {prefs.quiet_hours.enabled && (
              <View className="flex-row gap-3">
                <TimeField
                  label="From"
                  value={prefs.quiet_hours.start}
                  onChange={(start) => setQuiet({ start })}
                />
                <TimeField
                  label="To"
                  value={prefs.quiet_hours.end}
                  onChange={(end) => setQuiet({ end })}
                />
              </View>
            )}
          </Card>
        </Section>

        {/* Appearance */}
        <Section title="Appearance">
          <View className="flex-row rounded-xl bg-secondary p-1">
            {THEME_OPTIONS.map(({ id, label }) => {
              const active = mode === id;
              return (
                <Pressable
                  key={id}
                  onPress={() => setMode(id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  className={`flex-1 items-center rounded-lg py-2 ${active ? 'bg-background shadow-sm' : ''}`}
                >
                  <Text size="sm" className={active ? 'font-semibold' : 'text-muted-foreground'}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Section>

        <Text size="xs" className="text-muted-foreground">
          Your details are private. Neighbours only see them if you tap "Share my
          details" in a chat.
        </Text>

        <Button variant="outline" onPress={signOut}>
          <ButtonIcon as={LogOut} />
          <ButtonText>Sign out</ButtonText>
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <View className="gap-2">
      <View className="min-h-8 flex-row items-center justify-between">
        <Text size="sm" className="font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </Text>
        {action}
      </View>
      {children}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between gap-4">
      <Text size="sm" className="text-muted-foreground">
        {label}
      </Text>
      <Text size="sm" className="flex-1 text-right font-medium">
        {value}
      </Text>
    </View>
  );
}

function ToggleRow({
  title,
  description,
  value,
  onChange,
  switchProps,
}: {
  title: string;
  description: string;
  value: boolean;
  onChange: (value: boolean) => void;
  switchProps: React.ComponentProps<typeof Switch>;
}) {
  return (
    <View className="flex-row items-center gap-4">
      <View className="flex-1 gap-0.5">
        <Text className="font-medium">{title}</Text>
        <Text size="sm" className="text-muted-foreground">
          {description}
        </Text>
      </View>
      <Switch value={value} onValueChange={onChange} accessibilityLabel={title} {...switchProps} />
    </View>
  );
}
