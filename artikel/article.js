const slug = new URLSearchParams(location.search).get('post');
const post = window.posts && window.posts.find((entry) => entry.slug === slug);
const articleRoot = document.querySelector('#article-root');
if (post) {
  document.title = `${post.title} – it mit alles blog`;
  articleRoot.innerHTML = `<section class="article-hero"><div class="shell"><a class="article-back" href="../">← alle artikel</a><p class="eyebrow"><i></i> ${post.category} · ${post.date}</p><h1>${post.title}</h1><p class="lead">${post.excerpt}</p></div></section><article class="article-body">${post.body.map((paragraph) => `<p>${paragraph}</p>`).join('')}</article>`;
} else {
  articleRoot.innerHTML = '<article class="article-body"><h1>nicht gefunden.</h1><p><a href="../">zurück zu den artikeln</a></p></article>';
}
