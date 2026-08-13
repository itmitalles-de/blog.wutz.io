# Deliberately deferred features

These are documented boundaries, not implementation tasks for the hardening
work:

- **Comments:** would add moderation, identity, spam, and storage obligations.
- **Newsletter:** would require subscriber consent, delivery infrastructure,
  and personal-data handling.
- **Analytics:** intentionally omitted to preserve a tracking-free site.
- **CMS:** unnecessary operational weight for a small version-controlled blog.
- **ActivityPub:** useful federation, but a server-side identity and delivery
  surface outside this static site's scope.
- **Webmentions:** require endpoint processing, moderation, and persistence.
- **Full-text search backend:** the generated local index is sufficient and
  keeps queries in the browser.
- **Automatic article generation:** conflicts with the personal field-note
  model and remains prohibited.
- **Automatic screenshots:** adds brittle browser/image generation and is not
  part of the publishing pipeline.
- **Multilingual content:** would require an editorial translation model and
  URL policy that do not yet exist.

Reconsidering one item requires an explicit privacy, maintenance, and static
hosting review. None is silently enabled by the current build.
