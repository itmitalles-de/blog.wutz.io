# Verification matrix

All blocking checks run through `npm run check` locally and in pull requests.
External network health remains a timestamped report because third-party
availability is not a deterministic build input.

| Requirement | Implementation | Verification |
| --- | --- | --- |
| Required metadata and optional update/series fields | `content/posts.json`, schema, runtime validator | Unit fixtures reject missing metadata and invalid dates; doctor validates every entry and the Draft template |
| Duplicate slugs | Collection validator | Negative unit fixture plus doctor uniqueness check |
| Mechanical, URL-stable migration | Compatibility aliases, canonical `/artikel/<slug>/`, legacy query router | Migration baseline checks all 32 original projections against commit `9b8744f`; E2E verifies an old query URL redirects |
| Draft isolation | Production projection filters `status === Published` | Unit fixture plus doctor checks feed, search index, and archive; template defaults to Draft |
| Archive and pagination | Four generated crawlable archive pages, ten items per page | Route coverage doctor check and desktop/mobile archive E2E |
| Tag pages | Deterministic normalized tag catalog | Route coverage, internal-link check, and tag E2E |
| Local client-side search | Generated `search-index.json`, dependency-free browser code | Draft/index count doctor check and desktop/mobile search E2E |
| Atom feed | Generated `feed.xml` | XML well-formedness, Atom namespace/content checks, and HTTP E2E |
| Sitemap | Generated `sitemap.xml` and `robots.txt` | XML well-formedness, Sitemap namespace/URL checks, and HTTP E2E |
| Article structured data | JSON-LD `Article` per published post | JSON parse/type/canonical doctor checks for all articles |
| OpenGraph, social card, canonical | Per-page metadata and local `social-card.svg` | Doctor checks every generated HTML file |
| Series Previous/Next | Ordered `series` metadata | Series-contiguity validator and article E2E |
| Print CSS | Print-only article layout | Static stylesheet included in HTML validation; no runtime dependency |
| Code blocks and copy button | Semantic `pre`/`code`, keyboard-scrollable region, local clipboard fallback | HTML/axe checks and clipboard E2E |
| 404 | Generated `404.html` and preview-server fallback | HTTP status/content E2E |
| Internal links and fragments | Generated root-relative paths | Doctor resolves every local `href`/`src` and fragment target |
| External links | Concurrent HEAD/GET probe with 8 s timeout | `npm run doctor:external`; JSON report is explicitly non-blocking |
| Feed and sitemap schema | Atom and Sitemap namespaces with required fields | XML parser/validator doctor checks |
| HTML validity | Static generated documents | `html-validate` recommended rules |
| Accessibility | Semantic landmarks, focus styles, accessible controls/contrast | axe serious/critical scan across six routes, both themes, desktop and mobile |
| Mobile and reduced motion | Responsive CSS and motion override | Two browser profiles, horizontal-overflow assertions, reduced-motion E2E |
| No console errors | Error listeners on representative flows | Index, archive, tag, article, search, legacy URL and 404 E2E; expected navigation 404 is separated from script errors |
| Pages paths and CNAME | `_site` artifact, `.nojekyll`, `blog.itmitalles.de` | Doctor inspects workflow/artifact path and CNAME |
| Privacy boundary | No remote runtime assets, cookies, analytics, or tracking | Doctor scans all generated HTML/CSS/JS for prohibited runtime patterns |
| Performance budget | 1.5 MB site; 50 KB HTML; 30 KB CSS/search; 20 KB runtime JS | Doctor measures every generated file (compatibility `posts.js` is separately deterministic) |
| Browser flows | Playwright with system Chrome locally and installed Chromium in CI | 16 desktop/mobile tests for index, article, search, tag, archive, feed, sitemap, 404, legacy URL, accessibility and motion |
| Deterministic compatibility data | Generated `posts.js` | Byte-for-byte regeneration check and doctor SHA report |

The 2026-08-13 verification run produced 32 published articles, 7 tag pages,
4 archive pages, 46 sitemap URLs, 48 HTML documents, and a 496,103-byte site.
All 14 blocking doctor groups, 5 unit tests, and 16 browser tests passed; all
23 external targets responded successfully in the separate report.
