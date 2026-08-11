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
