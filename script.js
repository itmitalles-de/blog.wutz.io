const root = document.documentElement;
const themeButton = document.querySelector('.theme-toggle');
function applyTheme(theme) {
  root.dataset.theme = theme;
  if (themeButton) themeButton.setAttribute('aria-pressed', String(theme === 'dark'));
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = theme === 'dark' ? '#142329' : '#e4e7e8';
}
applyTheme(root.dataset.theme || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'));
if (themeButton) themeButton.addEventListener('click', () => {
  const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('itmitalles-theme', next);
  applyTheme(next);
});

const grid = document.querySelector('#article-grid');
if (grid && window.posts) {
  const pagination = document.querySelector('#pagination');
  const categoryFilters = document.querySelector('#category-filters');
  const yearFilters = document.querySelector('#year-filters');
  const pageSize = 10;
  const state = { category: 'alle', year: 'alle', page: 1 };
  const categories = [...new Set(window.posts.map((post) => post.category))].sort();
  const years = [...new Set(window.posts.map((post) => post.date.slice(0, 4)))].sort().reverse();

  const archiveMeta = document.querySelector('#archive-meta');
  if (archiveMeta) {
    const yearRange = years.length > 1 ? `${years[years.length - 1]}–${years[0]}` : years[0];
    archiveMeta.append(document.createTextNode(` ${window.posts.length} notes · ${yearRange}`));
  }

  function filterButton(label, value, key) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.setAttribute('aria-current', String(state[key] === value));
    button.addEventListener('click', () => { state[key] = value; state.page = 1; render(); });
    return button;
  }

  function renderFilters() {
    categoryFilters.replaceChildren(filterButton('alle', 'alle', 'category'));
    categories.forEach((category) => categoryFilters.append(filterButton(category, category, 'category')));
    yearFilters.replaceChildren(filterButton('alle', 'alle', 'year'));
    years.forEach((year) => yearFilters.append(filterButton(year, year, 'year')));
  }

  function render() {
    const filtered = window.posts.filter((post) => (state.category === 'alle' || post.category === state.category) && (state.year === 'alle' || post.date.startsWith(state.year))).sort((a, b) => b.date.localeCompare(a.date));
    const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
    state.page = Math.min(state.page, pageCount);
    const visible = filtered.slice((state.page - 1) * pageSize, state.page * pageSize);
    grid.replaceChildren(...visible.map((post) => {
      const article = document.createElement('article');
      article.className = 'article-card';
      const body = post.body.map((paragraph) => `<p>${paragraph}</p>`).join('');
      article.innerHTML = `<div class="article-visual"><small>${post.category}</small></div><div class="card-copy"><p class="meta">${post.date} · ${post.category}</p><h2><a href="artikel/index.html?post=${encodeURIComponent(post.slug)}">${post.title}</a></h2>${body}</div>`;
      return article;
    }));
    pagination.replaceChildren();
    for (let page = 1; page <= pageCount; page += 1) {
      const button = document.createElement('button');
      button.type = 'button'; button.textContent = page; button.setAttribute('aria-current', String(page === state.page));
      button.addEventListener('click', () => { state.page = page; render(); }); pagination.append(button);
    }
    renderFilters();
  }
  render();
}
