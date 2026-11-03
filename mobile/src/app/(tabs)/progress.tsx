import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { Button, Card, ErrorText, Input, Row, Screen, Segmented, Txt } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth, useUser } from '@/lib/auth';
import { TAB_BAR_HEIGHT, useColors, type Palette } from '@/lib/theme';
import type { Nutrition, User } from '@/lib/types';
import { addDays, dateStr, parseDate } from '@/lib/utils';

export default function Progress() {
  const user = useUser();
  const { setUser } = useAuth();
  const c = useColors();
  const today = dateStr();
  const [range, setRange] = useState<7 | 30>(7);
  const [days, setDays] = useState<Record<string, Nutrition>>({});
  const [kg, setKg] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useFocusEffect(
    useCallback(() => {
      api<{ days: Record<string, Nutrition> }>(`/logs/summary?from=${addDays(today, -(range - 1))}&to=${today}`)
        .then((r) => setDays(r.days))
        .catch((e) => setError(e.message));
    }, [range, today])
  );

  async function logWeight() {
    setBusy(true);
    setError('');
    try {
      setUser(await api<User>('/auth/weight', { method: 'POST', body: { kg: Number(kg.replace(',', '.')), date: today } }));
      setKg('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const { profile, goals, weights } = user;
  const bmi = profile.weightKg && profile.heightCm ? profile.weightKg / (profile.heightCm / 100) ** 2 : null;
  const dates = Array.from({ length: range }, (_, i) => addDays(today, -(range - 1 - i)));
  const logged = dates.filter((d) => days[d]?.calories);
  const avg = logged.length ? Math.round(logged.reduce((s, d) => s + days[d].calories, 0) / logged.length) : 0;
  const maxCal = Math.max(goals.calories * 1.3, ...dates.map((d) => days[d]?.calories || 0));
  const gap = range === 7 ? 10 : 3;

  return (
    <Screen bottomInset={TAB_BAR_HEIGHT + 24} contentStyle={{ gap: 16 }}>
      <Txt variant="h1">Progress</Txt>
      <ErrorText>{error}</ErrorText>

      <Row style={{ gap: 10, alignItems: 'stretch' }}>
        <Card style={{ flex: 1 }}>
          <Txt variant="small" muted>Current weight</Txt>
          <Txt style={{ fontSize: 26, fontWeight: '800' }}>
            {profile.weightKg ?? '–'} <Txt variant="small" muted>kg</Txt>
          </Txt>
          {!!profile.targetWeightKg && <Txt variant="small" muted>Goal: {profile.targetWeightKg} kg</Txt>}
        </Card>
        <Card style={{ flex: 1 }}>
          <Txt variant="small" muted>BMI</Txt>
          <Txt style={{ fontSize: 26, fontWeight: '800' }}>{bmi ? bmi.toFixed(1) : '–'}</Txt>
          {bmi && <Txt variant="small" color={bmiColor(c, bmi)}>{bmiLabel(bmi)}</Txt>}
        </Card>
      </Row>

      <Card style={{ gap: 12 }}>
        <Txt variant="h3">Weight</Txt>
        <WeightChart weights={weights} />
        <Row>
          <Input
            style={{ flex: 1 }}
            keyboardType="decimal-pad"
            placeholder="Today's weight (kg)"
            value={kg}
            onChangeText={setKg}
            returnKeyType="done"
            onSubmitEditing={() => kg && logWeight()}
          />
          <Button title="Log" small disabled={!kg} busy={busy} onPress={logWeight} style={{ height: 52 }} />
        </Row>
      </Card>

      <Card style={{ gap: 12 }}>
        <Row between>
          <Txt variant="h3">Calories</Txt>
          <Segmented
            style={{ width: 150 }}
            options={[
              { value: 7, label: '7d' },
              { value: 30, label: '30d' },
            ]}
            value={range}
            onChange={setRange}
          />
        </Row>
        <Txt variant="small" muted>Average {avg} kcal on logged days · goal {goals.calories}</Txt>
        <View style={{ height: 160, flexDirection: 'row', alignItems: 'flex-end', gap }}>
          <View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: `${(goals.calories / maxCal) * 100}%`,
              borderTopWidth: 1.5,
              borderStyle: 'dashed',
              borderColor: c.muted,
              opacity: 0.6,
            }}
          />
          {dates.map((d) => {
            const cal = days[d]?.calories || 0;
            return (
              <View
                key={d}
                accessibilityLabel={`${d}: ${cal} kcal`}
                style={{
                  flex: 1,
                  height: `${Math.max(2, (cal / maxCal) * 100)}%`,
                  backgroundColor: cal === 0 ? c.soft : cal > goals.calories * 1.1 ? c.protein : c.primary,
                  borderRadius: range === 7 ? 6 : 3,
                }}
              />
            );
          })}
        </View>
        {range === 7 && (
          <Row style={{ gap }}>
            {dates.map((d) => (
              <Txt key={d} variant="small" muted center style={{ flex: 1 }}>
                {parseDate(d).toLocaleDateString([], { weekday: 'narrow' })}
              </Txt>
            ))}
          </Row>
        )}
      </Card>
    </Screen>
  );
}

function WeightChart({ weights }: { weights: User['weights'] }) {
  const c = useColors();
  const [W, setW] = useState(0);
  const pts = weights.slice(-30);
  if (pts.length < 2) return <Txt variant="small" muted>Log your weight on a few days to see the trend.</Txt>;

  const H = 110, pad = 8;
  const vals = pts.map((p) => p.kg);
  const min = Math.min(...vals) - 0.5;
  const max = Math.max(...vals) + 0.5;
  const x = (i: number) => pad + (i / (pts.length - 1)) * (W - pad * 2);
  const y = (v: number) => pad + (1 - (v - min) / (max - min)) * (H - pad * 2);
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.kg)}`).join(' ');
  const diff = vals[vals.length - 1] - vals[0];

  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {W > 0 && (
        <Svg width={W} height={H}>
          <Path d={path} fill="none" stroke={c.primary} strokeWidth={2.5} strokeLinejoin="round" />
          {pts.map((p, i) => (
            <Circle key={p.date} cx={x(i)} cy={y(p.kg)} r={3.5} fill={c.primary} />
          ))}
        </Svg>
      )}
      <Txt variant="small" muted>
        {diff === 0 ? 'No change' : `${diff > 0 ? '+' : ''}${diff.toFixed(1)} kg`} since {pts[0].date}
      </Txt>
    </View>
  );
}

const bmiLabel = (b: number) => (b < 18.5 ? 'Underweight' : b < 25 ? 'Healthy' : b < 30 ? 'Overweight' : 'Obese');
const bmiColor = (c: Palette, b: number) => (b < 18.5 ? c.fat : b < 25 ? c.good : b < 30 ? c.carbs : c.protein);
