import { Button, ButtonIcon, ButtonText } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Divider } from '@/components/ui/divider';
import { Heading } from '@/components/ui/heading';
import { SafeAreaView } from '@/components/ui/safe-area-view';
import { ScrollView } from '@/components/ui/scroll-view';
import { Text } from '@/components/ui/text';
import * as api from '@/lib/api';
import { useSession } from '@/lib/session';
import { SKILLS, type Estate } from '@/types/models';
import { LogOut } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';

export default function Profile() {
  const { user, signOut } = useSession();
  const [estate, setEstate] = useState<Estate>();

  useEffect(() => {
    if (user) api.getEstate(user.estate_id).then(setEstate);
  }, [user?.estate_id]);

  if (!user) return null;
  const skills = SKILLS.filter((s) => (user.skills as string[]).includes(s.id));

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScrollView contentContainerClassName="w-full max-w-xl self-center gap-5 px-4 pb-10 pt-2">
        <Heading size="xl">Profile</Heading>

        <View className="flex-row items-center gap-4">
          <View className="h-16 w-16 items-center justify-center rounded-full bg-primary">
            <Text size="2xl" className="font-bold text-primary-foreground">
              {user.name.charAt(0)}
            </Text>
          </View>
          <View className="flex-1">
            <Heading size="md">{user.name}</Heading>
            <Text size="sm" className="text-muted-foreground">
              {estate?.name ?? ' '}
            </Text>
          </View>
        </View>

        <Card className="gap-3">
          <Row label="Address" value={`Block ${user.block}, ${user.unit_number}, ${user.street}`} />
          <Divider />
          <Row label="Email" value={user.email} />
          <Divider />
          <Row label="Phone" value={user.phone} />
        </Card>

        <View className="gap-2">
          <Text className="font-semibold">Skills I can offer</Text>
          {skills.length ? (
            <View className="flex-row flex-wrap gap-2">
              {skills.map((s) => (
                <View key={s.id} className="rounded-full bg-secondary px-3 py-1.5">
                  <Text size="sm">{s.label}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text size="sm" className="text-muted-foreground">
              No skills added yet.
            </Text>
          )}
        </View>

        <Text size="xs" className="text-muted-foreground">
          Only you can see these details. Neighbours see them only if you tap "Share My
          Details" in a chat.
        </Text>

        <Button variant="outline" onPress={signOut}>
          <ButtonIcon as={LogOut} />
          <ButtonText>Sign out</ButtonText>
        </Button>
      </ScrollView>
    </SafeAreaView>
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
