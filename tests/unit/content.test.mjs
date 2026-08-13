import assert from 'node:assert/strict';
import test from 'node:test';
import { publishedPosts, validatePosts } from '../../scripts/lib/site.mjs';

function post(overrides = {}) {
  const slug = overrides.slug ?? 'eine-feldnotiz';
  return {
    title: 'eine feldnotiz',
    slug,
    date: '2026-08-13',
    description: 'eine kurze beschreibung.',
    tags: ['linux'],
    status: 'Published',
    canonical: `https://blog.itmitalles.de/artikel/${slug}/`,
    body: ['inhalt.'],
    ...overrides
  };
}

test('validates a complete post', () => {
  assert.doesNotThrow(() => validatePosts([post()]));
});

test('rejects missing metadata', () => {
  const fixture = post();
  delete fixture.description;
  assert.throws(() => validatePosts([fixture]), /description must be a non-empty string/);
});

test('rejects impossible and malformed dates', () => {
  assert.throws(() => validatePosts([post({ date: '2026-02-30' })]), /invalid date/);
  assert.throws(() => validatePosts([post({ updated: '13.08.2026' })]), /invalid updated date/);
});

test('rejects duplicate slugs', () => {
  assert.throws(() => validatePosts([post(), post()]), /duplicate slug/);
});

test('keeps drafts out of published projections', () => {
  const draft = post({ status: 'Draft' });
  assert.deepEqual(publishedPosts([draft]), []);
});
