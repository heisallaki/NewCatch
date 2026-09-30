const fs = require('fs');
const path = require('path');

const site = (process.env.EXPO_PUBLIC_SITE_URL || 'http://localhost:8081').replace(/\/$/, '');
const pages = [
  '/',
  '/policies',
  '/policies/privacy',
  '/policies/terms',
  '/policies/community-guidelines',
  '/policies/safety',
  '/policies/reporting-and-appeals',
  '/policies/contact',
];
const today = new Date().toISOString().slice(0, 10);

const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...pages.map(
    (page) => `  <url><loc>${site}${page === '/' ? '/' : page}</loc><lastmod>${today}</lastmod></url>`
  ),
  '</urlset>',
  '',
].join('\n');

const robots = ['User-agent: *', 'Allow: /', 'Disallow: /member/', '', `Sitemap: ${site}/sitemap.xml`, ''].join('\n');

const publicDir = path.join(__dirname, '..', 'public');
fs.mkdirSync(publicDir, { recursive: true });
fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), sitemap);
fs.writeFileSync(path.join(publicDir, 'robots.txt'), robots);
console.log(`Generated sitemap.xml and robots.txt for ${site}`);