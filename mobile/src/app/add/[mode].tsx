import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { FoodEditor } from '@/components/food-editor';
import { Button, ErrorText, Input, Row, Screen, Txt } from '@/components/ui';
import { api } from '@/lib/api';
import { pickPhoto, type PickedPhoto } from '@/lib/image';
import { useColors } from '@/lib/theme';
import type { AiUsage, FoodDraft } from '@/lib/types';
import { dateStr } from '@/lib/utils';

const TITLES: Record<string, string> = { scan: 'Scan food', describe: 'Describe your meal', manual: 'Add manually' };

export default function AddFood() {
  const params = useLocalSearchParams<{ mode: string; date?: string }>();
  const mode = params.mode === 'describe' || params.mode === 'manual' ? params.mode : 'scan';
  const date = params.date || dateStr();
  const router = useRouter();
  const c = useColors();

  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [description, setDescription] = useState('');
  const [result, setResult] = useState<FoodDraft | null>(mode === 'manual' ? { source: 'manual' } : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [usage, setUsage] = useState<AiUsage | null>(null);

  useEffect(() => {
    if (mode !== 'manual') api<AiUsage>('/ai/usage').then(setUsage).catch(() => {});
  }, [mode]);

  async function choose(source: 'camera' | 'library') {
    if (busy) return;
    setError('');
    try {
      const p = await pickPhoto(source);
      if (p) {
        setPhoto(p);
        setResult(null);
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function analyze() {
    setBusy(true);
    setError('');
    try {
      const r = await api<FoodDraft & { scansLeft: number }>('/ai/analyze', {
        method: 'POST',
        body: { image: mode === 'scan' ? photo?.image : undefined, description },
      });
      setResult({
        ...r,
        image: mode === 'scan' ? photo?.thumb : undefined,
        source: mode === 'scan' ? 'ai-photo' : 'ai-text',
      });
      setUsage((u) => u && { ...u, left: r.scansLeft });
    } catch (err) {
      setError((err as Error).message);
      api<AiUsage>('/ai/usage').then(setUsage).catch(() => {});
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: TITLES[mode] }} />
      <Screen edges={['bottom']}>
        {date !== dateStr() && <Txt variant="small" muted>Logging for {date}</Txt>}

        {result ? (
          <>
            {mode !== 'manual' && (
              <Button title="↺ Re-analyze" variant="secondary" small style={{ alignSelf: 'flex-start' }} onPress={() => setResult(null)} />
            )}
            <FoodEditor initial={result} date={date} onSaved={() => router.back()} />
          </>
        ) : (
          <>
            {mode === 'scan' && (
              <>
                <Pressable
                  onPress={() => choose('camera')}
                  disabled={busy}
                  accessibilityLabel="Take a photo of your meal"
                  style={[styles.dropzone, { borderColor: c.line, backgroundColor: c.card }]}>
                  {photo ? (
                    <Image source={{ uri: photo.image }} style={StyleSheet.absoluteFill} contentFit="cover" />
                  ) : (
                    <>
                      <Txt style={{ fontSize: 48 }}>📸</Txt>
                      <Txt bold>Take a photo</Txt>
                      <Txt variant="small" muted>Make sure the whole plate is visible</Txt>
                    </>
                  )}
                  {busy && (
                    <View style={[StyleSheet.absoluteFill, styles.scanning]}>
                      <ActivityIndicator color="#fff" size="large" />
                    </View>
                  )}
                </Pressable>
                <Row style={{ justifyContent: 'center' }}>
                  {photo && <Button title="Retake" variant="secondary" small disabled={busy} onPress={() => choose('camera')} />}
                  <Button title="Choose from gallery" variant="secondary" small disabled={busy} onPress={() => choose('library')} />
                </Row>
              </>
            )}

            <Input
              multiline
              style={{ height: mode === 'describe' ? 120 : 76, paddingTop: 14, textAlignVertical: 'top' }}
              placeholder={
                mode === 'describe'
                  ? 'e.g. 2 scrambled eggs, 2 slices of whole wheat toast with butter, and a black coffee'
                  : "Optional: add details (e.g. 'cooked in olive oil', 'large portion')"
              }
              maxLength={500}
              value={description}
              onChangeText={setDescription}
            />

            <ErrorText>{error}</ErrorText>

            <Button
              title={busy ? 'Analyzing…' : '✨ Analyze with AI'}
              busy={busy}
              disabled={mode === 'scan' ? !photo : !description.trim()}
              onPress={analyze}
            />

            {usage && (
              <Txt variant="small" muted center>
                {!usage.enabled
                  ? "AI scanning isn't set up on the server yet. You can still add food manually."
                  : `${usage.left} of ${usage.limit} AI scans left today`}
              </Txt>
            )}
            {usage && (usage.left === 0 || !usage.enabled) && (
              <Button
                title="Add manually instead"
                variant="secondary"
                onPress={() => router.replace({ pathname: '/add/[mode]', params: { mode: 'manual', date } })}
              />
            )}
          </>
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  dropzone: {
    height: 280,
    borderRadius: 24,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    overflow: 'hidden',
  },
  scanning: { backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
});
