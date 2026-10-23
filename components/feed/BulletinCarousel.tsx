import { BulletinBanner } from '@/components/feed/BulletinBanner';
import { Pressable } from '@/components/ui/pressable';
import type { Bulletin } from '@/types/models';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  View,
} from 'react-native';

/** Time each notice stays on screen before the next one slides in. */
const AUTO_ADVANCE_MS = 5000;
/** After the resident touches the carousel, it waits this long before moving again. */
const IDLE_MS = 6000;

/**
 * Management notices on the resident home screen, one at a time: swipe (or
 * tap a dot) to see the next, and it moves on by itself while left alone.
 * Important notices come first.
 */
export function BulletinCarousel({ bulletins }: { bulletins: Bulletin[] }) {
  const ordered = useMemo(
    () =>
      [...bulletins].sort(
        (a, b) =>
          Number(b.is_high_priority) - Number(a.is_high_priority) ||
          b.created_at.localeCompare(a.created_at)
      ),
    [bulletins]
  );
  const count = ordered.length;

  const listRef = useRef<FlatList<Bulletin>>(null);
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);
  const lastTouch = useRef(0);
  const autoScrolling = useRef(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  // Respect the phone's "reduce motion" setting: no automatic sliding.
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion, () => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  const markTouched = useCallback(() => {
    lastTouch.current = Date.now();
  }, []);

  const goTo = useCallback(
    (i: number, animated = true) => {
      if (!width) return;
      autoScrolling.current = true;
      listRef.current?.scrollToOffset({ offset: i * width, animated });
      indexRef.current = i;
      setIndex(i);
      setTimeout(() => (autoScrolling.current = false), 600);
    },
    [width]
  );

  // Move on by itself, unless the resident touched it recently.
  useEffect(() => {
    if (count < 2 || !width || reduceMotion) return;
    const timer = setInterval(() => {
      if (Date.now() - lastTouch.current < IDLE_MS) return;
      goTo((indexRef.current + 1) % count);
    }, AUTO_ADVANCE_MS);
    return () => clearInterval(timer);
  }, [count, width, reduceMotion, goTo]);

  // A notice expired or was deleted: don't stay past the end.
  useEffect(() => {
    if (indexRef.current >= count && count > 0) goTo(0, false);
  }, [count, goTo]);

  // Keep the current notice in view when the width changes (e.g. browser resize).
  useEffect(() => {
    if (width) goTo(indexRef.current, false);
  }, [width, goTo]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!width) return;
    if (!autoScrolling.current) markTouched();
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i !== indexRef.current && i >= 0 && i < count) {
      indexRef.current = i;
      setIndex(i);
    }
  };

  if (count === 0) return null;
  if (count === 1) return <BulletinBanner bulletin={ordered[0]} />;

  return (
    <View
      className="gap-2"
      onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))}
      onTouchStart={markTouched}
    >
      {width > 0 ? (
        <FlatList
          ref={listRef}
          data={ordered}
          keyExtractor={(b) => b.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          onScrollBeginDrag={markTouched}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          renderItem={({ item, index: i }) => (
            <View style={{ width }} accessibilityLabel={`Notice ${i + 1} of ${count}`}>
              <BulletinBanner bulletin={item} className="flex-1" onPress={markTouched} />
            </View>
          )}
        />
      ) : (
        // First frame, before the width is known.
        <BulletinBanner bulletin={ordered[0]} />
      )}

      <View className="flex-row items-center justify-center gap-1.5">
        {ordered.map((b, i) => (
          <Pressable
            key={b.id}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Show notice ${i + 1} of ${count}`}
            onPress={() => {
              markTouched();
              goTo(i);
            }}
            className={`h-1.5 rounded-full ${i === index ? 'w-4 bg-foreground' : 'w-1.5 bg-foreground/25'}`}
          />
        ))}
      </View>
    </View>
  );
}
