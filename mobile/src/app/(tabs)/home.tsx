import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { FoodEditor } from '@/components/food-editor';
import { Ring } from '@/components/ring';
import { Sheet } from '@/components/sheet';
import { Card, Dot, ErrorText, Row, Screen, Txt } from '@/components/ui';
import { api } from '@/lib/api';
import { useUser } from '@/lib/auth';
import { TAB_BAR_HEIGHT, useColors } from '@/lib/theme';
import type { FoodLog, Nutrition } from '@/lib/types';
import { addDays, dateStr, MACROS, parseDate, timeOf } from '@/lib/utils';

type DayData = { entries: FoodLog[]; totals: Nutrition };
type AddMode = 'scan' | 'describe' | 'manual';

export default function Home() {
  const { goals } = useUser();
  const router = useRouter();
  const c = useColors();
  const today = dateStr();
  const [date, setDate] = useState(today);
  const [data, setData] = useState<DayData>({ entries: [], totals: { calories: 0, protein: 0, carbs: 0, fat: 0 } });
  const [week, setWeek] = useState<Record<string, Nutrition>>({});
  const [editing, setEditing] = useState<FoodLog | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  const weekStart = addDays(today, -6);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const load = useCallback(async () => {
    const to = dateStr();
    try {
      setError('');
      const [day, summary] = await Promise.all([
        api<DayData>(`/logs?date=${date}`),
        api<{ days: Record<string, Nutrition> }>(`/logs/summary?from=${addDays(to, -6)}&to=${to}`),
      ]);
      setData(day);
      setWeek(summary.days);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [date]);

  // Reload whenever the tab is shown again (e.g. after logging food on the add screen)
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const add = (mode: AddMode) => {
    setAdding(false);
    router.push({ pathname: '/add/[mode]', params: { mode, date } });
  };
  const closeEditor = () => {
    setEditing(null);
    load();
  };

  const t = data.totals;
  const left = goals.calories - t.calories;

  return (
    <View style={{ flex: 1 }}>
      <Screen bottomInset={TAB_BAR_HEIGHT + 24} contentStyle={{ gap: 16 }}>
        <Row between>
          <Txt variant="h1">🍎 CalSnap</Txt>
          <Row style={{ gap: 10 }}>
            <Txt variant="small" muted>{streak(week, today)}🔥</Txt>
            <Pressable
              onPress={() => setAdding(true)}
              accessibilityLabel="Log food"
              style={({ pressed }) => [styles.addBtn, { backgroundColor: c.primary, opacity: pressed ? 0.8 : 1 }]}>
              <Txt variant="h2" color={c.onPrimary} style={{ lineHeight: 26 }}>+</Txt>
            </Pressable>
          </Row>
        </Row>

        <Row style={{ gap: 6 }}>
          {weekDays.map((d) => {
            const cal = week[d]?.calories || 0;
            const active = d === date;
            const ring = cal > 0 ? (cal > goals.calories * 1.1 ? c.protein : c.good) : 'transparent';
            return (
              <Pressable
                key={d}
                onPress={() => setDate(d)}
                style={[styles.day, { backgroundColor: active ? c.primary : c.card, borderColor: ring }]}>
                <Txt variant="small" color={active ? c.onPrimary : c.muted}>
                  {parseDate(d).toLocaleDateString([], { weekday: 'short' })}
                </Txt>
                <Txt bold color={active ? c.onPrimary : c.text}>{parseDate(d).getDate()}</Txt>
              </Pressable>
            );
          })}
        </Row>

        <ErrorText>{error}</ErrorText>

        <Card style={{ padding: 22 }}>
          <Row between>
            <View>
              <Txt style={{ fontSize: 44, fontWeight: '800', letterSpacing: -1.5 }}>{Math.abs(left)}</Txt>
              <Txt muted>{left >= 0 ? 'Calories left' : 'Calories over'}</Txt>
              <Txt variant="small" muted style={{ marginTop: 8 }}>
                {t.calories} eaten · {goals.calories} goal
              </Txt>
            </View>
            <Ring value={t.calories} max={goals.calories} size={110} stroke={10}>
              <Txt style={{ fontSize: 30 }}>🔥</Txt>
            </Ring>
          </Row>
        </Card>

        <Row style={{ gap: 10, alignItems: 'stretch' }}>
          {MACROS.map((m) => {
            const mLeft = goals[m.key] - t[m.key];
            return (
              <Card key={m.key} style={{ flex: 1, padding: 14, gap: 10 }}>
                <View>
                  <Txt variant="h3">{Math.abs(mLeft)}g</Txt>
                  <Txt variant="small" muted>{m.label} {mLeft >= 0 ? 'left' : 'over'}</Txt>
                </View>
                <Ring value={t[m.key]} max={goals[m.key]} size={64} stroke={7} color={m.color(c)}>
                  <Txt variant="small" bold>{m.label[0]}</Txt>
                </Ring>
              </Card>
            );
          })}
        </Row>

        <Txt variant="h2" style={{ marginTop: 6 }}>
          {date === today
            ? 'Recently eaten'
            : parseDate(date).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' })}
        </Txt>

        {data.entries.length === 0 ? (
          <Card onPress={() => add('scan')} style={{ alignItems: 'center', padding: 28, gap: 6 }}>
            <Txt style={{ fontSize: 40 }}>📸</Txt>
            <Txt bold>No food logged yet</Txt>
            <Txt variant="small" muted>Tap + to snap your first meal</Txt>
          </Card>
        ) : (
          data.entries.map((e) => (
            <Card key={e._id} onPress={() => setEditing(e)} style={{ flexDirection: 'row', gap: 14, padding: 12 }}>
              {e.image ? (
                <Image source={{ uri: e.image }} style={styles.thumb} contentFit="cover" />
              ) : (
                <View style={[styles.thumb, { backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center' }]}>
                  <Txt style={{ fontSize: 28 }}>🍽️</Txt>
                </View>
              )}
              <View style={{ flex: 1, gap: 6, justifyContent: 'center' }}>
                <Row between>
                  <Txt bold numberOfLines={1} style={{ flex: 1 }}>{e.name}</Txt>
                  <Txt variant="small" muted>{timeOf(e.createdAt)}</Txt>
                </Row>
                <Txt bold>🔥 {Math.round(e.calories * e.servings)} kcal</Txt>
                <Row style={{ gap: 12 }}>
                  {MACROS.map((m) => (
                    <Row key={m.key} style={{ gap: 4 }}>
                      <Dot color={m.color(c)} />
                      <Txt variant="small" muted>{Math.round(e[m.key] * e.servings)}g</Txt>
                    </Row>
                  ))}
                </Row>
              </View>
            </Card>
          ))
        )}
      </Screen>

      <Sheet visible={adding} onClose={() => setAdding(false)}>
        <Txt variant="h2" style={{ marginBottom: 4 }}>Log food</Txt>
        <Row style={{ gap: 10 }}>
          {([
            ['scan', '📸', 'Scan food'],
            ['describe', '✍️', 'Describe'],
            ['manual', '🔢', 'Manual'],
          ] as const).map(([mode, icon, label]) => (
            <Card key={mode} onPress={() => add(mode)} style={{ flex: 1, alignItems: 'center', gap: 8, paddingVertical: 22 }}>
              <Txt style={{ fontSize: 30 }}>{icon}</Txt>
              <Txt variant="small" bold>{label}</Txt>
            </Card>
          ))}
        </Row>
      </Sheet>

      <Sheet visible={!!editing} onClose={() => setEditing(null)}>
        {editing && <FoodEditor key={editing._id} initial={editing} onSaved={closeEditor} onDeleted={closeEditor} />}
      </Sheet>
    </View>
  );
}

// Consecutive days (ending today or yesterday) with something logged
function streak(week: Record<string, Nutrition>, today: string) {
  let n = 0;
  let d = week[today]?.calories ? today : addDays(today, -1);
  while (week[d]?.calories) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

const styles = StyleSheet.create({
  addBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  day: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 14, borderWidth: 2, gap: 2 },
  thumb: { width: 72, height: 72, borderRadius: 14 },
});
