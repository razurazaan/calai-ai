import { useState } from 'react';
import { View } from 'react-native';

import { Button, ErrorText, Input, Screen, Segmented, Txt } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { User } from '@/lib/types';

type Mode = 'login' | 'register';

export default function Login() {
  const { login } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit() {
    if (!form.email.trim() || !form.password || (mode === 'register' && !form.name.trim())) {
      return setError('Please fill in all fields');
    }
    if (form.password.length < 6) return setError('Password must be at least 6 characters');
    setError('');
    setBusy(true);
    try {
      const { token, user } = await api<{ token: string; user: User }>(`/auth/${mode}`, {
        method: 'POST',
        body: { ...form, email: form.email.trim() },
      });
      await login(token, user);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Screen edges={['top', 'bottom']} contentStyle={{ flexGrow: 1, justifyContent: 'center' }}>
      <View style={{ alignItems: 'center', marginBottom: 20 }}>
        <Txt style={{ fontSize: 56 }}>🍎</Txt>
        <Txt variant="h1">CalSnap</Txt>
        <Txt muted style={{ marginTop: 6 }}>Snap a photo. Know your calories.</Txt>
      </View>

      <Segmented
        options={[
          { value: 'login', label: 'Log in' },
          { value: 'register', label: 'Sign up' },
        ]}
        value={mode}
        onChange={(m) => {
          setMode(m);
          setError('');
        }}
        style={{ marginBottom: 6 }}
      />

      {mode === 'register' && (
        <Input placeholder="Your name" value={form.name} onChangeText={set('name')} textContentType="name" autoComplete="name" />
      )}
      <Input
        placeholder="Email"
        value={form.email}
        onChangeText={set('email')}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
      />
      <Input
        placeholder="Password"
        value={form.password}
        onChangeText={set('password')}
        secureTextEntry
        autoCapitalize="none"
        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
        textContentType={mode === 'login' ? 'password' : 'newPassword'}
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      <ErrorText>{error}</ErrorText>
      <Button title={mode === 'login' ? 'Log in' : 'Create account'} busy={busy} onPress={submit} />
    </Screen>
  );
}
