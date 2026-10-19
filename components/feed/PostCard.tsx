import { Button, ButtonIcon, ButtonText } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Menu, MenuItem, MenuItemLabel } from '@/components/ui/menu';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { categoryMeta, STATUS_META, timeAgo, URGENCY_META } from '@/lib/post-meta';
import type { FeedPost } from '@/types/models';
import { EllipsisVertical, Flag, HandHelping, Sparkles, VenetianMask } from 'lucide-react-native';
import React from 'react';
import { Image, View } from 'react-native';

type Props = {
  post: FeedPost;
  /** Post category is one of the viewer's skills. */
  matchesSkills: boolean;
  onPress: () => void;
  onOfferHelp: () => void;
  onReport: () => void;
};

export function PostCard({ post, matchesSkills, onPress, onOfferHelp, onReport }: Props) {
  const { analysis, author } = post;
  const urgency = analysis && URGENCY_META[analysis.urgency];
  const category = analysis && categoryMeta(analysis.category);
  const status = STATUS_META[post.status];
  const canHelp = !post.is_mine && post.status !== 'resolved';

  return (
    <Pressable
      onPress={onPress}
      className={`gap-3 rounded-xl border bg-card p-4 ${
        matchesSkills && canHelp ? 'border-brand/50' : 'border-border'
      }`}
    >
      {/* Author row */}
      <View className="flex-row items-center gap-3">
        <View className="h-9 w-9 items-center justify-center rounded-full bg-secondary">
          {author.kind === 'anonymous' ? (
            <Icon as={VenetianMask} size="sm" className="text-muted-foreground" />
          ) : (
            <Text size="sm" className="font-semibold">
              {author.name.charAt(0)}
            </Text>
          )}
        </View>
        <View className="flex-1">
          <Text size="sm" className="font-semibold" numberOfLines={1}>
            {author.kind === 'anonymous' ? author.alias : author.name}
            {post.is_mine && <Text size="sm" className="font-normal text-muted-foreground"> (you)</Text>}
          </Text>
          <Text size="xs" className="text-muted-foreground">
            {author.kind === 'public' ? `Block ${author.block} · ` : 'Anonymous · '}
            {timeAgo(post.created_at)}
          </Text>
        </View>
        {!post.is_mine && (
          <Menu
            placement="bottom right"
            trigger={(triggerProps) => (
              <Pressable
                {...triggerProps}
                hitSlop={8}
                accessibilityLabel="Post options"
                className="rounded-full p-1"
              >
                <Icon as={EllipsisVertical} size="sm" className="text-muted-foreground" />
              </Pressable>
            )}
          >
            <MenuItem key="report" textValue="Report post" onPress={onReport}>
              <Icon as={Flag} size="sm" className="mr-2 text-destructive" />
              <MenuItemLabel className="text-destructive">Report post</MenuItemLabel>
            </MenuItem>
          </Menu>
        )}
      </View>

      {/* Badges */}
      {analysis && urgency && category && (
        <View className="flex-row flex-wrap gap-2">
          <View className={`flex-row items-center gap-1.5 rounded-full px-2.5 py-1 ${urgency.bg}`}>
            <View className={`h-1.5 w-1.5 rounded-full ${urgency.dot}`} />
            <Text size="xs" className={`font-medium ${urgency.text}`}>
              {urgency.label}
            </Text>
          </View>
          <View className="flex-row items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1">
            <Icon as={category.icon} size="2xs" className="text-secondary-foreground" />
            <Text size="xs" className="font-medium text-secondary-foreground">
              {category.label}
            </Text>
          </View>
        </View>
      )}

      {/* Content */}
      <View className="gap-1">
        {analysis?.punchline && (
          <Text className="font-semibold leading-snug">{analysis.punchline}</Text>
        )}
        <Text size="sm" numberOfLines={3} className="text-muted-foreground">
          {post.content}
        </Text>
      </View>

      {post.media_url && (
        <Image source={{ uri: post.media_url }} className="h-40 w-full rounded-lg" resizeMode="cover" />
      )}

      {matchesSkills && canHelp && (
        <View className="flex-row items-center gap-1.5">
          <Icon as={Sparkles} size="xs" className="text-brand" />
          <Text size="xs" className="font-medium text-brand">
            Matches your skills
          </Text>
        </View>
      )}

      {/* Footer */}
      <View className="flex-row items-center gap-3 border-t border-border pt-3">
        <View className="flex-1 flex-row items-center gap-1.5">
          <View className={`h-2 w-2 rounded-full ${status.dot}`} />
          <Text size="xs" className="text-muted-foreground">
            {status.label}
            {post.helper_count > 0 &&
              ` · ${post.helper_count} ${post.helper_count === 1 ? 'neighbour' : 'neighbours'} helping`}
          </Text>
        </View>
        {canHelp ? (
          <Button size="sm" variant="brand" onPress={onOfferHelp}>
            <ButtonIcon as={HandHelping} />
            <ButtonText>Offer help</ButtonText>
          </Button>
        ) : post.is_mine ? (
          <Text size="xs" className="font-medium text-muted-foreground">
            Your post
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export function PostCardSkeleton() {
  return (
    <View className="gap-3 rounded-xl border border-border bg-card p-4">
      <View className="flex-row items-center gap-3">
        <View className="h-9 w-9 rounded-full bg-secondary" />
        <View className="flex-1 gap-1.5">
          <View className="h-3 w-1/3 rounded bg-secondary" />
          <View className="h-2.5 w-1/4 rounded bg-secondary" />
        </View>
      </View>
      <View className="h-4 w-4/5 rounded bg-secondary" />
      <View className="h-3 w-full rounded bg-secondary" />
      <View className="h-3 w-2/3 rounded bg-secondary" />
    </View>
  );
}
