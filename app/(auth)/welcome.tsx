import { Screen } from '@/components/Screen';
import { Button, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { router } from 'expo-router';
import { HandHeart } from 'lucide-react-native';
import React from 'react';
import { View } from 'react-native';

export default function Welcome() {
  return (
    <Screen className="justify-between">
      <VStack className="flex-1 items-center justify-center gap-4">
        <View className="h-20 w-20 items-center justify-center rounded-3xl bg-primary">
          <Icon as={HandHeart} className="h-10 w-10 text-primary-foreground" />
        </View>
        <Heading size="2xl">NeighCall</Heading>
        <Text className="text-center text-muted-foreground">
          Ask for help, lend a hand, and stay in the loop with the people who live
          next door.
        </Text>
      </VStack>

      <VStack className="gap-3">
        <Button size="lg" onPress={() => router.push('/sign-up')}>
          <ButtonText>Create an account</ButtonText>
        </Button>
        <Button size="lg" variant="outline" onPress={() => router.push('/sign-in')}>
          <ButtonText>I already have an account</ButtonText>
        </Button>
        <Text size="xs" className="mt-2 text-center text-muted-foreground">
          Every account is verified by your estate management before it can post or
          chat.
        </Text>
      </VStack>
    </Screen>
  );
}
