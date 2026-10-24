import fs from 'fs';

const html = fs.readFileSync('yassir_tunisia.html', 'utf8');

const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
console.log('Title:', titleMatch ? titleMatch[1].trim() : 'N/A');

const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
console.log('Meta Description:', descMatch ? descMatch[1].trim() : 'N/A');

// Extract all Headings
const headings = [...html.matchAll(/<h([1-4])[^>]*>([\s\S]*?)<\/h\1>/gi)].map(m => {
  return `${m[1]}: ${m[2].replace(/<[^>]+>/g, '').trim()}`;
});
console.log('\n--- Headings ---');
headings.slice(0, 30).forEach(h => console.log(' -', h));

// Extract all service descriptions & feature blocks
const paragraphs = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map(m => {
  return m[1].replace(/<[^>]+>/g, '').trim();
}).filter(p => p.length > 30);
console.log('\n--- Key Paragraphs & Value Props ---');
paragraphs.slice(0, 15).forEach(p => console.log(' *', p));

// Extract app download links
const appLinks = [...html.matchAll(/href=["']([^"']+)["']/gi)]
  .map(m => m[1])
  .filter(l => l.includes('play.google.com') || l.includes('apps.apple.com') || l.includes('appgallery') || l.includes('express'));
console.log('\n--- App & Service Links ---');
[...new Set(appLinks)].forEach(l => console.log(' ->', l));
