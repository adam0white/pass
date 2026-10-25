# Player text

Use full sentences with articles and verbs. Say literally what happens. Use one name for each thing. Explain a game term when it first appears. Introduce one idea at a time. Use familiar words and target grade 7 for instructions. Dialogue may be richer, but must be grammatical. Describe uncertain state in clear sentences. Cut words that do not help the player.

Keep rules and difficulty intact. Write player text plainly at its source, including simulation text in `src/sim` (2026-10-25). Replay pins hash state with prose blanked (`test/hash.ts`, `proseFree`), so wording edits keep every legacy replay pin. Never edit `label:` values passed to Human Framework: they live in person state and checkpoint digests. Keep line pools the same length and order. `src/ui/words.ts` keeps only money formatting and the HF prayer label gloss.

## Setting copy, 2026-10-24

Keep the Turkish setting and person/place names. Render common Turkish nouns in plain English. At most two flavour words may remain, each explained within its first sentence. Keep faith a quiet background detail and use HF research wording. Rewrite at source; saves hold seed and inputs, so no display projection is needed. Preserve rules, meaning and difficulty.
