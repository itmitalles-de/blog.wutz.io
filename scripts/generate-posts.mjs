import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { legacyPostsSource, loadPosts, ROOT } from './lib/site.mjs';

const posts = await loadPosts();
const expected = legacyPostsSource(posts);
const target = path.join(ROOT, 'posts.js');

if (process.argv.includes('--check')) {
  const actual = await readFile(target, 'utf8').catch(() => '');
  if (actual !== expected) {
    console.error('posts.js is stale; run npm run generate:posts');
    process.exitCode = 1;
  } else {
    console.log('posts.js is deterministic and current');
  }
} else {
  await writeFile(target, expected);
  console.log(`generated ${path.relative(ROOT, target)} (${posts.filter((post) => post.status === 'Published').length} published posts)`);
}
