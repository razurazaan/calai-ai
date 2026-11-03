import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { RADIUS, useColors } from '@/lib/theme';

// ---- Text -------------------------------------------------------------------------------
type TxtProps = TextProps & {
  variant?: 'h1' | 'h2' | 'h3' | 'body' | 'small';
  muted?: boolean;
  bold?: boolean;
  center?: boolean;
  color?: string;
};

export function Txt({ variant = 'body', muted, bold, center, color, style, ...rest }: TxtProps) {
  const c = useColors();
  return (
    <Text
      style={[
        text[variant],
        { color: color ?? (muted ? c.muted : c.text) },
        bold && { fontWeight: '700' },
        center && { textAlign: 'center' },
        style,
      ]}
      {...rest}
    />
  );
}

const text = StyleSheet.create({
  h1: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
  h2: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
  h3: { fontSize: 16, fontWeight: '700' },
  body: { fontSize: 16 },
  small: { fontSize: 13 },
});

// ---- Layout -----------------------------------------------------------------------------
type ScreenProps = {
  children: ReactNode;
  edges?: Edge[];
  bottomInset?: number;
  contentStyle?: StyleProp<ViewStyle>;
  scroll?: boolean;
};

// Page container: safe-area aware, scrollable, centered with a max width on tablets/web
export function Screen({ children, edges = ['top'], bottomInset = 24, contentStyle, scroll = true }: ScreenProps) {
  const c = useColors();
  const inner = [styles.content, { paddingBottom: bottomInset }, contentStyle];
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: c.bg }}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={inner}
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior="automatic">
          {children}
        </ScrollView>
      ) : (
        <View style={[inner, { flex: 1 }]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Row({ children, style, between }: { children: ReactNode; style?: StyleProp<ViewStyle>; between?: boolean }) {
  return <View style={[styles.row, between && { justifyContent: 'space-between' }, style]}>{children}</View>;
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const c = useColors();
  const base = [styles.card, { backgroundColor: c.card }, style];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [base, pressed && { opacity: 0.7 }]}>
      {children}
    </Pressable>
  );
}

export function Dot({ color }: { color: string }) {
  return <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />;
}

// ---- Controls ---------------------------------------------------------------------------
type ButtonProps = {
  title?: string;
  children?: ReactNode;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  small?: boolean;
  disabled?: boolean;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({ title, children, onPress, variant = 'primary', small, disabled, busy, style }: ButtonProps) {
  const c = useColors();
  const bg = variant === 'primary' ? c.primary : variant === 'secondary' ? c.soft : 'transparent';
  const fg = variant === 'primary' ? c.onPrimary : variant === 'secondary' ? c.text : c.danger;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [
        styles.btn,
        small ? styles.btnSm : { alignSelf: 'stretch' },
        { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.8 : 1 },
        pressed && { transform: [{ scale: 0.98 }] },
        style,
      ]}>
      {busy && <ActivityIndicator color={fg} />}
      {title != null && (
        <Text style={{ color: fg, fontWeight: '600', fontSize: small ? 14 : 16 }}>{title}</Text>
      )}
      {children}
    </Pressable>
  );
}

export function Input({ style, ...rest }: TextInputProps & { style?: StyleProp<TextStyle> }) {
  const c = useColors();
  return (
    <TextInput
      placeholderTextColor={c.muted}
      style={[styles.input, { backgroundColor: c.card, borderColor: c.line, color: c.text }, style]}
      {...rest}
    />
  );
}

export function Field({ label, children, style }: { label: ReactNode; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ gap: 6 }, style]}>
      {typeof label === 'string' ? <Txt variant="small" muted bold>{label}</Txt> : label}
      {children}
    </View>
  );
}

// Segmented control (the web app's `.tabs`)
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  style,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  return (
    <View style={[styles.segmented, { backgroundColor: c.soft }, style]}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => onChange(o.value)}
            style={[styles.segment, active && { backgroundColor: c.card }]}>
            <Text style={{ color: active ? c.text : c.muted, fontWeight: '600', fontSize: 13 }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// Big selectable option (onboarding)
export function Choice({ title, subtitle, active, onPress }: { title: string; subtitle?: string; active: boolean; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.choice,
        { backgroundColor: active ? c.primary : c.card, borderColor: active ? c.primary : c.line },
      ]}>
      <Text style={{ color: active ? c.onPrimary : c.text, fontWeight: '600', fontSize: 16 }}>{title}</Text>
      {subtitle && (
        <Text style={{ color: active ? c.onPrimary : c.muted, opacity: active ? 0.8 : 1, fontSize: 13, marginTop: 2 }}>
          {subtitle}
        </Text>
      )}
    </Pressable>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  const c = useColors();
  if (!children) return null;
  return (
    <View style={[styles.error, { backgroundColor: c.danger + '1a' }]}>
      <Text style={{ color: c.danger, fontSize: 14 }}>{children}</Text>
    </View>
  );
}

// Thin progress bar
export function Bar({ pct, color, style }: { pct: number; color: string; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return (
    <View style={[styles.bar, { backgroundColor: c.soft }, style]}>
      <View style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: '100%', backgroundColor: color, borderRadius: 4 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12, width: '100%', maxWidth: 520, alignSelf: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  card: { borderRadius: RADIUS, padding: 18 },
  btn: {
    height: 52,
    paddingHorizontal: 22,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  btnSm: { height: 38, paddingHorizontal: 16 },
  input: { height: 52, borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, fontSize: 16 },
  segmented: { flexDirection: 'row', borderRadius: 14, padding: 4, gap: 4 },
  segment: { flex: 1, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  choice: { borderRadius: 18, borderWidth: 1.5, padding: 18 },
  error: { borderRadius: 12, padding: 12 },
  bar: { height: 8, borderRadius: 4, overflow: 'hidden' },
});
