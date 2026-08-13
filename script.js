const root = document.documentElement;
const themeButton = document.querySelector('.theme-toggle');

function applyTheme(theme) {
  root.dataset.theme = theme;
  themeButton?.setAttribute('aria-pressed', String(theme === 'dark'));
  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) themeColor.content = theme === 'dark' ? '#142329' : '#e4e7e8';
}

applyTheme(root.dataset.theme || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'));
themeButton?.addEventListener('click', () => {
  const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem('itmitalles-theme', next); } catch {}
  applyTheme(next);
});

async function copyText(value) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.className = 'visually-hidden';
  document.body.append(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  if (!copied) throw new Error('copy unavailable');
}

document.querySelectorAll('.copy-code').forEach((button) => {
  button.addEventListener('click', async () => {
    const code = button.parentElement?.querySelector('code')?.textContent ?? '';
    try {
      await copyText(code);
      button.textContent = 'kopiert';
    } catch {
      button.textContent = 'kopieren fehlgeschlagen';
    }
    window.setTimeout(() => { button.textContent = 'code kopieren'; }, 1800);
  });
});

const normalize = (value) => value
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase();

function createSearchResult(entry) {
  const article = document.createElement('article');
  article.className = 'search-result';
  const heading = document.createElement('h3');
  const link = document.createElement('a');
  link.href = entry.url;
  link.textContent = entry.title;
  heading.append(link);
  const description = document.createElement('p');
  description.textContent = entry.description;
  const metadata = document.createElement('small');
  metadata.textContent = `${entry.date} · ${entry.tags.join(' · ')}`;
  article.append(heading, description, metadata);
  return article;
}

document.querySelectorAll('[data-search-root]').forEach((searchRoot) => {
  const form = searchRoot.querySelector('form');
  const input = searchRoot.querySelector('input[type="search"]');
  const status = searchRoot.querySelector('[data-search-status]');
  const results = searchRoot.querySelector('[data-search-results]');
  let indexPromise;

  const loadIndex = () => {
    indexPromise ??= fetch('/search-index.json')
      .then((response) => {
        if (!response.ok) throw new Error(`search index: ${response.status}`);
        return response.json();
      });
    return indexPromise;
  };

  async function search() {
    const query = input.value.trim();
    if (!query) {
      results.replaceChildren();
      status.textContent = 'suchbegriff eingeben.';
      return;
    }
    status.textContent = 'suche …';
    try {
      const index = await loadIndex();
      const needle = normalize(query);
      const matches = index.filter((entry) => normalize([
        entry.title,
        entry.description,
        ...entry.tags
      ].join(' ')).includes(needle));
      results.replaceChildren(...matches.map(createSearchResult));
      status.textContent = `${matches.length} ${matches.length === 1 ? 'treffer' : 'treffer'}.`;
      const url = new URL(location.href);
      url.searchParams.set('q', query);
      history.replaceState(null, '', url);
    } catch {
      results.replaceChildren();
      status.textContent = 'der lokale suchindex konnte nicht geladen werden.';
    }
  }

  form.addEventListener('submit', (event) => { event.preventDefault(); search(); });
  input.addEventListener('input', search);
  input.addEventListener('focus', loadIndex, { once: true });
  const initialQuery = new URLSearchParams(location.search).get('q');
  if (initialQuery) {
    input.value = initialQuery;
    search();
  } else {
    status.textContent = 'suchbegriff eingeben.';
  }
});

// Keep the checked-in, pre-build index readable for local file previews.
const legacyGrid = document.querySelector('#article-grid:empty');
if (legacyGrid && window.posts) {
  const categoryFilters = document.querySelector('#category-filters');
  const yearFilters = document.querySelector('#year-filters');
  const pagination = document.querySelector('#pagination');
  const pageSize = 10;
  const state = { category: 'alle', year: 'alle', page: 1 };
  const categories = [...new Set(window.posts.map((post) => post.category))].sort();
  const years = [...new Set(window.posts.map((post) => post.date.slice(0, 4)))].sort().reverse();

  function filterButton(label, value, key) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.setAttribute('aria-current', String(state[key] === value));
    button.addEventListener('click', () => { state[key] = value; state.page = 1; renderLegacy(); });
    return button;
  }

  function renderLegacyFilters() {
    categoryFilters?.replaceChildren(filterButton('alle', 'alle', 'category'), ...categories.map((category) => filterButton(category, category, 'category')));
    yearFilters?.replaceChildren(filterButton('alle', 'alle', 'year'), ...years.map((year) => filterButton(year, year, 'year')));
  }

  function renderLegacy() {
    const filtered = window.posts.filter((post) =>
      (state.category === 'alle' || post.category === state.category)
      && (state.year === 'alle' || post.date.startsWith(state.year))
    );
    const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
    state.page = Math.min(state.page, pageCount);
    const visible = filtered.slice((state.page - 1) * pageSize, state.page * pageSize);
    legacyGrid.replaceChildren(...visible.map((post) => {
      const article = document.createElement('article');
      article.className = 'article-card';
      const title = document.createElement('h2');
      const link = document.createElement('a');
      link.href = `artikel/index.html?post=${encodeURIComponent(post.slug)}`;
      link.textContent = post.title;
      title.append(link);
      const metadata = document.createElement('p');
      metadata.className = 'meta';
      metadata.textContent = `${post.date} · ${post.category}`;
      const description = document.createElement('p');
      description.textContent = post.description ?? post.excerpt;
      article.append(metadata, title, description);
      return article;
    }));
    pagination?.replaceChildren(...Array.from({ length: pageCount }, (_, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = String(index + 1);
      button.setAttribute('aria-current', String(index + 1 === state.page));
      button.addEventListener('click', () => { state.page = index + 1; renderLegacy(); });
      return button;
    }));
    renderLegacyFilters();
  }
  renderLegacy();
}
