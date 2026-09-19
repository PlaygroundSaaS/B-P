import type { MetadataRoute } from 'next';
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: '*', allow: '/', disallow: ['/studio', '/api/', '/client$', '/client?', '/review'] }, sitemap: 'https://www.bramblesandpetals.co.uk/sitemap.xml' };
}
