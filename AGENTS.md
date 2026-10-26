# Pass

Read [HANDOFF.md](HANDOFF.md) first. Follow [player text rules](docs/lab/plain-english.md).

The simplify increment ends with source changes, focused tests and replay tests, one independent Codex review, signed commits, exact green CI, deployment from a fresh managed worktree and Chromium/WebKit verification at the four owner sizes. The owner accepts game readiness. Friends’ playtests and Show HN remain paused until that acceptance. Do not run new playtests in this increment. Keep the Turkish setting and person/place names. Render common Turkish nouns in plain English. At most two flavour words may remain, each explained in its first sentence. The setting increment requires independent review, signed source, exact green CI, fresh managed deployment and live checks at 360x690 and 820x1180; Adam accepts readiness.

Use managed worktrees. Run `npm run check:lane` before every signed commit. Keep signing enabled and include `Co-Authored-By: Codex <noreply@openai.com>`. Rebase on origin before each push. Preserve deterministic replay and legacy tests.

Current stack: HF package 3.0.0 / Person engine 2.23.0; immutable lab-client 0.4.11 / lab-kit 0.5.12; Node 26; Worker compatibility_date 2026-10-25.

## Current policy clarification — 2026-10-25

The no-new-playtests instruction above records the simplify increment. Later owner policy allows lab-panel rounds on HF3 builds under the playtest director. This docs task runs no rounds. Friends’ playtests and Show HN remain paused. Adam accepts game readiness separately from technical gates. TypeScript support is 7+ (current pin 7.0.2). Lab client and kit remain immutable release artifacts.
