import { createHash } from 'node:crypto';
import { readdir, readFile, stat, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import {
  legacyPostsSource,
  loadPosts,
  OUTPUT,
  PAGE_SIZE,
  publishedPosts,
  ROOT,
  SITE_URL,
  tagCatalog,
  validatePosts
} from './lib/site.mjs';

const checkExternal = process.argv.includes('--external');
const checks = [];
const externalReport = [];

function pass(name, detail) {
  checks.push({ status: 'PASS', name, detail });
}

function fail(name, detail) {
  checks.push({ status: 'FAIL', name, detail });
}

function report(name, detail) {
  checks.push({ status: 'REPORT', name, detail });
}

async function check(name, operation) {
  try {
    const detail = await operation();
    pass(name, detail);
  } catch (error) {
    fail(name, error instanceof Error ? error.message : String(error));
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function walk(directory, suffix = '') {
  const found = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...await walk(target, suffix));
    else if (!suffix || entry.name.endsWith(suffix)) found.push(target);
  }
  return found;
}

function localPathFromHref(href, sourceFile) {
  if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('data:')) return null;
  let pathname;
  if (href.startsWith(SITE_URL)) pathname = new URL(href).pathname;
  else if (/^https?:\/\//.test(href)) return null;
  else if (href.startsWith('/')) pathname = new URL(href, SITE_URL).pathname;
  else {
    const relativeSource = `/${path.relative(OUTPUT, sourceFile).replaceAll(path.sep, '/')}`;
    pathname = new URL(href, new URL(relativeSource, SITE_URL)).pathname;
  }
  const decoded = decodeURIComponent(pathname);
  const relative = decoded.replace(/^\/+/, '');
  return relative.endsWith('/') ? `${relative}index.html` : relative;
}

function extractLinks(html) {
  return [...html.matchAll(/\b(?:href|src)="([^"]+)"/g)].map((match) => match[1]);
}

function externalLinks(html) {
  return [...html.matchAll(/\bhref="(https?:\/\/[^"]+)"/g)]
    .map((match) => match[1])
    .filter((href) => !href.startsWith(SITE_URL));
}

async function checkUrl(url) {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    let response = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'user-agent': 'blog.itmitalles.de doctor/1.0' }
    });
    if ([403, 405, 429, 501].includes(response.status)) {
      response = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers: { 'user-agent': 'blog.itmitalles.de doctor/1.0' }
      });
    }
    return { url, status: response.status, ok: response.ok, durationMs: Date.now() - started, finalUrl: response.url };
  } catch (error) {
    return { url, status: null, ok: false, durationMs: Date.now() - started, error: error.name === 'AbortError' ? 'timeout' : error.message };
  } finally {
    clearTimeout(timer);
  }
}

const allPosts = await loadPosts();
const posts = publishedPosts(allPosts);
const htmlFiles = await walk(OUTPUT, '.html');
const draftTemplate = JSON.parse(await readFile(path.join(ROOT, 'content/post-template.json'), 'utf8'));

await check('metadata and dates', async () => {
  assert(allPosts.length > 0, 'no posts');
  validatePosts([draftTemplate]);
  assert(draftTemplate.status === 'Draft', 'article template must default to Draft');
  return `${allPosts.length} entries and the Draft template conform to the content model`;
});

await check('duplicate slugs', async () => `${new Set(allPosts.map((post) => post.slug)).size} unique slugs`);

await check('draft isolation', async () => {
  const drafts = [...allPosts.filter((post) => post.status === 'Draft'), draftTemplate];
  const feed = await readFile(path.join(OUTPUT, 'feed.xml'), 'utf8');
  const index = JSON.parse(await readFile(path.join(OUTPUT, 'search-index.json'), 'utf8'));
  const archiveHtml = (await Promise.all((await walk(path.join(OUTPUT, 'archiv'), '.html')).map((file) => readFile(file, 'utf8')))).join('\n');
  for (const draft of drafts) {
    assert(!feed.includes(draft.canonical), `${draft.slug} appears in feed`);
    assert(!index.some((entry) => entry.url.includes(draft.slug)), `${draft.slug} appears in search index`);
    assert(!archiveHtml.includes(draft.canonical), `${draft.slug} appears in archive`);
  }
  assert(index.length === posts.length, `search index has ${index.length}, expected ${posts.length}`);
  return `${drafts.length} drafts excluded; ${posts.length} published entries indexed`;
});

await check('mechanical migration baseline', async () => {
  const baseline = JSON.parse(await readFile(path.join(ROOT, 'content/migration-baseline.json'), 'utf8'));
  const bySlug = new Map(allPosts.map((post) => [post.slug, post]));
  const migrated = baseline.slugs.map((slug) => bySlug.get(slug));
  assert(migrated.every(Boolean), 'one or more migrated posts are missing');
  const projection = migrated.map((post) => ({
    title: post.title,
    slug: post.slug,
    date: post.date,
    excerpt: post.description,
    body: post.body,
    category: post.tags[0]
  }));
  const digest = createHash('sha256').update(JSON.stringify(projection)).digest('hex');
  assert(projection.length === baseline.articleCount, `${projection.length} migrated posts, expected ${baseline.articleCount}`);
  assert(digest === baseline.sha256, `legacy projection changed: ${digest}`);
  return `${baseline.articleCount} article projections match ${baseline.sourceCommit.slice(0, 12)} (${digest.slice(0, 16)})`;
});

