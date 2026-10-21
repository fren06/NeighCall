import { Button, ButtonIcon, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Icon } from '@/components/ui/icon';
import { Pressable } from '@/components/ui/pressable';
import { SafeAreaView } from '@/components/ui/safe-area-view';
import { Text } from '@/components/ui/text';
import * as api from '@/lib/api';
import { useSession } from '@/lib/session';
import type { Estate } from '@/types/models';
import { router, useFocusEffect, type Href } from 'expo-router';
import { Ban, Flag, LogOut, type LucideIcon, UserCheck, UserPlus, Users } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';

function StatCard({
  icon,
  value,
  label,
  hint,
  highlight,
  href,
}: {
  icon: LucideIcon;
  value?: number;
  label: string;
  hint?: string;
  highlight?: boolean;
  href: Href;
}) {
  return (
    <Pressable
      onPress={() => router.navigate(href)}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value ?? 'loading'}`}
      className="min-w-[46%] flex-1 gap-2 rounded-xl border border-border bg-card p-4"
    >
      <View
        className={`h-9 w-9 items-center justify-center rounded-full ${
          highlight ? 'bg-brand' : 'bg-secondary'
        }`}
      >
        <Icon as={icon} size="sm" className={highlight ? 'text-brand-foreground' : 'text-foreground'} />
      </View>
      <Text className="text-3xl font-bold">{value ?? '–'}</Text>
      <View>
        <Text size="sm" className="font-medium">
          {label}
        </Text>
        {hint ? (
          <Text size="xs" className="text-muted-foreground">
            {hint}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export default function Dashboard() {
  const { user, signOut } = useSession();
  const [stats, setStats] = useState<api.AdminOverview>();
  const [estate, setEstate] = useState<Estate>();
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const [s, e] = await Promise.all([api.getAdminOverview(user), api.getEstate(user.estate_id)]);
    setStats(s);
    setEstate(e);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!user) return null;

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScrollView
        contentContainerClassName="w-full max-w-xl self-center gap-5 px-4 pb-10 pt-4"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
      >
        <View className="gap-1">
          <Text size="sm" className="text-muted-foreground">
            {estate?.name ?? 'Estate admin'}
          </Text>
          <Heading size="2xl">Hello, {user.name.split(' ')[0]}</Heading>
        </View>

        <View className="flex-row flex-wrap gap-3">
          <StatCard
            icon={UserCheck}
            value={stats?.pending}
            label="Awaiting approval"
            hint="Verify address, then approve"
            highlight={!!stats?.pending}
            href={'/users' as Href}
          />
          <StatCard
            icon={Flag}
            value={stats?.open_reports}
            label="Open reports"
            hint={
              stats?.investigating_reports
                ? `${stats.investigating_reports} under investigation`
                : 'Posts, chats and users'
            }
            highlight={!!stats?.open_reports}
            href={'/reports' as Href}
          />
          <StatCard
            icon={Users}
            value={stats?.approved}
            label="Approved residents"
            hint="With full access"
            href={'/users' as Href}
          />
          <StatCard
            icon={Ban}
            value={stats?.restricted}
            label="Rejected / suspended"
            hint="No access"
            href={'/users' as Href}
          />
        </View>

        <View className="gap-3">
          <Text className="font-semibold">Quick actions</Text>
          <Button variant="brand" onPress={() => router.push('/user-form' as Href)}>
            <ButtonIcon as={UserPlus} />
            <ButtonText>Add a resident</ButtonText>
          </Button>
        </View>

        <View className="gap-1 rounded-xl bg-secondary p-4">
          <Text size="sm" className="font-semibold">
            Signed in as {user.name}
          </Text>
          <Text size="xs" className="text-muted-foreground">
            {user.email} · Admin
          </Text>
        </View>

        <Button variant="outline" onPress={signOut}>
          <ButtonIcon as={LogOut} />
          <ButtonText>Sign out</ButtonText>
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}
