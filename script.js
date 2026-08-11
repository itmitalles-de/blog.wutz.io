const root = document.documentElement;
const button = document.querySelector('.theme-toggle');
function applyTheme(theme) {
  root.dataset.theme = theme;
  button.setAttribute('aria-pressed', String(theme === 'dark'));
  document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#142329' : '#e4e7e8';
}
applyTheme(root.dataset.theme || 'dark');
button.addEventListener('click', () => {
  const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('itmitalles-theme', next);
  applyTheme(next);
});

const posts = [...document.querySelectorAll('.article-grid > article')];
const pagination = document.querySelector('.pagination');
const pageSize = 10;
const pageCount = Math.max(1, Math.ceil(posts.length / pageSize));

function showPage(page) {
  posts.forEach((post, index) => {
    post.hidden = index < (page - 1) * pageSize || index >= page * pageSize;
  });
  pagination.replaceChildren();
  for (let number = 1; number <= pageCount; number += 1) {
    const control = document.createElement('button');
    control.type = 'button';
    control.textContent = number;
    control.setAttribute('aria-label', `seite ${number}`);
    control.setAttribute('aria-current', String(number === page));
    control.addEventListener('click', () => showPage(number));
    pagination.append(control);
  }
}

showPage(1);
