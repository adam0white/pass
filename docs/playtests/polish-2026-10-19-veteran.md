# Polish playtest: the time-management veteran, 2026-10-19

- **Tester:** a source-unread agent (Haiku), briefed as a veteran of the time-management genre. It played the text harness (`scratch/play.ts`) on seed 3131.
- **Build:** the pass@2 sim at commit 8b9dba6 (HF 2.7.0).
- **Export:** [polish-2026-10-19-veteran.json](polish-2026-10-19-veteran.json).
- **How far:** Wednesday of week 2, mid-service; the command budget ran out. Week 1's bill was missed by ₺320.

The harness prints what the page shows, but it leaves out the page's one-line tips. Those tips explain the rail glyphs (night 2), the dirty plates (night 3), the oven and the regulars (week 2). Some "unclear" items below come from that gap.

## Their words, verbatim

**1. Verdict**

The opening week hooks me. Monday and Wednesday felt good: a full house, a clear loop, and a till that grows where I can see why. The people twist works best when a cook refuses and then says so at close ("You took my no at 20:43"). But the game breaks in the middle of the rush. One grill cook carries the whole grill, and the cooks move off their stations without telling me. That made me lose tables on Thursday, Friday and Saturday for reasons I could not fix in the moment. I would keep the people. I would fix the cook movement before anything else.

**2. Pacing and difficulty, night by night**

Totals are from the close screens. "Served" means tables fed out of tables seated.

| Night   | Served   | Till at close | What it felt like                                                                                             |
| ------- | -------- | ------------- | ------------------------------------------------------------------------------------------------------------- |
| Mon wk1 | 15 of 15 | ₺600          | Too easy at the start. No tickets from 17:34 to 20:18, almost three game hours of dead air. Then a good flow. |
| Tue wk1 | 19 of 20 | ₺760          | Right. The dish pit arrived and the grill got busy.                                                           |
| Wed wk1 | 23 of 23 | ₺920          | Best night. Full house, nobody lost.                                                                          |
| Thu wk1 | 22 of 31 | ₺880          | Too hard in the 19:00 to 21:00 window. Nine tables lost.                                                      |
| Fri wk1 | 19 of 27 | ₺760          | Hard. A cook left for a family emergency with the cold side open. Eight tables lost.                          |
| Sat wk1 | 24 of 33 | ₺960          | Too hard. Nine tables lost. The bank took ₺4,880 against ₺5,200 due. Short by ₺320.                           |
| Wed wk2 | partial  | ₺580 at 21:59 | Stopped mid-service. Week 2 opened on Wednesday, not Monday.                                                  |

Two points about the difficulty curve. First, the early nights are easy and then the difficulty jumps, with no step between. Second, every hard night had the same cause: the grill. Nothing else gave me that much trouble.

**3. How new mechanics were introduced**

- **Dish pit:** Clear. On Tuesday the journal said "Rafi is back on the dish pit. Without clean plates nothing leaves the pass." The station label and the line were enough.
- **Oven:** Weak. The station showed "oven: cold" and the journal said Selim had lit it. I did not know it needed a cook until I tried a cook on it. Pide tickets then arrived without warning.
- **Regulars:** Good texture. Hasan Bey asked if the lentils were still Nevin's. The Aksoy sisters came in as a named party. I did not know what a regular needs from me beyond that.
- **Requests:** Clear card, but the timing was confusing. Dilek asked "Chef, can I go?" on a card, but the crew list already said "gone." I answered yes after she had left.
- **Sundays:** Weak. The Sunday page showed "Noticed:" lines and nothing to choose. The `choose` command printed nothing I could use. The notes also said cooks now "go to the grill without being told." That did not match my experience.
- **Tip jar:** Unclear. The jar appears in journal lines. The choice (talk, move, leave) appears only on the close screen. Mid-day `jar talk` and `jar move` printed nothing.
- **Notebook stamps:** Never explained. "A full house, nobody walked" appeared with no meaning I could see.

**4. Does the people twist add to the genre?**

Yes, when it is a choice I can read and trade against. "Insist" worked, and the cost showed up in the cook's mood ("working with crossed arms") and at close. That cost is a good tradeoff: I can push a cook, and I pay for it later. Refusals with a reason ("Not that — I'll work the cold side") read well.

It gets in the way in three places.

