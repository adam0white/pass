# HF requests

Filed 2026-10-19 against HF 2.7.0, and appended to `~/code/human-framework/docs/game-requests-2026-10-18.md` ("The Pass, owner playtest"). Items 1 and 4 are done in pass@10 with HF 2.13.0. The other host-side workarounds stay.

1. **A deferral names what decided it — done in pass@10 with HF 2.13.0.** Every cook and hire enables `SuggestionResolution.decidedBy`. Captions, rota replies and job-button hints phrase the deciding activity or term in the cook’s words. The counter-offer stays available, and a break’s no repeats its original reason until that break ends.
2. **`promptingLine` reads as jargon in a caption** ("The self pulled; held back."). Workaround: the game's own lines per outcome.
3. **Chronicle verbs from noun ids** ("They colded every day."). Workaround: the game phrases `diffChronicle`'s structured `changes`.
4. **A personal rule without a norm can be a will-not — done in pass@10 with HF 2.13.0.** Selim’s “my rule about the plates” has `firm: true`: he refuses plates in the rush even when insisted on. Dilek’s smoking rule and Rafi’s jar rule stay ordinary commitment terms; shift rules remain owed to the chef.
5. **A voice answering the person's own request** (mirror of `noteVoicePromise`). Workaround: `adoptVoiceTrust` with a small host-chosen step.
6. **A duty held by a group** ("somebody stays on the line"). Workaround: a host rule that withholds the off-the-line offers from the last cook in the kitchen.
7. (2026-10-18, kept) `reviewLine` for a kept day reads "Today I kept <label>" and only works with noun-phrase labels. The game composes kept-day lines itself.
8. (2026-10-19, polish round) **A `review:resolve` term does not name its resolve.** A host that wants to show muhasaba weighing in a choice ("Rafi turned from the jar, as he said he would") cannot tell which resolve the term came from. Proposal: carry the resolve key on the term (for example `review:resolve:<key>`, or a `ref` field). Workaround: the game infers it from the chosen act and the person's resolve list.

Status against HF 2.13.0: items 1 (suggestion reasons) and 4 (firm self-rule) are done in pass@10. Item 8 is available since HF 2.9.0 (`Term.ref` on `review:resolve`) but the game does not use it yet. The other workarounds above stay. pass@3–9 notebooks retain their original feature flags and wording.

## Installed HF3 reconciliation — 2026-10-26

The opt-in pass@14 candidate adopts item 8: the positive `review:resolve` term's
actual `ref` identifies a `Resolve.key`. No label is inferred from the chosen act
or resolve-list order when the term has no unique reference. Historical editions
keep their original raw narration for replay.

Installed HF3.0.0's public `social/groups` contract provides membership and care,
not a crew coverage obligation that several people may satisfy. The last-cook
world-availability convention remains for item 6; all owns GDI-009/570's generic
contract (target 2026-10-29). For item 5, `noteVoicePromise` addresses promises made
by a voice. `gestureVoiceTrust` is an explicitly host-chosen signed amount, not a
sourced request-answer effect with outcome and repetition semantics. Existing
request handling stays unchanged while all owns GDI-571 (target 2026-10-30).
These are concrete gaps in the installed contract, not claims about all future
HF releases. No local generic replacement or new trust rate was introduced.

## Narration successor candidate — 2026-10-26

The explicit pass@16 choice adopts items 2 and 3 through published HF3
`promptingLine` options and `Lexicon.actions` read by `diffChronicle`. Historical
13/14/15 narration stays exact. GDI-642 uses matching observed activity evidence
for cause-aware evening lines, with ordinary wording when evidence is absent.
Raw HF review and norm records remain unchanged. This candidate awaits the
parent's independent review and delivery gates; no package change is included.