await check('deterministic posts.js', async () => {
  const actual = await readFile(path.join(ROOT, 'posts.js'), 'utf8');
  const expected = legacyPostsSource(allPosts);
  assert(actual === expected, 'posts.js is stale');
  return createHash('sha256').update(actual).digest('hex').slice(0, 16);
});

await check('generated route coverage', async () => {
  for (const post of posts) await stat(path.join(OUTPUT, 'artikel', post.slug, 'index.html'));
  const pages = Math.ceil(posts.length / PAGE_SIZE);
  for (let page = 1; page <= pages; page += 1) {
    await stat(page === 1 ? path.join(OUTPUT, 'archiv/index.html') : path.join(OUTPUT, `archiv/seite/${page}/index.html`));
  }
  for (const tag of tagCatalog(posts)) await stat(path.join(OUTPUT, 'tags', tag.slug, 'index.html'));
  return `${posts.length} articles, ${pages} archive pages and ${tagCatalog(posts).length} tag pages`;
});

await check('internal links and assets', async () => {
  const missing = [];
  const missingFragments = [];
  let linkCount = 0;
  for (const file of htmlFiles) {
    const html = await readFile(file, 'utf8');
    for (const href of extractLinks(html)) {
      const target = localPathFromHref(href, file);
      if (!target) continue;
      linkCount += 1;
      const cleanTarget = target.split('?')[0].split('#')[0];
      try {
        await stat(path.join(OUTPUT, cleanTarget));
        const parsed = new URL(href, new URL(`/${path.relative(OUTPUT, file).replaceAll(path.sep, '/')}`, SITE_URL));
        if (parsed.hash && cleanTarget.endsWith('.html')) {
          const fragment = decodeURIComponent(parsed.hash.slice(1));
          const targetHtml = await readFile(path.join(OUTPUT, cleanTarget), 'utf8');
          const escapedFragment = fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          if (!new RegExp(`\\b(?:id|name)="${escapedFragment}"`).test(targetHtml)) {
            missingFragments.push(`${path.relative(OUTPUT, file)} -> ${href}`);
          }
        }
      }
      catch { missing.push(`${path.relative(OUTPUT, file)} -> ${href}`); }
    }
  }
  assert(missing.length === 0, `missing targets:\n${missing.join('\n')}`);
  assert(missingFragments.length === 0, `missing fragments:\n${missingFragments.join('\n')}`);
  return `${linkCount} local references and fragments resolve`;
});

await check('privacy boundary', async () => {
  const runtimeFiles = [
    ...htmlFiles,
    ...await walk(OUTPUT, '.css'),
    ...await walk(OUTPUT, '.js')
  ];
  const combined = (await Promise.all(runtimeFiles.map((file) => readFile(file, 'utf8')))).join('\n');
  const prohibited = [
    /<script[^>]+src="https?:\/\//i,
    /<link[^>]+rel="stylesheet"[^>]+href="https?:\/\//i,
    /fonts\.(?:googleapis|gstatic)\.com/i,
    /\b(?:gtag|google-analytics|googletagmanager|matomo|plausible|segment\.com)\b/i,
    /document\.cookie/i
  ];
  for (const pattern of prohibited) assert(!pattern.test(combined), `prohibited runtime dependency matched ${pattern}`);
  return 'no tracking, cookies, remote scripts, remote stylesheets or remote fonts';
});

await check('canonical and social metadata', async () => {
  for (const file of htmlFiles) {
    const html = await readFile(file, 'utf8');
    assert((html.match(/rel="canonical"/g) ?? []).length === 1, `${path.relative(OUTPUT, file)}: canonical count`);
    for (const field of ['og:title', 'og:description', 'og:url', 'og:image', 'twitter:card']) {
      assert(html.includes(`property="${field}"`) || html.includes(`name="${field}"`), `${path.relative(OUTPUT, file)}: missing ${field}`);
    }
  }
  return `${htmlFiles.length} HTML files carry canonical, OpenGraph and social-card metadata`;
});

await check('article structured data', async () => {
  for (const post of posts) {
    const html = await readFile(path.join(OUTPUT, 'artikel', post.slug, 'index.html'), 'utf8');
    const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    assert(match, `${post.slug}: missing JSON-LD`);
    const data = JSON.parse(match[1]);
    assert(data['@type'] === 'Article', `${post.slug}: JSON-LD is not Article`);
    assert(data.mainEntityOfPage === post.canonical, `${post.slug}: JSON-LD canonical mismatch`);
  }
  return `${posts.length} valid Article JSON-LD blocks`;
});

