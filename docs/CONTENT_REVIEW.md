# Evidence-backed content review candidates

Review date: 2026-08-13. No article prose was changed during the metadata
migration. Candidates are recorded only where current primary documentation
provides concrete evidence; the notes below are not automatic corrections.

## `proxmox-no-subscription`

Priority: high.

- The article says the no-subscription repository contains the same packages
  released "one test cycle later." Current Proxmox VE documentation describes
  the opposite flow: no-subscription receives less-tested packages first, and
  versions reach the enterprise repository later after additional validation.
  The claim should be manually corrected or version-qualified.
- Its command targets Proxmox VE 8/Debian 12 (`bookworm`) and the older `.list`
  layout. The current Proxmox VE 9 guide uses Debian 13 (`trixie`) and deb822
  `.sources` files. Keep the historical command only if the article explicitly
  labels its supported PVE version; otherwise replace it after hands-on review.

Evidence:

- [Proxmox VE 9 Administration Guide](https://pve.proxmox.com/pve-docs/pve-admin-guide.pdf)
- [Proxmox VE 8 Administration Guide](https://pve.proxmox.com/pve-docs-8/pve-admin-guide.pdf)

## `pihole-installation`

Priority: medium.

- `pihole -up` remains the software update command, but the prose implies that
  blocklists and the gravity database become stale unless this update command
  is run. Pi-hole's current command documentation says Gravity retrieves the
  subscribed lists and runs automatically every week. Separate the software
  update recommendation from automatic list refresh behavior when revising the
  article.

Evidence:

- [Pi-hole command documentation: Gravity](https://docs.pi-hole.net/main/pihole-command/#gravity)

## Reviewed example without a candidate

The K3s server/agent commands in `k3s-cluster-rancher` still match the current
official quick-start flow (`K3S_URL`, `K3S_TOKEN`, and the server node-token
path). This check produced no rewrite candidate.

Evidence:

- [K3s Quick-Start Guide](https://docs.k3s.io/quick-start)
