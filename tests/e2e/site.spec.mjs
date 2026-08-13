import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

function monitorPage(page) {
  const problems = [];
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
  return problems;
}

async function expectNoHorizontalOverflow(page) {
  const sizes = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth
  }));
  expect(sizes.content).toBeLessThanOrEqual(sizes.viewport + 1);
}

test('index renders published articles and local search', async ({ page }) => {
  const problems = monitorPage(page);
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('linux');
  await expect(page.locator('.latest-posts .article-card')).toHaveCount(10);
  await page.locator('#site-search').fill('vaultwarden');
  await expect(page.locator('.search-result')).toHaveCount(1);
  await expect(page.locator('.search-result h3')).toContainText('vaultwarden');
  await expectNoHorizontalOverflow(page);
  expect(problems).toEqual([]);
});

test('archive pagination exposes real crawlable pages', async ({ page }) => {
  const problems = monitorPage(page);
  await page.goto('/archiv/');
  await expect(page.locator('.article-card')).toHaveCount(10);
  await expect(page.locator('.pagination [aria-current="page"]')).toHaveText('1');
  await page.goto('/archiv/seite/4/');
  await expect(page.locator('.article-card')).toHaveCount(2);
  await expect(page.locator('.pagination [aria-current="page"]')).toHaveText('4');
  expect(problems).toEqual([]);
});

test('tag page contains only matching posts', async ({ page }) => {
  const problems = monitorPage(page);
  await page.goto('/tags/proxmox/');
  await expect(page.locator('h1')).toHaveText('proxmox');
  await expect(page.locator('.article-card')).toHaveCount(8);
  await expect(page.locator('.tag-list .tag')).toHaveText(Array(8).fill('proxmox'));
  expect(problems).toEqual([]);
});

test('article has canonical metadata, structured data, series links and copy control', async ({ page, context }) => {
  const problems = monitorPage(page);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/artikel/vaultwarden/');
  await expect(page.locator('h1')).toContainText('vaultwarden');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://blog.itmitalles.de/artikel/vaultwarden/');
  const structured = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent());
  expect(structured['@type']).toBe('Article');
  expect(structured.mainEntityOfPage).toBe('https://blog.itmitalles.de/artikel/vaultwarden/');
  await expect(page.locator('.series-nav a')).toHaveCount(2);
  const code = await page.locator('.code-block code').first().textContent();
  await page.locator('.copy-code').first().click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(code);
  await expect(page.locator('.copy-code').first()).toHaveText('kopiert');
  await expectNoHorizontalOverflow(page);
  expect(problems).toEqual([]);
});

test('legacy query URL redirects to the canonical article URL', async ({ page }) => {
  const problems = monitorPage(page);
  await page.goto('/artikel/index.html?post=uptime-kuma');
  await expect(page).toHaveURL(/\/artikel\/uptime-kuma\/$/);
  await expect(page.locator('h1')).toContainText('uptime kuma');
  expect(problems).toEqual([]);
});

test('feed, sitemap and 404 are served without client failures', async ({ page, request }) => {
  const problems = monitorPage(page);
  const feed = await request.get('/feed.xml');
  expect(feed.ok()).toBeTruthy();
  expect(await feed.text()).toContain('<feed xmlns="http://www.w3.org/2005/Atom"');
  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.ok()).toBeTruthy();
  expect(await sitemap.text()).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
  const missing = await page.goto('/definitely-missing/');
  expect(missing.status()).toBe(404);
  await expect(page.locator('h1')).toContainText('keine feldnotiz');
  const scriptProblems = problems.filter((problem) => !problem.includes('status of 404'));
  expect(scriptProblems).toEqual([]);
});

test('representative pages have no serious accessibility violations', async ({ page }, testInfo) => {
  for (const theme of ['light', 'dark']) {
    await page.goto('/');
    await page.evaluate((selectedTheme) => localStorage.setItem('itmitalles-theme', selectedTheme), theme);
    for (const route of ['/', '/archiv/', '/tags/proxmox/', '/suche/', '/artikel/vaultwarden/', '/404.html']) {
      await page.goto(route);
      const results = await new AxeBuilder({ page })
        .disableRules(['landmark-no-duplicate-banner'])
        .analyze();
      const serious = results.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact));
      expect(serious, `${testInfo.project.name} ${theme} ${route}: ${JSON.stringify(serious, null, 2)}`).toEqual([]);
    }
  }
});

test('reduced motion and mobile layout are respected', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/artikel/k3s-cluster-rancher/');
  const behavior = await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior);
  expect(behavior).toBe('auto');
  await expectNoHorizontalOverflow(page);
});
