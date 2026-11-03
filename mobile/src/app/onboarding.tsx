import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Bar, Button, Choice, ErrorText, Field, Input, Row, Screen, Txt } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth, useUser } from '@/lib/auth';
import { useColors } from '@/lib/theme';
import type { Profile, User } from '@/lib/types';
import { dateStr } from '@/lib/utils';

const STEPS = ['gender', 'body', 'activity', 'goal'] as const;

const ACTIVITY: [Profile['activity'], string, string][] = [
  ['sedentary', 'Mostly sitting', 'Desk job, little exercise'],
  ['light', 'Lightly active', 'Workouts 1-3 times a week'],
  ['moderate', 'Active', 'Workouts 3-5 times a week'],
  ['active', 'Very active', 'Hard training 6-7 times a week'],
];

const GOALS: [Profile['goal'], string, string][] = [
  ['lose', 'Lose weight', 'About 0.5 kg per week'],
  ['maintain', 'Maintain', 'Stay where you are'],
  ['gain', 'Gain weight', 'Lean bulk, slow and steady'],
];

export default function Onboarding() {
  const user = useUser();
  const { setUser, logout } = useAuth();
  const c = useColors();
  const [step, setStep] = useState(0);
  const [p, setP] = useState({
    gender: 'male' as Profile['gender'],
    age: '',
    heightCm: '',
    weightKg: '',
    targetWeightKg: '',
    activity: 'light' as Profile['activity'],
    goal: 'maintain' as Profile['goal'],
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  type Form = typeof p;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setP((prev) => ({ ...prev, [k]: v }));
  const age = Number(p.age), height = Number(p.heightCm), weight = Number(p.weightKg);
  const bodyValid = age >= 10 && age <= 100 && height >= 100 && height <= 250 && weight >= 25 && weight <= 350;

  async function finish() {
    setBusy(true);
    setError('');
    try {
      const profile = {
        ...p,
        age,
        heightCm: height,
        weightKg: weight,
        targetWeightKg: p.targetWeightKg ? Number(p.targetWeightKg) : undefined,
      };
      setUser(await api<User>('/auth/profile', { method: 'PUT', body: { profile, today: dateStr() } }));
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const name = STEPS[step];
  const canNext = name !== 'body' || bodyValid;

  return (
    <Screen edges={['top', 'bottom']} contentStyle={{ flexGrow: 1 }}>
      <Row style={{ marginBottom: 12 }}>
        <Pressable
          onPress={() => (step ? setStep(step - 1) : logout())}
          accessibilityLabel={step ? 'Back' : 'Log out'}
          style={{ backgroundColor: c.soft, borderRadius: 999, paddingHorizontal: 16, height: 38, justifyContent: 'center' }}>
          <Txt bold>←</Txt>
        </Pressable>
        <Bar pct={((step + 1) / STEPS.length) * 100} color={c.primary} style={{ flex: 1 }} />
      </Row>

      <View style={{ flex: 1, gap: 12 }}>
        {name === 'gender' && (
          <>
            <Txt variant="h1">Hi {user.name.split(' ')[0]}! Choose your gender</Txt>
            <Txt muted>Used to calculate your personalised calorie plan.</Txt>
            <Choice title="Male" active={p.gender === 'male'} onPress={() => set('gender', 'male')} />
            <Choice title="Female" active={p.gender === 'female'} onPress={() => set('gender', 'female')} />
          </>
        )}

        {name === 'body' && (
          <>
            <Txt variant="h1">Your body</Txt>
            <Txt muted>We use these to estimate how much energy you burn.</Txt>
            <Field label="Age">
              <Input keyboardType="number-pad" value={p.age} onChangeText={(v) => set('age', v)} placeholder="e.g. 28" />
            </Field>
            <Field label="Height (cm)">
              <Input keyboardType="decimal-pad" value={p.heightCm} onChangeText={(v) => set('heightCm', v)} placeholder="e.g. 172" />
            </Field>
            <Field label="Weight (kg)">
              <Input keyboardType="decimal-pad" value={p.weightKg} onChangeText={(v) => set('weightKg', v)} placeholder="e.g. 74" />
            </Field>
          </>
        )}

        {name === 'activity' && (
          <>
            <Txt variant="h1">How active are you?</Txt>
            {ACTIVITY.map(([value, title, sub]) => (
              <Choice key={value} title={title} subtitle={sub} active={p.activity === value} onPress={() => set('activity', value)} />
            ))}
          </>
        )}

        {name === 'goal' && (
          <>
            <Txt variant="h1">What&apos;s your goal?</Txt>
            {GOALS.map(([value, title, sub]) => (
              <Choice key={value} title={title} subtitle={sub} active={p.goal === value} onPress={() => set('goal', value)} />
            ))}
            {p.goal !== 'maintain' && (
              <Field label="Target weight (kg, optional)">
                <Input keyboardType="decimal-pad" value={p.targetWeightKg} onChangeText={(v) => set('targetWeightKg', v)} />
              </Field>
            )}
          </>
        )}
      </View>

      <ErrorText>{error}</ErrorText>
      {step < STEPS.length - 1 ? (
        <Button title="Continue" disabled={!canNext} onPress={() => setStep(step + 1)} />
      ) : (
        <Button title="Create my plan" busy={busy} onPress={finish} />
      )}
    </Screen>
  );
}
