import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  atomDate,
  escapeHtml,
  escapeXml,
  formatDate,
  legacyPostsSource,
  loadPosts,
  OUTPUT,
  PAGE_SIZE,
  publishedPosts,
  ROOT,
  SITE_NAME,
  SITE_URL,
  tagCatalog,
  tagSlug
} from './lib/site.mjs';

const includeDrafts = process.argv.includes('--drafts');
const allPosts = await loadPosts();
const posts = publishedPosts(allPosts);
const tags = tagCatalog(posts);
const latestDate = posts
  .map((post) => post.updated ?? post.date)
  .toSorted()
  .at(-1);

await rm(OUTPUT, { recursive: true, force: true });
await mkdir(OUTPUT, { recursive: true });

async function outputFile(relativePath, contents) {
  const target = path.join(OUTPUT, relativePath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, contents);
}

async function copyAsset(relativePath, destination = relativePath) {
  const target = path.join(OUTPUT, destination);
  await mkdir(path.dirname(target), { recursive: true });
  await copyFile(path.join(ROOT, relativePath), target);
}

function canonicalFor(pathname) {
  return new URL(pathname, SITE_URL).href;
}

function commonHead({ title, description, canonical, type = 'website', image = `${SITE_URL}/social-card.svg` }) {
  const fullTitle = title === SITE_NAME ? title : `${title} – ${SITE_NAME}`;
  return `
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="theme-color" content="#142329">
  <link rel="canonical" href="${escapeHtml(canonical)}">
  <link rel="alternate" type="application/atom+xml" title="${SITE_NAME}" href="${SITE_URL}/feed.xml">
  <meta property="og:locale" content="de_DE">
  <meta property="og:type" content="${type}">
  <meta property="og:site_name" content="${SITE_NAME}">
  <meta property="og:title" content="${escapeHtml(fullTitle)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${escapeHtml(canonical)}">
  <meta property="og:image" content="${escapeHtml(image)}">
  <meta property="og:image:alt" content="it mit alles – persönliche linux-, homelab- und self-hosting-feldnotizen">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(fullTitle)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(image)}">`;
}