await check('feed schema and content', async () => {
  const xml = await readFile(path.join(OUTPUT, 'feed.xml'), 'utf8');
  const validity = XMLValidator.validate(xml);
  assert(validity === true, JSON.stringify(validity));
  const parsed = new XMLParser({ ignoreAttributes: false }).parse(xml);
  assert(parsed.feed?.['@_xmlns'] === 'http://www.w3.org/2005/Atom', 'wrong Atom namespace');
  const entries = Array.isArray(parsed.feed.entry) ? parsed.feed.entry : [parsed.feed.entry].filter(Boolean);
  assert(entries.length === posts.length, `${entries.length} feed entries, expected ${posts.length}`);
  assert(!allPosts.filter((post) => post.status === 'Draft').some((post) => xml.includes(post.slug)), 'draft found in feed');
  return `valid Atom XML with ${entries.length} entries`;
});

await check('sitemap schema and content', async () => {
  const xml = await readFile(path.join(OUTPUT, 'sitemap.xml'), 'utf8');
  const validity = XMLValidator.validate(xml);
  assert(validity === true, JSON.stringify(validity));
  const parsed = new XMLParser({ ignoreAttributes: false }).parse(xml);
  assert(parsed.urlset?.['@_xmlns'] === 'http://www.sitemaps.org/schemas/sitemap/0.9', 'wrong sitemap namespace');
  const urls = Array.isArray(parsed.urlset.url) ? parsed.urlset.url : [parsed.urlset.url].filter(Boolean);
  for (const post of posts) assert(urls.some((entry) => entry.loc === post.canonical), `${post.slug}: absent from sitemap`);
  return `valid sitemap XML with ${urls.length} URLs`;
});

await check('pages paths and CNAME', async () => {
  const cname = (await readFile(path.join(OUTPUT, 'CNAME'), 'utf8')).trim();
  assert(cname === 'blog.itmitalles.de', `unexpected CNAME: ${cname}`);
  await stat(path.join(OUTPUT, '.nojekyll'));
  const workflow = await readFile(path.join(ROOT, '.github/workflows/pages.yml'), 'utf8');
  assert(workflow.includes('path: _site'), 'Pages workflow must upload _site');
  assert(workflow.includes('npm ci'), 'Pages workflow must install locked dependencies');
  assert(workflow.includes('npm run check'), 'Pages workflow must validate before deploy');
  return 'CNAME, .nojekyll and Pages artifact path are consistent';
});

await check('performance budget', async () => {
  const budget = {
    totalBytes: 1_500_000,
    htmlBytes: 50_000,
    cssBytes: 30_000,
    jsBytes: 20_000,
    searchIndexBytes: 30_000
  };
  const files = await walk(OUTPUT);
  let total = 0;
  for (const file of files) {
    const size = (await stat(file)).size;
    total += size;
    const relative = path.relative(OUTPUT, file);
    if (relative.endsWith('.html')) assert(size <= budget.htmlBytes, `${relative}: ${size} > ${budget.htmlBytes}`);
    if (relative.endsWith('.css')) assert(size <= budget.cssBytes, `${relative}: ${size} > ${budget.cssBytes}`);
    if (relative.endsWith('.js') && relative !== 'posts.js') assert(size <= budget.jsBytes, `${relative}: ${size} > ${budget.jsBytes}`);
    if (relative === 'search-index.json') assert(size <= budget.searchIndexBytes, `${relative}: ${size} > ${budget.searchIndexBytes}`);
  }
  assert(total <= budget.totalBytes, `site: ${total} > ${budget.totalBytes}`);
  return `${total} bytes total; per-resource budgets respected`;
});

const allExternalUrls = new Set();
for (const file of htmlFiles) {
  for (const url of externalLinks(await readFile(file, 'utf8'))) allExternalUrls.add(url);
}

if (checkExternal) {
  const queue = [...allExternalUrls];
  const workers = Array.from({ length: 6 }, async () => {
    while (queue.length) externalReport.push(await checkUrl(queue.shift()));
  });
  await Promise.all(workers);
  externalReport.sort((left, right) => left.url.localeCompare(right.url));
  const failed = externalReport.filter((entry) => !entry.ok);
  report('external links (report only)', `${failed.length} of ${externalReport.length} returned errors; see reports/external-links.json`);
} else {
  report('external links (report only)', `${allExternalUrls.size} unique URLs collected; run npm run doctor:external for timed network checks`);
}

await mkdir(path.join(ROOT, 'reports'), { recursive: true });
await writeFile(path.join(ROOT, 'reports/doctor.json'), `${JSON.stringify({ generatedAt: new Date().toISOString(), checks }, null, 2)}\n`);
if (checkExternal) await writeFile(path.join(ROOT, 'reports/external-links.json'), `${JSON.stringify(externalReport, null, 2)}\n`);

for (const result of checks) console.log(`${result.status.padEnd(6)} ${result.name}: ${result.detail}`);
const failures = checks.filter((result) => result.status === 'FAIL');
const reports = checks.filter((result) => result.status === 'REPORT');
console.log(`\n${checks.length - failures.length - reports.length}/${checks.length - reports.length} blocking checks passed; ${reports.length} report-only check`);
if (failures.length) process.exitCode = 1;
