import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Bar, Button, Card, Dot, ErrorText, Input, Row, Segmented, Txt } from '@/components/ui';
import { api } from '@/lib/api';
import { useColors, type Palette } from '@/lib/theme';
import type { Confidence, FoodDraft, MealType } from '@/lib/types';
import { confirmAsync, guessMealType, MACROS } from '@/lib/utils';

const MEALS: { value: MealType; label: string }[] = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snack' },
];

const str = (v: number | undefined) => (v == null ? '' : String(v));
const num = (v: string | number) => Math.max(0, Number(v) || 0);

// Review / edit a food entry. `initial` is either a saved entry (has _id) or an AI/manual draft.
export function FoodEditor({
  initial,
  date,
  onSaved,
  onDeleted,
}: {
  initial: FoodDraft;
  date?: string;
  onSaved: () => void;
  onDeleted?: () => void;
}) {
  const c = useColors();
  const [f, setF] = useState(() => ({
    name: initial.name || '',
    mealType: initial.mealType || guessMealType(),
    servings: initial.servings || 1,
    portionGrams: initial.portionGrams ? String(initial.portionGrams) : '',
    calories: str(initial.calories),
    protein: str(initial.protein),
    carbs: str(initial.carbs),
    fat: str(initial.fat),
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const isNew = !initial._id;

  type Form = typeof f;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((prev) => ({ ...prev, [k]: v }));
  const servings = num(f.servings) || 1;

  // Correcting the portion weight rescales calories and macros proportionally
  const setPortion = (v: string) =>
    setF((prev) => {
      const oldG = num(prev.portionGrams);
      const newG = num(v);
      if (!oldG || !newG) return { ...prev, portionGrams: v };
      const r = newG / oldG;
      const scale = (x: string) => (x === '' ? '' : String(Math.round(num(x) * r)));
      return {
        ...prev,
        portionGrams: v,
        calories: scale(prev.calories),
        protein: scale(prev.protein),
        carbs: scale(prev.carbs),
        fat: scale(prev.fat),
      };
    });

  async function save() {
    if (!f.name.trim()) return setError('Give this food a name');
    setBusy(true);
    setError('');
    const body = {
      name: f.name.trim(),
      mealType: f.mealType,
      servings,
      portionGrams: num(f.portionGrams) || undefined,
      calories: num(f.calories),
      protein: num(f.protein),
      carbs: num(f.carbs),
      fat: num(f.fat),
    };
    try {
      if (isNew) {
        await api('/logs', {
          method: 'POST',
          body: {
            ...body,
            date,
            items: initial.items,
            healthScore: initial.healthScore,
            confidence: initial.confidence,
            notes: initial.notes,
            image: initial.image,
            source: initial.source || 'manual',
          },
        });
      } else {
        await api(`/logs/${initial._id}`, { method: 'PUT', body });
      }
      onSaved();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  async function remove() {
    if (!(await confirmAsync('Delete entry', 'Delete this entry?', 'Delete'))) return;
    setBusy(true);
    try {
      await api(`/logs/${initial._id}`, { method: 'DELETE' });
      onDeleted?.();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const step = (d: number) => set('servings', Math.max(0.5, Math.round((servings + d) * 2) / 2));
  const score = initial.healthScore;

  return (
    <View style={{ gap: 12 }}>
      {initial.image && (
        <Image source={{ uri: initial.image }} style={styles.photo} contentFit="cover" />
      )}

      {isNew && initial.isEstimate && (
        <View style={[styles.estimate, { backgroundColor: c.soft }]}>
          <Row between>
            <Txt bold>✨ AI estimate</Txt>
            {initial.confidence && <ConfidenceTag level={initial.confidence} suffix=" confidence" />}
          </Row>
          {!!initial.uncertainty && <Txt variant="small">{initial.uncertainty}</Txt>}
          <Txt variant="small" muted>
            Check the portion and values below. You can correct anything before saving.
          </Txt>
        </View>
      )}

      <Row>
        <Input
          style={{ flex: 1, fontWeight: '700', fontSize: 18 }}
          value={f.name}
          onChangeText={(v) => set('name', v)}
          placeholder="Food name"
        />
        <View style={[styles.stepper, { backgroundColor: c.soft }]}>
          <Pressable onPress={() => step(-0.5)} accessibilityLabel="Fewer servings" hitSlop={8}>
            <Txt variant="h2">−</Txt>
          </Pressable>
          <Txt bold style={{ minWidth: 28, textAlign: 'center' }}>{servings}</Txt>
          <Pressable onPress={() => step(0.5)} accessibilityLabel="More servings" hitSlop={8}>
            <Txt variant="h2">+</Txt>
          </Pressable>
        </View>
      </Row>

      <Segmented options={MEALS} value={f.mealType} onChange={(v) => set('mealType', v)} />

      <Card style={{ paddingVertical: 14 }}>
        <Row between>
          <View style={{ flex: 1 }}>
            <Txt variant="small" muted>🔥 Calories per serving</Txt>
            <TextInput
              keyboardType="number-pad"
              value={f.calories}
              onChangeText={(v) => set('calories', v)}
              placeholder="0"
              placeholderTextColor={c.muted}
              style={{ fontSize: 32, fontWeight: '800', color: c.text, paddingVertical: 2 }}
            />
          </View>
          {servings !== 1 && (
            <View style={{ alignItems: 'center' }}>
              <Txt variant="small" muted>Total</Txt>
              <Txt variant="h2">{Math.round(num(f.calories) * servings)}</Txt>
            </View>
          )}
        </Row>
      </Card>

      <NutriInput
        label={`⚖️ Portion per serving (g)${f.portionGrams !== '' ? ' · editing rescales the values' : ''}`}
        value={f.portionGrams}
        onChange={setPortion}
        placeholder="e.g. 250"
      />

      <Row style={{ gap: 8 }}>
        {MACROS.map((m) => (
          <NutriInput
            key={m.key}
            style={{ flex: 1 }}
            label={
              <Row style={{ gap: 6 }}>
                <Dot color={m.color(c)} />
                <Txt variant="small" muted>{m.label} (g)</Txt>
              </Row>
            }
            value={f[m.key]}
            onChange={(v) => set(m.key, v)}
            decimal
          />
        ))}
      </Row>

      {score != null && (
        <Card style={{ gap: 8 }}>
          <Row between>
            <Txt bold>💚 Health score</Txt>
            <Txt bold>{score}/10</Txt>
          </Row>
          <Bar pct={score * 10} color={score >= 7 ? c.good : score >= 4 ? c.carbs : c.protein} />
          {!!initial.notes && <Txt variant="small" muted>{initial.notes}</Txt>}
        </Card>
      )}

      {!!initial.items?.length && (
        <Card style={{ gap: 4 }}>
          <Txt bold>Ingredients</Txt>
          {initial.items.map((i, idx) => (
            <View key={idx} style={[styles.itemRow, { borderTopColor: c.line }]}>
              <View style={{ flex: 1, gap: 2 }}>
                <Row style={{ gap: 6 }}>
                  <Txt variant="small" bold>{i.name}</Txt>
                  {i.confidence && i.confidence !== 'high' && <ConfidenceTag level={i.confidence} />}
                </Row>
                <Txt variant="small" muted>
                  {i.portion}
                  {!!i.portionGrams && !String(i.portion).includes(`${i.portionGrams} g`) && ` · ~${i.portionGrams} g`}
                </Txt>
                <Txt variant="small" muted>P {i.protein}g · C {i.carbs}g · F {i.fat}g</Txt>
              </View>
              <Txt variant="small" muted>{i.calories} kcal</Txt>
            </View>
          ))}
        </Card>
      )}

      <ErrorText>{error}</ErrorText>
      <Button title={isNew ? 'Log it' : 'Save changes'} busy={busy} onPress={save} />
      {!isNew && <Button title="Delete entry" variant="danger" disabled={busy} onPress={remove} />}
    </View>
  );
}

function NutriInput({
  label,
  value,
  onChange,
  placeholder,
  decimal,
  style,
}: {
  label: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  decimal?: boolean;
  style?: object;
}) {
  const c = useColors();
  return (
    <View style={[styles.nutri, { backgroundColor: c.card }, style]}>
      {typeof label === 'string' ? <Txt variant="small" muted>{label}</Txt> : label}
      <TextInput
        keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={c.muted}
        style={{ fontSize: 18, fontWeight: '700', color: c.text, paddingVertical: 2 }}
      />
    </View>
  );
}

const confColor = (c: Palette, l: Confidence) => (l === 'high' ? c.good : l === 'medium' ? c.carbs : c.protein);

function ConfidenceTag({ level, suffix = '' }: { level: Confidence; suffix?: string }) {
  const c = useColors();
  const color = confColor(c, level);
  return (
    <View style={{ backgroundColor: color + '22', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
      <Txt variant="small" bold color={color}>{level}{suffix}</Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  photo: { width: '100%', height: 220, borderRadius: 20 },
  estimate: { borderRadius: 18, padding: 14, gap: 6 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 52, borderRadius: 999, paddingHorizontal: 16 },
  nutri: { borderRadius: 16, padding: 12, gap: 4 },
  itemRow: { flexDirection: 'row', gap: 10, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
});
