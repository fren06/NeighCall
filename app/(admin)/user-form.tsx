import { SkillPicker } from '@/components/form/SkillPicker';
import { TextField } from '@/components/form/TextField';
import { Button, ButtonIcon, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { KeyboardAvoidingView } from '@/components/ui/keyboard-avoiding-view';
import { SafeAreaView } from '@/components/ui/safe-area-view';
import { ScrollView } from '@/components/ui/scroll-view';
import { Text } from '@/components/ui/text';
import * as api from '@/lib/api';
import { useSession } from '@/lib/session';
import { useNotify } from '@/lib/use-notify';
import { router, useLocalSearchParams } from 'expo-router';
import { X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';

interface Form {
  name: string;
  email: string;
  phone: string;
  block: string;
  unit_number: string;
  street: string;
  skills: string[];
  password: string;
}

/** Add a resident or manager (?role=management), or edit one (?id=...). */
export default function UserForm() {
  const { id, role: roleParam } = useLocalSearchParams<{ id?: string; role?: string }>();
  const { user: admin } = useSession();
  const notify = useNotify();
  const editing = !!id;
  const [isManager, setIsManager] = useState(roleParam === 'management');
  const who = isManager ? 'manager' : 'resident';

  const [form, setForm] = useState<Form>({
    name: '',
    email: '',
    phone: '',
    block: '',
    unit_number: '',
    street: admin?.street ?? '',
    skills: [],
    password: '',
  });
  const [loaded, setLoaded] = useState(!editing);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id || !admin) return;
    api.getResidents(admin).then((list) => {
      const u = list.find((r) => r.id === id);
      if (u) {
        setIsManager(u.role === 'management');
        setForm((f) => ({
          ...f,
          name: u.name,
          email: u.email,
          phone: u.phone,
          block: u.block,
          unit_number: u.unit_number,
          street: u.street,
          skills: u.skills,
        }));
      } else {
        setError('That account no longer exists.');
      }
      setLoaded(true);
    });
  }, [id, admin]);

  if (!admin) return null;

  const set =
    <K extends keyof Form>(key: K) =>
    (value: Form[K]) => {
      setForm((f) => ({ ...f, [key]: value }));
      setError(undefined);
    };

  const save = async () => {
    setBusy(true);
    setError(undefined);
    try {
      const { password, ...details } = form;
      if (editing) {
        await api.adminUpdateUser(admin, id!, details);
        notify(`${isManager ? 'Manager' : 'Resident'} updated`, form.name);
      } else {
        await api.adminCreateUser(admin, {
          ...details,
          skills: isManager ? [] : details.skills,
          password,
          role: isManager ? 'management' : 'resident',
        });
        notify(`${isManager ? 'Manager' : 'Resident'} added`, `${form.name} can sign in now.`);
      }
      router.back();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="w-full max-w-xl flex-row items-center gap-2 self-center border-b border-border px-2 py-2">
        <Button variant="ghost" size="icon" onPress={() => router.back()} accessibilityLabel="Close">
          <ButtonIcon as={X} />
        </Button>
        <Text className="flex-1 font-semibold">{editing ? `Edit ${who}` : `Add ${who}`}</Text>
        <Button variant="brand" size="sm" onPress={save} isDisabled={busy || !loaded} className="mr-2">
          {busy && <ButtonSpinner />}
          <ButtonText>{editing ? 'Save' : 'Add'}</ButtonText>
        </Button>
      </View>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerClassName="w-full max-w-xl self-center gap-4 px-4 py-4 pb-10"
          keyboardShouldPersistTaps="handled"
        >
          {error ? (
            <View className="rounded-xl bg-destructive/15 p-3">
              <Text size="sm" className="text-destructive">
                {error}
              </Text>
            </View>
          ) : null}

          <TextField label="Full name" value={form.name} onChangeText={set('name')} />
          <TextField
            label="Email"
            value={form.email}
            onChangeText={set('email')}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextField
            label="Phone number"
            value={form.phone}
            onChangeText={set('phone')}
            keyboardType="phone-pad"
          />
          <View className="flex-row gap-3">
            <TextField className="flex-1" label="Block" value={form.block} onChangeText={set('block')} />
            <TextField
              className="flex-1"
              label="Unit no."
              value={form.unit_number}
              onChangeText={set('unit_number')}
            />
          </View>
          <TextField label="Street" value={form.street} onChangeText={set('street')} />

          {!editing && (
            <TextField
              label="Temporary password"
              helper="At least 8 characters. Share it with the resident."
              value={form.password}
              onChangeText={set('password')}
              secureTextEntry
              autoCapitalize="none"
            />
          )}

          {!isManager && (
          <View className="gap-2">
            <Text size="sm" className="font-medium">
              Skills <Text className="text-muted-foreground">(optional)</Text>
            </Text>
            <SkillPicker value={form.skills} onChange={set('skills')} />
          </View>
          )}

          {!editing && (
            <Text size="xs" className="text-muted-foreground">
              {isManager
                ? 'Managers can publish bulletins and handle community issues. They start approved.'
                : 'Residents added here are treated as verified and start approved.'}
            </Text>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
