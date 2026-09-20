import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site-seo';
export default function robots(): MetadataRoute.Robots {
  // Private pages carry noindex and require authentication. Allow crawlers to read
  // that directive rather than leaving blocked URLs eligible for URL-only results.
  return { rules: { userAgent: '*', allow: '/', disallow: ['/api/'] }, sitemap: `${SITE_URL}/sitemap.xml` };
}
