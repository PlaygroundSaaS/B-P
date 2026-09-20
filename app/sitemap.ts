import type { MetadataRoute } from 'next';
import { SITE_URL, publicPages } from '@/lib/site-seo';
export default function sitemap(): MetadataRoute.Sitemap {
  return Object.entries(publicPages).map(([path, page]) => ({ url: `${SITE_URL}${path === '/' ? '/' : path}`, images: [`${SITE_URL}${page.image}`] }));
}
