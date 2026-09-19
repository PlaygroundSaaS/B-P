import Image from 'next/image';
import type { ReactNode } from 'react';

export type IconName = 'home' | 'calendar' | 'clients' | 'events' | 'flower' | 'orders' | 'suppliers' | 'finance' | 'studio' | 'plus' | 'arrow' | 'delivery' | 'waste' | 'check';
const paths: Record<IconName, string> = {
  home: 'M3 10 12 3l9 7M5 9v12h5v-7h4v7h5V9',
  calendar: 'M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2ZM7 3v4m10-4v4M3 10h18M7 14h2m4 0h2m-8 4h2',
  clients: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm8-7a4 4 0 0 1 0 8m5 9v-2a4 4 0 0 0-3-4',
  events: 'M12 21s-9-5.5-9-12a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6.5-9 12-9 12Z',
  flower: 'M12 21v-7m0 5c-5 0-7-2-7-5 4 0 7 2 7 5Zm0-3c4 0 7-2 7-5-4 0-7 2-7 5ZM12 3c-5-4-7 3-4 5-5 2-1 7 2 5 1 4 6 3 5-1 5 0 6-6 1-7 1-3-3-5-4-2Z',
  orders: 'M5 3h14v18H5ZM8 7h8M8 11h8M8 15h5',
  suppliers: 'M3 8 12 3l9 5v11l-9 3-9-3ZM3 8l9 4 9-4M12 12v10m-5-17 10 5',
  finance: 'M3 21h18M6 17V9m6 8V3m6 14v-6',
  studio: 'M3 9h18L19 3H5ZM5 9v12h14V9m-9 12v-7h4v7',
  plus: 'M12 5v14M5 12h14', arrow: 'M4 12h16m-6-6 6 6-6 6',
  delivery: 'M1 5h13v12H1Zm13 5h5l4 4v3h-9M5 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm14 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
  waste: 'M5 7h14m-12 0 1 14h8l1-14M9 7V3h6v4m-4 4v6m3-6v6', check: 'm5 12 4 4L19 6',
};
export function StudioIcon({ name }: { name: IconName }) { return <svg className="atelier-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>; }
export function StudioBrand() { return <Image className="atelier-logo" src="/assets/brand-logo.png" alt="Bramble & Petal Florist Studio" width={170} height={138} priority />; }
export function SectionHeading({ title, action }: { title: string; action?: ReactNode }) { return <div className="atelier-section-heading"><h2>{title}</h2>{action}</div>; }
export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) { return <div className="atelier-empty"><StudioIcon name="flower" /><h3>{title}</h3>{children && <p>{children}</p>}{action}</div>; }
export function SummaryCard({ icon, value, label, detail, onClick }: { icon: IconName; value: number; label: string; detail: string; onClick: () => void }) { return <button type="button" className="atelier-summary" onClick={onClick}><StudioIcon name={icon} /><span><strong>{value}</strong><b>{label}</b><small>{detail}</small></span></button>; }
export function QuickAction({ icon, label, onClick }: { icon: IconName; label: string; onClick: () => void }) { return <button type="button" className="atelier-quick-action" onClick={onClick}><StudioIcon name={icon} /><span>{label}</span></button>; }