function layout({
  title,
  description,
  canonical,
  content,
  bodyClass = '',
  type = 'website',
  extraHead = '',
  robots = 'index,follow',
  inlineScript = ''
}) {
  const fullTitle = title === SITE_NAME ? title : `${title} – ${SITE_NAME}`;
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <script>try{const theme=localStorage.getItem('itmitalles-theme')||(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');document.documentElement.dataset.theme=theme}catch{}</script>
  <title>${escapeHtml(fullTitle)}</title>${commonHead({ title, description, canonical, type })}
  <meta name="robots" content="${robots}">
  <link rel="stylesheet" href="/styles.css">
  <link rel="stylesheet" href="/journal.css">
  <link rel="stylesheet" href="/lowercase.css">
  <link rel="stylesheet" href="/hardening.css">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">${extraHead}
</head>
<body${bodyClass ? ` class="${bodyClass}"` : ''}>
  <a class="skip-link" href="#inhalt">zum inhalt</a>
  <header class="site-header">
    <div class="shell nav-wrap">
      <a class="brand" href="/" aria-label="it mit alles blog – startseite"><span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 44 44"><path d="M7 8h30v28H7z" fill="none" stroke="currentColor" stroke-width="3"></path><path d="M13 15h8M13 22h18M13 29h12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"></path><circle cx="33" cy="15" r="3" fill="currentColor"></circle></svg></span><span>it mit <b>alles</b> blog</span></a>
      <nav class="site-nav" aria-label="hauptnavigation">
        <a href="/archiv/">archiv</a>
        <a href="/tags/">tags</a>
        <a href="/suche/">suche</a>
        <a href="/feed.xml">feed</a>
      </nav>
      <button class="theme-toggle" type="button" aria-label="farbschema wechseln" aria-pressed="false">◐</button>
    </div>
  </header>
  <main id="inhalt">${content}</main>
  <footer>
    <div class="shell footer-grid">
      <a class="brand footer-brand" href="/">it mit <b>alles</b> blog</a>
      <p>persönliche linux-, homelab- und self-hosting-feldnotizen.</p>
      <div><a href="https://itmitalles.de/impressum.html">impressum</a><a href="https://itmitalles.de/datenschutz.html">datenschutz</a></div>
      <small>© 2026 it mit alles</small>
    </div>
  </footer>
  <script type="module" src="/script.js"></script>${inlineScript}
</body>
</html>
`;
}

function tagLinks(post) {
  return post.tags
    .map((tag) => `<a class="tag" href="/tags/${tagSlug(tag)}/">${escapeHtml(tag)}</a>`)
    .join(' ');
}

function postCard(post) {
  return `<article class="article-card">
    <p class="meta"><time datetime="${post.date}">${formatDate(post.date)}</time></p>
    <h2><a href="/artikel/${post.slug}/">${escapeHtml(post.title)}</a></h2>
    <p>${escapeHtml(post.description)}</p>
    <div class="tag-list">${tagLinks(post)}</div>
  </article>`;
}

function postList(postsToRender) {
  return `<div class="article-grid" id="article-grid">${postsToRender.map(postCard).join('\n')}</div>`;
}

function searchBox({ heading = 'lokale suche', intro = 'durchsucht titel, kurzbeschreibungen und tags – vollständig im browser.' } = {}) {
  return `<section class="search-panel" data-search-root>
    <h2>${heading}</h2>
    <p>${intro}</p>
    <form class="search-form" role="search">
      <label for="site-search">suchbegriff</label>
      <div><input id="site-search" name="q" type="search" autocomplete="off" enterkeyhint="search"><button type="submit">suchen</button></div>
    </form>
    <p class="search-status" data-search-status aria-live="polite"></p>
    <div class="search-results" data-search-results></div>
  </section>`;
}

function pagination(page, pageCount) {
  if (pageCount < 2) return '';
  const archivePath = (number) => number === 1 ? '/archiv/' : `/archiv/seite/${number}/`;
  const items = [];
  if (page > 1) items.push(`<a rel="prev" href="${archivePath(page - 1)}">← zurück</a>`);
  for (let number = 1; number <= pageCount; number += 1) {
    if (number === page) items.push(`<span aria-current="page">${number}</span>`);
    else items.push(`<a href="${archivePath(number)}"><span class="visually-hidden">seite </span>${number}</a>`);
  }
  if (page < pageCount) items.push(`<a rel="next" href="${archivePath(page + 1)}">weiter →</a>`);
  return `<nav class="pagination" aria-label="archivseiten">${items.join('')}</nav>`;
}

function decorateExternalLinks(html) {
  return html.replace(/<a href="(https?:\/\/)/g, '<a rel="external noopener" href="$1');
}

function bodyBlock(block) {
  const code = block.match(/^<code>([\s\S]*)<\/code>$/);
  if (code) {
    return `<div class="code-block"><button class="copy-code" type="button">code kopieren</button><pre tabindex="0"><code>${escapeHtml(code[1])}</code></pre></div>`;
  }
  return `<p>${decorateExternalLinks(block)}</p>`;
}

function seriesNavigation(post) {
  if (!post.series) return '';
  const entries = posts
    .filter((candidate) => candidate.series?.slug === post.series.slug)
    .toSorted((left, right) => left.series.position - right.series.position);
  const current = entries.findIndex((candidate) => candidate.slug === post.slug);
  const previous = entries[current - 1];
  const next = entries[current + 1];
  const link = (label, candidate) => candidate
    ? `<a href="/artikel/${candidate.slug}/"><small>${label}</small><span>${escapeHtml(candidate.title)}</span></a>`
    : '<span></span>';
  return `<nav class="series-nav" aria-label="serie ${escapeHtml(post.series.title)}">
    <p>${escapeHtml(post.series.title)} · teil ${post.series.position} von ${entries.length}</p>
    <div>${link('← vorheriger teil', previous)}${link('nächster teil →', next)}</div>
  </nav>`;
}

function articlePage(post, { draft = false } = {}) {
  const modified = post.updated ?? post.date;
  const structured = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: modified,
    inLanguage: 'de-DE',
    keywords: post.tags,
    mainEntityOfPage: post.canonical,
    author: { '@type': 'Person', name: 'Tim', url: 'https://itmitalles.de/' },
    publisher: { '@type': 'Organization', name: 'it mit alles', url: 'https://itmitalles.de/' }
  }).replaceAll('<', '\\u003c');
  const updated = post.updated
    ? ` · aktualisiert <time datetime="${post.updated}">${formatDate(post.updated)}</time>`
    : '';
  const draftNote = draft ? '\n        <p class="draft-note">entwurf · nur lokale vorschau · nicht veröffentlicht</p>' : '';
  const content = `<article class="post" itemscope itemtype="https://schema.org/Article">
    <header class="article-hero">
      <div class="shell">
        <a class="article-back" href="/archiv/">← zum archiv</a>${draftNote}
        <div class="tag-list">${tagLinks(post)}</div>
        <h1 itemprop="headline">${escapeHtml(post.title)}</h1>
        <p class="lead" itemprop="description">${escapeHtml(post.description)}</p>
        <p class="article-meta">veröffentlicht <time itemprop="datePublished" datetime="${post.date}">${formatDate(post.date)}</time>${updated}</p>
      </div>
    </header>
    <div class="article-body" itemprop="articleBody">${post.body.map(bodyBlock).join('\n')}</div>
    <div class="article-tail">${seriesNavigation(post)}</div>
  </article>`;
  const articleHead = `
  <meta property="article:published_time" content="${atomDate(post.date)}">
  <meta property="article:modified_time" content="${atomDate(modified)}">
  ${post.tags.map((tag) => `<meta property="article:tag" content="${escapeHtml(tag)}">`).join('\n  ')}
  <script type="application/ld+json">${structured}</script>`;
  return layout({
    title: post.title,
    description: post.description,
    canonical: post.canonical,
    content,
    bodyClass: 'article-page',
    type: 'article',
    extraHead: articleHead,
    robots: draft ? 'noindex,nofollow' : 'index,follow'
  });
}

const homepageDescription = 'persönliche linux-, homelab- und self-hosting-feldnotizen – statisch, datensparsam und ohne tracking.';
const home = `<section class="hero compact-hero"><div class="shell">
  <p class="eyebrow"><i></i> aus dem echten betrieb</p>
  <h1>linux, homelab und self-hosting ohne hochglanzfilter.</h1>
  <p class="lead">persönliche feldnotizen zu systemen, die ich selbst betreibe, repariere oder gerade erst verstehe.</p>
</div></section>
<div class="shell home-layout">
  ${searchBox()}
  <section class="latest-posts" aria-labelledby="latest-heading">
    <div class="section-heading compact-heading"><h2 id="latest-heading">neueste artikel</h2><a href="/archiv/">alle ${posts.length} im archiv →</a></div>
    ${postList(posts.slice(0, PAGE_SIZE))}
  </section>
  <section class="tag-overview" aria-labelledby="home-tags"><h2 id="home-tags">themen</h2><div class="tag-cloud">${tags.map((tag) => `<a href="/tags/${tag.slug}/">${escapeHtml(tag.name)} <span>${tag.posts.length}</span></a>`).join('')}</div></section>
</div>`;

await outputFile('index.html', layout({
  title: SITE_NAME,
  description: homepageDescription,
  canonical: `${SITE_URL}/`,
  content: home
}));

const pageCount = Math.ceil(posts.length / PAGE_SIZE);
for (let page = 1; page <= pageCount; page += 1) {
  const pathname = page === 1 ? '/archiv/' : `/archiv/seite/${page}/`;
  const start = (page - 1) * PAGE_SIZE;
  const visible = posts.slice(start, start + PAGE_SIZE);
  const previous = page > 1 ? (page === 2 ? '/archiv/' : `/archiv/seite/${page - 1}/`) : null;
  const next = page < pageCount ? `/archiv/seite/${page + 1}/` : null;
  const extraHead = `${previous ? `\n  <link rel="prev" href="${canonicalFor(previous)}">` : ''}${next ? `\n  <link rel="next" href="${canonicalFor(next)}">` : ''}`;
  const archive = `<section class="page-shell shell">
    <header class="page-heading"><p class="eyebrow"><i></i> ${posts.length} feldnotizen</p><h1>archiv</h1><p>chronologisch, seite ${page} von ${pageCount}.</p></header>
    ${postList(visible)}
    ${pagination(page, pageCount)}
  </section>`;
  const target = page === 1 ? 'archiv/index.html' : `archiv/seite/${page}/index.html`;
  await outputFile(target, layout({
    title: page === 1 ? 'archiv' : `archiv – seite ${page}`,
    description: `chronologisches archiv der linux-, homelab- und self-hosting-feldnotizen, seite ${page}.`,
    canonical: canonicalFor(pathname),
    content: archive,
    extraHead
  }));
}

const tagIndex = `<section class="page-shell shell"><header class="page-heading"><p class="eyebrow"><i></i> themen</p><h1>tags</h1><p>alle veröffentlichten artikel nach thema.</p></header><div class="tag-cloud tag-cloud-large">${tags.map((tag) => `<a href="/tags/${tag.slug}/">${escapeHtml(tag.name)} <span>${tag.posts.length}</span></a>`).join('')}</div></section>`;
await outputFile('tags/index.html', layout({
  title: 'tags',
  description: 'alle themen der veröffentlichten linux-, homelab- und self-hosting-feldnotizen.',
  canonical: `${SITE_URL}/tags/`,
  content: tagIndex
}));

for (const tag of tags) {
  const content = `<section class="page-shell shell"><header class="page-heading"><p class="eyebrow"><i></i> tag</p><h1>${escapeHtml(tag.name)}</h1><p>${tag.posts.length} ${tag.posts.length === 1 ? 'artikel' : 'artikel'}.</p></header>${postList(tag.posts)}</section>`;
  await outputFile(`tags/${tag.slug}/index.html`, layout({
    title: `tag: ${tag.name}`,
    description: `${tag.posts.length} feldnotizen zum thema ${tag.name}.`,
    canonical: `${SITE_URL}/tags/${tag.slug}/`,
    content
  }));
}

const searchPage = `<section class="page-shell shell"><header class="page-heading"><p class="eyebrow"><i></i> ohne backend</p><h1>suche</h1><p>der kleine index wird einmal geladen und bleibt im browser. es gehen keine suchbegriffe an einen server.</p></header>${searchBox({ heading: 'artikel durchsuchen', intro: 'titel, kurzbeschreibungen und tags.' })}</section>`;
await outputFile('suche/index.html', layout({
  title: 'suche',
  description: 'lokale browser-suche in den veröffentlichten feldnotizen – ohne tracking und ohne suchbackend.',
  canonical: `${SITE_URL}/suche/`,
  content: searchPage
}));

for (const post of posts) {
  await outputFile(`artikel/${post.slug}/index.html`, articlePage(post));
}

if (includeDrafts) {
  for (const post of allPosts.filter((candidate) => candidate.status === 'Draft')) {
    await outputFile(`entwuerfe/${post.slug}/index.html`, articlePage(post, { draft: true }));
  }
}

const legacyRoutes = Object.fromEntries(posts.map((post) => [post.slug, `/artikel/${post.slug}/`]));
const legacyContent = `<section class="page-shell shell narrow"><h1>artikel öffnen</h1><p id="legacy-status">der alte artikel-link wird auf die kanonische adresse weitergeleitet.</p><p><a href="/archiv/">zum archiv</a></p></section>`;
const legacyScript = `\n  <script>const routes=${JSON.stringify(legacyRoutes)};const slug=new URLSearchParams(location.search).get('post');const target=routes[slug];if(target){location.replace(target+location.hash)}else{document.getElementById('legacy-status').textContent='dieser artikel wurde nicht gefunden.'}</script>`;
await outputFile('artikel/index.html', layout({
  title: 'artikel öffnen',
  description: 'kompatible weiterleitung für ältere artikel-links.',
  canonical: `${SITE_URL}/artikel/`,
  content: legacyContent,
  robots: 'noindex,follow',
  inlineScript: legacyScript
}));

const searchIndex = posts.map((post) => ({
  title: post.title,
  url: `/artikel/${post.slug}/`,
  date: post.date,
  description: post.description,
  tags: post.tags
}));
await outputFile('search-index.json', `${JSON.stringify(searchIndex)}\n`);
await outputFile('posts.js', legacyPostsSource(allPosts));

const feedEntries = posts.map((post) => `  <entry>
    <title>${escapeXml(post.title)}</title>
    <link href="${escapeXml(post.canonical)}"/>
    <id>${escapeXml(post.canonical)}</id>
    <published>${atomDate(post.date)}</published>
    <updated>${atomDate(post.updated ?? post.date)}</updated>
${post.tags.map((tag) => `    <category term="${escapeXml(tag)}"/>`).join('\n')}
    <summary type="html">${escapeXml(post.description)}</summary>
  </entry>`).join('\n');
const feed = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="de">
  <title>${SITE_NAME}</title>
  <subtitle>${escapeXml(homepageDescription)}</subtitle>
  <link href="${SITE_URL}/"/>
  <link rel="self" type="application/atom+xml" href="${SITE_URL}/feed.xml"/>
  <updated>${atomDate(latestDate)}</updated>
  <id>${SITE_URL}/</id>
  <author><name>Tim</name><uri>https://itmitalles.de/</uri></author>
${feedEntries}
</feed>
`;
await outputFile('feed.xml', feed);

const sitemapPages = [
  { url: `${SITE_URL}/`, lastmod: latestDate },
  ...Array.from({ length: pageCount }, (_, index) => ({
    url: index === 0 ? `${SITE_URL}/archiv/` : `${SITE_URL}/archiv/seite/${index + 1}/`,
    lastmod: latestDate
  })),
  { url: `${SITE_URL}/tags/`, lastmod: latestDate },
  ...tags.map((tag) => ({ url: `${SITE_URL}/tags/${tag.slug}/`, lastmod: tag.posts.map((post) => post.updated ?? post.date).toSorted().at(-1) })),
  { url: `${SITE_URL}/suche/`, lastmod: latestDate },
  ...posts.map((post) => ({ url: post.canonical, lastmod: post.updated ?? post.date }))
];
const sitemap = `<?xml version="1.0" encoding="utf-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapPages.map((entry) => `  <url><loc>${escapeXml(entry.url)}</loc><lastmod>${entry.lastmod}</lastmod></url>`).join('\n')}
</urlset>
`;
await outputFile('sitemap.xml', sitemap);
await outputFile('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`);

const notFound = `<section class="page-shell shell narrow"><p class="eyebrow"><i></i> 404</p><h1>hier liegt keine feldnotiz.</h1><p>die adresse stimmt nicht oder der artikel ist noch ein entwurf.</p><p><a class="button" href="/archiv/">zum archiv</a> <a href="/suche/">zur suche</a></p></section>`;
await outputFile('404.html', layout({
  title: 'nicht gefunden',
  description: 'die angeforderte seite wurde nicht gefunden.',
  canonical: `${SITE_URL}/404.html`,
  content: notFound,
  robots: 'noindex,follow'
}));

for (const asset of [
  '.nojekyll',
  'CNAME',
  'archive.css',
  'cards.css',
  'feed.css',
  'favicon.svg',
  'hardening.css',
  'journal.css',
  'lowercase.css',
  'one-column.css',
  'pagination.css',
  'script.js',
  'styles.css',
  'artikel/article.css',
  'artikel/article.js'
]) {
  await copyAsset(asset);
}

await outputFile('social-card.svg', await readFile(path.join(ROOT, 'social-card.svg'), 'utf8'));

console.log(`built ${posts.length} published posts, ${tags.length} tag pages and ${pageCount} archive pages in _site${includeDrafts ? ' (draft preview enabled)' : ''}`);
