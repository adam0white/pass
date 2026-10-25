# Player text

Use full sentences with articles and verbs. Say literally what happens. Use one name for each thing. Explain a game term when it first appears. Introduce one idea at a time. Use familiar words and target grade 7 for instructions. Dialogue may be richer, but must be grammatical. Describe uncertain state in clear sentences. Cut words that do not help the player.

Keep rules and difficulty intact. Write player text plainly at its source, including simulation text in `src/sim` (2026-10-25). Replay pins hash state with prose blanked (`test/hash.ts`, `proseFree`), so wording edits keep every legacy replay pin. Never edit `label:` values passed to Human Framework: they live in person state and checkpoint digests. Keep line pools the same length and order. `src/ui/words.ts` keeps only money formatting and the HF prayer label gloss.

## Setting copy, 2026-10-24

Keep the Turkish setting and person/place names. Render common Turkish nouns in plain English. At most two flavour words may remain, each explained within its first sentence. Keep faith a quiet background detail and use HF research wording. Rewrite at source; saves hold seed and inputs, so no display projection is needed. Preserve rules, meaning and difficulty.

## Published HF narration, 2026-10-25

Current fresh kitchens and canonical actors persist `lexicon.plainEnglish: true` with HF exactly 2.21.0. The host pins this package for the lab client's transitive dependency too. Saves, exports and newly prepared canonical chapters record `plainNarration`; replay uses the saved choice. An absent choice retains historical narration. Historical edition simulations retain their original narration by default. Replaying an admitted chapter uses its pinned actors, never a new shelf read.

Upgrade lesson: narration can be stored in HF intentions, episode summaries, trace narration and counteroffer wording. Compare named presentation fields, preserve the semantic `missed` intention sentinel, and retain `usedLines`, action labels, RNG and every mechanical field. `test/hf-state.ts` implements this stricter upgrade proof. Its fixtures come from HF 2.18.0 before adoption. The older legacy prose pins remain separate. The prayer-label and money mappings remain necessary host wording.

Native admission must accept the outgoing engine stamp too. HF 2.21.0 stamps both current source envelopes and portable snapshots as 2.21.0. The finite native/agency/town adapters accept exactly 2.17.0 and 2.21.0; map, rules, identity, duty and snapshot validation stay intact. Upgrade tests build real current projections instead of giving a current snapshot a historical envelope header.
