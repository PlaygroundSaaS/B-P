'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

export default function Dialog({ children, className, label, onClose }: { children: ReactNode; className: string; label: string; onClose: () => void }) {
  const [saveError, setSaveError] = useState('');
  useEffect(() => { const receive = (event: Event) => setSaveError(String((event as CustomEvent).detail || '')); window.addEventListener('studio-save-error', receive); return () => window.removeEventListener('studio-save-error', receive); }, []);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    const trigger = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    element?.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      element?.close();
      document.body.style.overflow = overflow;
      trigger?.focus({ preventScroll: true });
    };
  }, []);
  return <dialog ref={dialog} className={className} aria-label={label} onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>{saveError && <p role="alert" className="ops-warning">{saveError}</p>}{children}</dialog>;
}
