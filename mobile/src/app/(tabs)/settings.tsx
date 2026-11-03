import { useState } from 'react';
import { View } from 'react-native';

import { Button, Card, Dot, ErrorText, Field, Input, Row, Screen, Segmented, Txt } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth, useUser } from '@/lib/auth';
import { API_URL } from '@/lib/config';
import { TAB_BAR_HEIGHT, useColors } from '@/lib/theme';
import type { Nutrition, Profile, User } from '@/lib/types';
import { confirmAsync, MACROS } from '@/lib/utils';

const toForm = <T extends object>(o: T) =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v == null ? '' : String(v)])) as Record<keyof T, string>;

export default function Settings() {
  const user = useUser();
  const { setUser, logout } = useAuth();
  const c = useColors();
  const [goals, setGoals] = useState(() => toForm<Nutrition>(user.goals));
  const [profile, setProfile] = useState(() => ({
    age: user.profile.age == null ? '' : String(user.profile.age),
    heightCm: user.profile.heightCm == null ? '' : String(user.profile.heightCm),
    weightKg: user.profile.weightKg == null ? '' : String(user.profile.weightKg),
    targetWeightKg: user.profile.targetWeightKg == null ? '' : String(user.profile.targetWeightKg),
    gender: user.profile.gender,
    goal: user.profile.goal,
    activity: user.profile.activity,
  }));
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'goals' | 'profile' | null>(null);

  async function run(which: 'goals' | 'profile', fn: () => Promise<User>, ok: string) {
    setMsg('');
    setError('');
    setBusy(which);
    try {
      setUser(await fn());
      setMsg(ok);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const saveGoals = () =>
    run(
      'goals',
      () => api<User>('/auth/goals', { method: 'PUT', body: Object.fromEntries(Object.entries(goals).map(([k, v]) => [k, Number(v)])) }),
      'Goals saved'
    );

  const recalc = () =>
    run(
      'profile',
      async () => {
        const n = (v: string) => (v === '' ? undefined : Number(v.replace(',', '.')));
        const body: Partial<Profile> = {
          gender: profile.gender,
          goal: profile.goal,
          activity: profile.activity,
          age: n(profile.age),
          heightCm: n(profile.heightCm),
          weightKg: n(profile.weightKg),
          targetWeightKg: n(profile.targetWeightKg),
        };
        const u = await api<User>('/auth/profile', { method: 'PUT', body: { profile: body } });
        setGoals(toForm(u.goals));
        return u;
      },
      'Profile saved and goals recalculated'
    );

  type P = typeof profile;
  const setP = <K extends keyof P>(k: K) => (v: P[K]) => setProfile((p) => ({ ...p, [k]: v }));

  async function confirmLogout() {
    if (await confirmAsync('Log out', 'Log out of CalSnap on this device?', 'Log out')) logout();
  }

  return (
    <Screen bottomInset={TAB_BAR_HEIGHT + 24} contentStyle={{ gap: 16 }}>
      <Txt variant="h1">Settings</Txt>

      <Card>
        <Row>
          <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center' }}>
            <Txt variant="h2">{user.name[0]?.toUpperCase()}</Txt>
          </View>
          <View style={{ flex: 1 }}>
            <Txt bold>{user.name}</Txt>
            <Txt variant="small" muted>{user.email}</Txt>
          </View>
        </Row>
      </Card>

      {!!msg && (
        <Card style={{ paddingVertical: 12 }}>
          <Txt variant="small" color={c.good}>✓ {msg}</Txt>
        </Card>
      )}
      <ErrorText>{error}</ErrorText>

      <Card style={{ gap: 12 }}>
        <Txt variant="h3">Daily goals</Txt>
        <Field label="🔥 Calories">
          <Input keyboardType="number-pad" value={goals.calories} onChangeText={(v) => setGoals({ ...goals, calories: v })} />
        </Field>
        <Row style={{ gap: 8 }}>
          {MACROS.map((m) => (
            <Field
              key={m.key}
              style={{ flex: 1 }}
              label={
                <Row style={{ gap: 6 }}>
                  <Dot color={m.color(c)} />
                  <Txt variant="small" muted bold>{m.label} (g)</Txt>
                </Row>
              }>
              <Input keyboardType="number-pad" value={goals[m.key]} onChangeText={(v) => setGoals({ ...goals, [m.key]: v })} />
            </Field>
          ))}
        </Row>
        <Button title="Save goals" busy={busy === 'goals'} onPress={saveGoals} />
      </Card>

      <Card style={{ gap: 12 }}>
        <Txt variant="h3">Profile</Txt>
        <Row style={{ gap: 8 }}>
          <Field label="Age" style={{ flex: 1 }}>
            <Input keyboardType="number-pad" value={profile.age} onChangeText={setP('age')} />
          </Field>
          <Field label="Height (cm)" style={{ flex: 1 }}>
            <Input keyboardType="decimal-pad" value={profile.heightCm} onChangeText={setP('heightCm')} />
          </Field>
        </Row>
        <Row style={{ gap: 8 }}>
          <Field label="Weight (kg)" style={{ flex: 1 }}>
            <Input keyboardType="decimal-pad" value={profile.weightKg} onChangeText={setP('weightKg')} />
          </Field>
          <Field label="Target (kg)" style={{ flex: 1 }}>
            <Input keyboardType="decimal-pad" value={profile.targetWeightKg} onChangeText={setP('targetWeightKg')} />
          </Field>
        </Row>
        <Field label="Gender">
          <Segmented
            options={[
              { value: 'male', label: 'Male' },
              { value: 'female', label: 'Female' },
            ]}
            value={profile.gender}
            onChange={setP('gender')}
          />
        </Field>
        <Field label="Goal">
          <Segmented
            options={[
              { value: 'lose', label: 'Lose' },
              { value: 'maintain', label: 'Maintain' },
              { value: 'gain', label: 'Gain' },
            ]}
            value={profile.goal}
            onChange={setP('goal')}
          />
        </Field>
        <Field label="Activity">
          <Segmented
            options={[
              { value: 'sedentary', label: 'Sitting' },
              { value: 'light', label: 'Light' },
              { value: 'moderate', label: 'Active' },
              { value: 'active', label: 'Very' },
            ]}
            value={profile.activity}
            onChange={setP('activity')}
          />
        </Field>
        <Button title="Save & recalculate goals" variant="secondary" busy={busy === 'profile'} onPress={recalc} />
      </Card>

      <Button title="Log out" variant="danger" onPress={confirmLogout} />
      <Txt variant="small" muted center>Server: {API_URL}</Txt>
    </Screen>
  );
}
