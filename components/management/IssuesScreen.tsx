import { FilterChips, Pill } from '@/components/management/Chips';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { SafeAreaView } from '@/components/ui/safe-area-view';
import { Text } from '@/components/ui/text';
import * as api from '@/lib/api';
import { timeAgo } from '@/lib/post-meta';
import { useSession } from '@/lib/session';
import { useNotify } from '@/lib/use-notify';
import type { ReportDetail, ReportStatus, ReportTarget } from '@/types/models';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';

const TARGET_LABEL: Record<ReportTarget, string> = {
  post: 'Post',
  user: 'Resident',
  message: 'Chat message',
};

const STATUS_PILL: Record<ReportStatus, { label: string; tone: 'warn' | 'neutral' | 'good' }> = {
  open: { label: 'Open', tone: 'warn' },
  investigating: { label: 'Investigating', tone: 'neutral' },
  resolved: { label: 'Resolved', tone: 'good' },
};

function IssueCard({ detail, onChanged }: { detail: ReportDetail; onChanged: () => void }) {
  const { user } = useSession();
  const notify = useNotify();
  const { report, offender } = detail;
  const [busy, setBusy] = useState<string>();
  // Destructive actions need a second tap (Alert isn't available on web).
  const [confirm, setConfirm] = useState<api.ModerationAction>();
  const pill = STATUS_PILL[report.status];
  const done = report.status === 'resolved';

  const run = async (key: string, fn: () => Promise<string | void>) => {
    setBusy(key);
    try {
      const message = await fn();
      if (message) notify(message);
      onChanged();
    } catch (e) {
      notify("Couldn't complete that", (e as Error).message);
    } finally {
      setBusy(undefined);
      setConfirm(undefined);
    }
  };

  const setStatus = (status: ReportStatus) =>
    run(status, async () => {
      await api.updateReportStatus(user!, report.id, status);
      return status === 'resolved' ? 'Marked as resolved' : 'Moved to investigating';
    });

  const moderate = (action: api.ModerationAction) => {
    if (confirm !== action) {
      setConfirm(action);
      return;
    }
    run(action, () => api.moderate(user!, report.id, action));
  };

  const modButton = (
    action: api.ModerationAction,
    label: string,
    variant: 'outline' | 'destructive' = 'destructive'
  ) => (
    <Button
      key={action}
      size="sm"
      variant={variant}
      isDisabled={!!busy}
      onPress={() => moderate(action)}
    >
      {busy === action && <ButtonSpinner />}
      <ButtonText>{confirm === action ? 'Tap again to confirm' : label}</ButtonText>
    </Button>
  );

  return (
    <View className="gap-3 rounded-xl border border-border bg-card p-4">
      <View className="flex-row items-center justify-between gap-3">
        <Text size="xs" className="font-semibold uppercase tracking-wide text-muted-foreground">
          {TARGET_LABEL[report.target_type]} reported · {timeAgo(report.created_at)} ago
        </Text>
        <Pill label={pill.label} tone={pill.tone} />
      </View>

      <Text className="font-semibold">{report.reason}</Text>

      <View className="rounded-lg bg-secondary p-3">
        <Text size="sm" numberOfLines={4}>
          {detail.target_excerpt}
        </Text>
      </View>

      <Text size="xs" className="text-muted-foreground">
        Reported by {detail.reporter_name}
        {offender && report.target_type !== 'user'
          ? ` · Written by ${offender.name} (Block ${offender.block}), visible to management only`
          : offender
            ? ` · Block ${offender.block}`
            : ''}
      </Text>

      {report.resolution_note ? (
        <Text size="xs" className="font-medium text-emerald-700 dark:text-emerald-400">
          Outcome: {report.resolution_note}
        </Text>
      ) : null}

      {!done && (
        <View className="flex-row flex-wrap gap-2 border-t border-border pt-3">
          {report.status === 'open' && (
            <Button
              size="sm"
              variant="outline"
              isDisabled={!!busy}
              onPress={() => setStatus('investigating')}
            >
              {busy === 'investigating' && <ButtonSpinner />}
              <ButtonText>Investigate</ButtonText>
            </Button>
          )}
          {detail.post_exists && modButton('delete_post', 'Delete post')}
          {offender && modButton('warn_user', 'Warn user', 'outline')}
          {offender && offender.status !== 'suspended' && modButton('suspend_user', 'Suspend user')}
          <Button size="sm" variant="brand" isDisabled={!!busy} onPress={() => setStatus('resolved')}>
            {busy === 'resolved' && <ButtonSpinner />}
            <ButtonText>Resolve</ButtonText>
          </Button>
        </View>
      )}
    </View>
  );
}

export default function IssuesScreen({ title }: { title: string }) {
  const { user } = useSession();
  const [reports, setReports] = useState<ReportDetail[]>();
  const [filter, setFilter] = useState<ReportStatus>('open');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (user) setReports(await api.getReports(user));
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const counts = useMemo(() => {
    const c: Record<ReportStatus, number> = { open: 0, investigating: 0, resolved: 0 };
    reports?.forEach((r) => (c[r.report.status] += 1));
    return c;
  }, [reports]);

  const visible = (reports ?? []).filter((r) => r.report.status === filter);

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <FlatList
        data={visible}
        keyExtractor={(d) => d.report.id}
        renderItem={({ item }) => <IssueCard detail={item} onChanged={load} />}
        ItemSeparatorComponent={() => <View className="h-3" />}
        ListHeaderComponent={
          <View className="gap-4 pb-4 pt-4">
            <Heading size="2xl">{title}</Heading>
            <FilterChips
              value={filter}
              onChange={setFilter}
              options={[
                { id: 'open', label: 'Open', count: counts.open },
                { id: 'investigating', label: 'Investigating', count: counts.investigating },
                { id: 'resolved', label: 'Resolved', count: counts.resolved },
              ]}
            />
          </View>
        }
        ListEmptyComponent={
          <View>
            <Text className="py-10 text-center text-muted-foreground">
              {reports ? 'No reports in this list.' : 'Loading…'}
            </Text>
          </View>
        }
        contentContainerClassName="w-full max-w-xl self-center px-4 pb-10"
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
      />
    </SafeAreaView>
  );
}
