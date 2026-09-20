import Link from 'next/link';
import { breadcrumbSchema, publicPages, type PublicPath } from '@/lib/site-seo';
export function StructuredData({ value }: { value: unknown }) { return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(value).replace(/</g, '\\u003c') }} />; }
export function Breadcrumbs({ path }: { path: PublicPath }) { return <><nav className="public-breadcrumbs public-wrap" aria-label="Breadcrumb"><Link href="/">Home</Link><span aria-hidden="true">/</span><span aria-current="page">{publicPages[path].label}</span></nav><StructuredData value={breadcrumbSchema(path)} /></>; }
