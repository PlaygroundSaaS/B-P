'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { StudioBrand } from './design-system';

export default function StudioLoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
      setSubmitting(false);
    }
  };

  return <main className="login-screen atelier-login"><div className="atelier-login-photo"><span>Flowers for life’s<br /><em>most beautiful moments.</em></span></div>
    <form className="panel-form login-form" onSubmit={signIn}>
      <a className="studio-home-link" href="/">← Back to the website</a><StudioBrand /><p className="eyebrow">WELCOME TO YOUR STUDIO</p>
      <h1>Beautiful beginnings.</h1>
      <p className="login-intro">A calm space for your flowers, your clients and everything in between.</p>
      <fieldset className="login-fields" disabled={submitting}><label>Username<input value={username} onChange={event => setUsername(event.target.value)} autoComplete="username" required /></label>
      <label>Password<input value={password} onChange={event => setPassword(event.target.value)} type={showPassword ? "text" : "password"} autoComplete="current-password" required /></label>
      <button type="button" className="password-toggle" aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}>{showPassword ? 'Hide password' : 'Show password'}</button>
      <button type="submit" className="button" disabled={submitting}>{submitting ? 'Signing in…' : 'Enter the Studio →'}</button></fieldset>
      {error && <p className="form-error" role="alert">{error}</p>}
    </form>
  </main>;
}