- **Prayer and breaks gate work with no warning.** Selim is unavailable from about 18:40 to 19:20 most nights ("after I pray maghrib"). Insist does not override it. In the middle of the rush, that is the one grill cook gone for 20 minutes. I cannot plan around it because the rail does not show it coming. The game treats this as a timing puzzle, and I cannot solve it with the controls I have. (I am noting the mechanic, not judging the religious content.)
- **Cooks change station without a journal line.** Selim moved from grill to cold, and Rafi from dish to oven and to cold, several times, with tickets waiting. The journal did not say why. Each time I re-assigned them, and the move came back within 15 to 30 minutes. I cannot tell whether this is a bug, a cook's rule, or a mistake of mine. I can only confirm it happened.
- **Insist has no lasting hold.** After an insist, a cook can drift off the same station within the next half hour.

**5. The three changes I would most want**

1. **Keep assigned cooks on their station, and log every move.** A cook only moves when I move them, or the journal names the reason in one line. Right now I cannot tell a designed behaviour from a bug.
2. **Put the grill bottleneck on the screen.** Show the next prayer or break window on the rail before it starts (for example, "Selim: prayer, 18:40 to 19:20"), and let me plan a second cook for that window. A single grill cook in a 20-table rush is the main source of lost tables in this run.
3. **Add a legend to the rail glyphs.** I guessed that filled circles mean done and open circles mean waiting. That is an assumption, not something the game told me. Also explain the oven, notebook stamps and the tip jar the first time they appear. The Sunday page should offer the choices it mentions.

**6. How far I got**

- Reached Wednesday of week 2, at 21:59, mid-service. I stopped there because the command budget ran out (about 270 calls, against the target of roughly 300). I did not reach the end of week 2.
- Till at last check: ₺580. Week 2 bank due Saturday: ₺3,350.
- Week 1 bank: missed by ₺320. The till was ₺0 after the bank took the nights' takings.
- Export file: `/Users/abdul/code/pass/scratch/sessions/vet-export.json`

I did not read any source file. Every observation above comes from the harness output. The claims about why cooks moved, and what the rail glyphs mean, are my inference and are marked as such.

## What the replay showed, and what changed

| Report                                     | Finding                                                                                                                                                                                                                                            | Change                                                                                                                                                                                                                                 |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cooks move station without a word          | **Confirmed.** When a stint ends, the cook decides again (HF `decide`), and often the cook picks the station with more work. This is the design; the gap was that the move was silent. The replay has 12 such moves in 6 nights.                   | The journal names every self-chosen move and what a watcher would see as the reason: "Selim left the grill for the cold side; the grill was clear." Cooks still move on their own. That is the twist, and the reason is now on screen. |
| Monday has three hours of dead air         | **Confirmed.** Arrivals are pre-rolled, and Monday's 15 tables can leave long gaps.                                                                                                                                                                | While nothing is on the rail and nobody is due for ten minutes, the clock runs four times faster (page only; the sim is unchanged).                                                                                                    |
| Selim is gone from 18:40 to 19:20          | **Not confirmed.** Maghrib takes him 8 minutes, once a night (18:37 to 18:59 start across the six nights). Between 18:35 and 19:15 his sheet can say "after I pray maghrib" before he goes. The other "no"s in that window were eating and breaks. | None. Prayer stays a quiet part of his evening, not a scheduled obstacle on the rail (AGENTS.md, "Games keep faith gentle").                                                                                                           |
| Dilek's card while she was already gone    | The card waited until it was answered.                                                                                                                                                                                                             | Requests now resolve themselves: Dilek waits six minutes, then goes, and says so.                                                                                                                                                      |
| Oven, rail glyphs and the jar unexplained  | Mostly the harness: the page has a tip line for each. The oven also had no on-screen cue.                                                                                                                                                          | "pide waiting" over the oven. The week 2 intro says someone has to keep it hot. The jar choice is now accepted only on its Wednesday.                                                                                                  |
| Easy early nights, then a jump on Thursday | Thursday is the match night (31 tables, arriving late), and it is meant as the first jump.                                                                                                                                                         | Kept. Both language-model testers missed week 1's bill (by ₺200 and ₺320). The HF-character bots paid it (see [the HF personas](polish-2026-10-19-hf-personas.md)).                                                                    |
