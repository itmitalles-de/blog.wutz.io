import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const OUTPUT = path.join(ROOT, '_site');
export const SITE_URL = 'https://blog.itmitalles.de';
export const SITE_NAME = 'it mit alles blog';
export const PAGE_SIZE = 10;

const POST_FIELDS = new Set([
  'title',
  'slug',
  'date',
  'updated',
  'description',
  'tags',
  'status',
  'canonical',
  'series',
  'body'
]);
const SERIES_FIELDS = new Set(['slug', 'title', 'position']);
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function fail(message) {
  throw new Error(`content validation: ${message}`);
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requireNonEmptyString(value, field, slug = 'unknown') {
  if (typeof value !== 'string' || value.trim() === '') {
    fail(`${slug}: ${field} must be a non-empty string`);
  }
}

function isValidDate(value) {
  if (!DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function validatePost(post, index) {
  if (!isPlainObject(post)) fail(`entry ${index + 1} must be an object`);

  const unknown = Object.keys(post).filter((key) => !POST_FIELDS.has(key));
  if (unknown.length) fail(`entry ${index + 1}: unknown field(s): ${unknown.join(', ')}`);

  for (const field of ['title', 'slug', 'date', 'description', 'status', 'canonical']) {
    requireNonEmptyString(post[field], field, post.slug);
  }
  if (!SLUG_PATTERN.test(post.slug)) fail(`${post.slug}: invalid slug`);
  if (!isValidDate(post.date)) fail(`${post.slug}: invalid date ${post.date}`);
  if (post.updated !== undefined) {
    requireNonEmptyString(post.updated, 'updated', post.slug);
    if (!isValidDate(post.updated)) fail(`${post.slug}: invalid updated date ${post.updated}`);
    if (post.updated < post.date) fail(`${post.slug}: updated must not predate date`);
  }
  if (!['Draft', 'Published'].includes(post.status)) {
    fail(`${post.slug}: status must be Draft or Published`);
  }

  const expectedCanonical = `${SITE_URL}/artikel/${post.slug}/`;
  if (post.canonical !== expectedCanonical) {
    fail(`${post.slug}: canonical must be ${expectedCanonical}`);
  }

  if (!Array.isArray(post.tags) || post.tags.length === 0) {
    fail(`${post.slug}: tags must be a non-empty array`);
  }
  post.tags.forEach((tag, tagIndex) => requireNonEmptyString(tag, `tags[${tagIndex}]`, post.slug));
  if (new Set(post.tags).size !== post.tags.length) fail(`${post.slug}: tags must be unique`);

  if (!Array.isArray(post.body) || post.body.length === 0) {
    fail(`${post.slug}: body must be a non-empty array`);
  }
  post.body.forEach((block, blockIndex) => requireNonEmptyString(block, `body[${blockIndex}]`, post.slug));

  if (post.series !== undefined) {
    if (!isPlainObject(post.series)) fail(`${post.slug}: series must be an object`);
    const unknownSeries = Object.keys(post.series).filter((key) => !SERIES_FIELDS.has(key));
    if (unknownSeries.length) fail(`${post.slug}: unknown series field(s): ${unknownSeries.join(', ')}`);
    requireNonEmptyString(post.series.slug, 'series.slug', post.slug);
    requireNonEmptyString(post.series.title, 'series.title', post.slug);
    if (!SLUG_PATTERN.test(post.series.slug)) fail(`${post.slug}: invalid series slug`);
    if (!Number.isInteger(post.series.position) || post.series.position < 1) {
      fail(`${post.slug}: series.position must be a positive integer`);
    }
  }
}

export function validatePosts(posts) {
  if (!Array.isArray(posts) || posts.length === 0) fail('posts.json must contain a non-empty array');
  posts.forEach(validatePost);

  for (const field of ['slug', 'canonical']) {
    const seen = new Set();
    for (const post of posts) {
      if (seen.has(post[field])) fail(`duplicate ${field}: ${post[field]}`);
      seen.add(post[field]);
    }
  }

  const series = new Map();
  for (const post of posts) {
    if (!post.series) continue;
    const entries = series.get(post.series.slug) ?? [];
    entries.push(post);
    series.set(post.series.slug, entries);
  }
  for (const [slug, entries] of series) {
    const titles = new Set(entries.map((post) => post.series.title));
    if (titles.size !== 1) fail(`series ${slug}: titles differ`);
    const positions = entries.map((post) => post.series.position).sort((a, b) => a - b);
    const expected = Array.from({ length: positions.length }, (_, index) => index + 1);
    if (positions.join(',') !== expected.join(',')) fail(`series ${slug}: positions must be contiguous`);
  }
}

export async function loadPosts() {
  const source = await readFile(path.join(ROOT, 'content/posts.json'), 'utf8');
  const posts = JSON.parse(source);
  validatePosts(posts);
  return posts.map((post, sourceIndex) => ({ ...post, sourceIndex }));
}

export function publishedPosts(posts) {
  return posts
    .filter((post) => post.status === 'Published')
    .toSorted((left, right) => right.date.localeCompare(left.date) || left.sourceIndex - right.sourceIndex);
}

export function tagSlug(tag) {
  return tag
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function tagCatalog(posts) {
  const tags = new Map();
  for (const post of posts) {
    for (const tag of post.tags) {
      const slug = tagSlug(tag);
      const current = tags.get(slug) ?? { name: tag, slug, posts: [] };
      if (current.name !== tag) fail(`tag slug collision: ${current.name} and ${tag}`);
      current.posts.push(post);
      tags.set(slug, current);
    }
  }
  return [...tags.values()].toSorted((left, right) => left.name.localeCompare(right.name, 'de'));
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export function formatDate(value) {
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(new Date(`${value}T00:00:00Z`));
}

export function atomDate(value) {
  return `${value}T00:00:00Z`;
}

export function legacyPostsSource(posts) {
  const legacy = publishedPosts(posts).map((post) => {
    const { sourceIndex, ...metadata } = post;
    return {
      ...metadata,
      category: post.tags[0],
      excerpt: post.description
    };
  });
  return `/* Generated by scripts/generate-posts.mjs. Do not edit by hand. */\nwindow.posts = ${JSON.stringify(legacy, null, 2)};\n`;
}
