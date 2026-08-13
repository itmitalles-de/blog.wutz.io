# Writing workflow

This workflow is deliberately manual. It provides validation and previewing,
not an author, scheduler, or automatic publisher.

## Create a draft

1. Copy the object from `content/post-template.json` into the array in
   `content/posts.json`.
2. Keep `status` set to `Draft` while writing.
3. Give the post a stable lowercase slug and the matching canonical URL
   `https://blog.itmitalles.de/artikel/<slug>/`.
4. Run the Draft preview:

   ```sh
   npm run preview
   ```

5. Open `/entwuerfe/<slug>/` on the printed local preview URL.

The required fields are title, slug, publication date, short description,
tags, status, canonical URL, and body. `updated` and `series` are optional.
Dates use `YYYY-MM-DD`. Series entries additionally need one shared series
slug/title and contiguous numeric positions.

## Body format

Each body array item is one paragraph. Existing inline links remain supported:

```json
"quelle: <a href=\"https://example.org/\">example.org</a>."
```

A whole block enclosed in `<code>...</code>` becomes an accessible, horizontally
scrollable code block with a local copy button. Keep code and factual prose
human-authored. Do not add remote runtime assets, trackers, embeds, or secrets.

## Validate and publish intentionally

Before review, update the compatibility file and run the complete check:

```sh
npm run generate:posts
npm run check
```

When the article is editorially ready, change `status` to `Published`. Add
`updated` only when an already published post was materially revised. A merged
change on `main` is the publication decision; the build never changes Draft
status itself.

If an existing migrated article is intentionally edited, update
`content/migration-baseline.json` in the same reviewed change. This makes an
article-content modification distinct from a mechanical build change.

For a quick production-only build without starting a server:

```sh
npm run build
```
