'use client';

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { themes, getTheme, type StudioTheme } from '@/lib/studio-themes';
import './studio-appearance.css';

const preferenceKey = 'bramble-petal-studio-appearance-v1';
const isTheme = (value: string | null): value is string => themes.some(theme => theme.id === value);

function appearanceStyle(theme: StudioTheme): CSSProperties {
  return {
    '--bp-paper': theme.bg, '--bp-white': theme.surface, '--bp-ink': theme.ink,
    '--bp-ink-soft': theme.muted, '--bp-olive': theme.accent, '--bp-olive-light': theme.accent,
    '--bp-cream': theme.soft, '--bp-line': `color-mix(in srgb, ${theme.ink} 20%, ${theme.bg})`,
    '--bp-focus': theme.accent, '--bp-burgundy': theme.accent,
    '--fos-nav': theme.nav, '--fos-nav-ink': theme.navInk, '--fos-on-accent': theme.onAccent,
    '--fos-radius': `${theme.radius}px`, '--fos-font': theme.font,
  } as CSSProperties;
}

export default function StudioAppearance({ children }: { children: ReactNode }) {
  const [themeId, setThemeId] = useState<string>('original');
  const [storageMessage, setStorageMessage] = useState('Design preference is saved on this device.');
  useEffect(() => {
    try {
      const saved = localStorage.getItem(preferenceKey);
      if (isTheme(saved)) setThemeId(saved);
    } catch {
      setStorageMessage('Device storage is unavailable. You can still change the design for this visit.');
    }
  }, []);
  const theme = isTheme(themeId) ? getTheme(themeId) : null;
  function choose(value: string) {
    if (value !== 'original' && !isTheme(value)) return;
    setThemeId(value);
    try {
      if (value === 'original') localStorage.removeItem(preferenceKey);
      else localStorage.setItem(preferenceKey, value);
      setStorageMessage('Design preference is saved on this device.');
    } catch {
      setStorageMessage('Design changed for this visit. Device storage is unavailable.');
    }
  }
  return <div className={`fos-appearance${theme ? ' fos-themed' : ''}`} data-studio-theme={theme?.id} data-studio-layout={theme?.layout} style={theme ? appearanceStyle(theme) : undefined}>
    <section className="fos-appearance-bar" aria-label="Studio appearance">
      <label htmlFor="fos-studio-theme">Your studio, your style</label>
      <select id="fos-studio-theme" value={themeId} onChange={event => choose(event.target.value)}>
        <option value="original">Current Bramble & Petal design</option>
        {themes.map(item => <option key={item.id} value={item.id}>{item.name} · {item.category}</option>)}
      </select>
      <span className="fos-appearance-description">{theme?.description || 'Your existing studio, exactly as you know it.'}</span>
      <button type="button" onClick={() => choose('original')} disabled={!theme}>Reset design</button>
      <small aria-live="polite">{storageMessage}</small>
    </section>
    {children}
  </div>;
}
