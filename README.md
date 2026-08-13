# IT mit alles Blog

Personal Linux, homelab, and self-hosting field notes for
[`blog.itmitalles.de`](https://blog.itmitalles.de). The site is static,
privacy-first, and intentionally small: there is no tracking, cookie state,
remote font, comment system, content backend, or automated article/image
generation.

## Architecture

- `content/posts.json` is the human-edited content source.
- `content/post.schema.json` documents the validated metadata contract.
- `scripts/build.mjs` uses only Node.js built-ins to generate `_site/`.
- `posts.js` is a deterministic compatibility artifact for the original
  hand-written index and query-string article reader.
- GitHub Pages publishes only the generated `_site/` artifact after the same
  checks used for pull requests have passed.

The original 32 article projections are guarded by
`content/migration-baseline.json`. New posts do not change that baseline. An
intentional edit to a migrated title, date, description, body, or primary tag
requires an explicit baseline update so that content changes remain visible in
review.

## Local setup

Node.js 22 or newer is required. Install the pinned dependencies and one local
Chromium browser before the first full test run.

```sh
npm install
npm run setup:browsers
npm run preview
```

The preview is served at `http://127.0.0.1:4173`. It includes Draft pages below
`/entwuerfe/<slug>/`; production builds never include them.

```sh
npm run build
npm run doctor
npm run check
```

- `build` creates the production site.
- `doctor` rebuilds and writes local reports below ignored `reports/`.
- `check` runs unit tests, deterministic-generation checks, HTML validation,
  the doctor, and Chromium E2E/accessibility tests.
- `doctor:external` additionally probes external links with an eight-second
  timeout and writes a report without making network availability a blocking
  build condition.

See [the writing workflow](docs/WRITING.md), [the verification
matrix](docs/VERIFICATION_MATRIX.md), and [the evidence-backed content review
queue](docs/CONTENT_REVIEW.md).

## Publishing

Changing a post from `Draft` to `Published` is an explicit editorial action.
Publication then requires a reviewed change on `main`; no scheduled job or
authoring tool promotes drafts automatically. The Pages workflow also verifies
pull requests, while deployment steps run only for `main` or a manual workflow
dispatch.

The visual source of truth remains the IT mit alles palette: ink `#142329`,
primary yellow `#f2b705`, and soft yellow `#ffe066`.
