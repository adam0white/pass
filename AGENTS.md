# Pass

Read [HANDOFF.md](HANDOFF.md) first. Follow [player text rules](docs/lab/plain-english.md).

The simplify increment ends with source changes, focused tests and replay tests, one independent Codex review, signed commits, exact green CI, deployment from a fresh managed worktree and Chromium/WebKit verification at the four owner sizes. The owner accepts game readiness. Friends’ playtests and Show HN remain paused until that acceptance. Do not run new playtests in this increment. Preserve Turkish words and names pending owner discussion.

Use managed worktrees. Run `npm run check:lane` before every signed commit. Keep signing enabled and include `Co-Authored-By: Codex <noreply@openai.com>`. Rebase on origin before each push. Preserve deterministic replay and legacy tests.
