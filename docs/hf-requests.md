# HF requests

Filed 2026-10-19 against HF 2.7.0, and appended to `~/code/human-framework/docs/game-requests-2026-10-18.md` ("The Pass, owner playtest"). None blocks the game: each has a host-side workaround, noted below.

1. **A deferral names the counter-offer, not what decided it** (owner-reported, confirmed). A cook on a self-chosen break defers the grill ("Not now. After I take ten out back."). He takes the cold side, then takes the grill from there. Each verdict is correct: the break's inertia beats the grill, whose `forecast:body` costs it -0.149, while the cold side clears it. The sentence makes the break sound like the reason. Proposal: `SuggestionResolution.decidedBy`. Workaround: the host composes the answer, naming the jobs HF predicts the cook would take now, and keeps the deferral for the rest of the break.
2. **`promptingLine` reads as jargon in a caption** ("The self pulled; held back."). Workaround: the game's own lines per outcome.
3. **Chronicle verbs from noun ids** ("They colded every day."). Workaround: the game phrases `diffChronicle`'s structured `changes`.
4. **A personal rule without a norm cannot be a will-not.** Selim's "I don't wash plates during the rush" yields "not now" or "rather", never "no". Workaround: it stays a commitment term, and the game shows his rule in his words.
5. **A voice answering the person's own request** (mirror of `noteVoicePromise`). Workaround: `adoptVoiceTrust` with a small host-chosen step.
6. **A duty held by a group** ("somebody stays on the line"). Workaround: a host rule that withholds the off-the-line offers from the last cook in the kitchen.
7. (2026-10-18, kept) `reviewLine` for a kept day reads "Today I kept <label>" and only works with noun-phrase labels. The game composes kept-day lines itself.
8. (2026-10-19, polish round) **A `review:resolve` term does not name its resolve.** A host that wants to show muhasaba weighing in a choice ("Rafi turned from the jar, as he said he would") cannot tell which resolve the term came from. Proposal: carry the resolve key on the term (for example `review:resolve:<key>`, or a `ref` field). Workaround: the game infers it from the chosen act and the person's resolve list.

Status against HF 2.8.0 (upgraded 2026-10-19): items 1 (`decidedBy`), 4 (firm self-rule), 5 and 6 (group duty) are on HF's deferred list; none is closed by 2.8.0, so every workaround above stays.
