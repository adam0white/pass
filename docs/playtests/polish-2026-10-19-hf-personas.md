# Polish playtest: HF-character playtesters, 2026-10-19

- **Harness:** HF's playtester (`~/code/human-framework/packages/playtester`, HF 2.8.0). Each persona is an HF person who plays: it has needs, attention and an agenda, it chooses among the actions on screen, and it stops when it gets tired, bored or has somewhere to be.
- **Adapter:** the harness ships an adapter for the six-night game. I ported it to the campaign in `scratch/hf/adapter.ts` (not committed; it reads the sim and shows only what the page shows).
- **Build:** pass@2 with the first of this round's fixes (HF 2.8.0), then rerun on pass@3 (commit 3f9b231 plus the early-hiring change). Seeds 1001 and 1002.

| Persona | Seed | How the session ended | Nights (fed/seated) | Engagement |
|---|---|---|---|---|
| commuter | 1 | had to stop (its agenda), 13 min, Fri w1 18:05 | 15/15 20/20 23/23 31/31 | 0.73 |
| commuter | 2 | had to stop, 14 min, Fri w1 19:17 | 15/15 20/20 23/23 31/31 | 0.73 |
| unwinder | 1 | put it down, tired, 21 min, Wed w2 19:49 | 15/15 20/20 23/23 31/31 27/27 33/33 | 0.78 |
| unwinder | 2 | put it down, tired, 21 min, Wed w2 20:20 | 15/15 20/20 23/23 31/31 27/27 30/33 | 0.80 |
| completionist | 1 | put it down, tired, 21 min, Wed w2 20:38 | 15/15 20/20 23/23 31/31 27/27 27/33 | 0.81 |
| completionist | 2 | put it down, tired, 21 min, Wed w2 20:20 | 15/15 20/20 23/23 31/31 27/27 31/33 | 0.80 |
| restless | 1 | put it down, tired, 17 min, Sat w1 18:32 | 15/15 20/20 22/23 31/31 27/27 | 0.64 |
| restless | 2 | put it down, tired, 14 min, Fri w1 19:26 | 15/15 20/20 23/23 31/31 | 0.63 |

On pass@3 the shape is the same. The commuters stopped at Friday of week 1 (13 to 15 minutes). The unwinders and completionists put it down at Wednesday of week 2 (20 to 21 minutes), feeding 145 to 148 of week 1's 149 tables. The restless persona stopped at Friday or Saturday of week 1. Engagement was 0.62 to 0.81, as before.

## What this shows

- **No persona was bored.** Every stop was the agenda or tiredness (HF `rest`), not boredom. The restless persona engaged least (0.63 to 0.64).
- **One sitting is about a week.** At about 21 real minutes, the patient personas reached Wednesday of week 2. The campaign is four weeks, so it relies on the save. The save is the notebook, and the title page offers "Continue" and "Turn back to Sunday".
- **An attentive player pays week 1 easily.** The bots that finished week 1 fed 143 to 149 of its 149 tables. Both language-model testers missed the same bill, by ₺200 (speedrunner) and ₺320 (veteran). So difficulty depends on attention, which is what the genre asks of a player. The cooks did say no to the bots: across the completionist's week 1, a quarter to a third of asks were not a plain yes (deferred, modified, countered or refused) on every night.
- **Not shown:** the bots never reached weeks 3 and 4. The headless measure covers those weeks (`scripts/measure.ts`, in the design doc).
