'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function StudioLoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const signIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true); setError('');
    try {
      const response = await fetch('/api/studio/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || 'Sign-in was not successful.');
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Sign-in was not successful.');
    } finally {
      setSubmitting(false);
    }
  };

  return <main className="login-screen">
    <form className="panel-form login-form" onSubmit={signIn}>
      <p className="eyebrow">BRAMBLE &amp; PETAL</p>
      <h1>Studio Hub</h1>
      <p className="login-intro">Sign in to manage your flowers, plans and clients.</p>
      <label>Username<input value={username} onChange={event => setUsername(event.target.value)} autoComplete="username" required /></label>
      <label>Password<input value={password} onChange={event => setPassword(event.target.value)} type="password" autoComplete="current-password" required /></label>
      <button className="button" disabled={submitting}>{submitting ? 'Signing in…' : 'Sign in'}</button>
      {error && <p className="form-error" role="alert">{error}</p>}
    </form>
  </main>;
}
