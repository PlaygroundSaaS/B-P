import type { MetadataRoute } from 'next';
export default function sitemap(): MetadataRoute.Sitemap { return ['', '/weddings', '/funerals', '/corporate', '/flowers', '/our-studio', '/client-studio', '/contact', '/privacy'].map(path=>({url:`https://www.bramblesandpetals.co.uk${path}`,changeFrequency:'monthly',priority:path ? 0.7 : 1})); }
