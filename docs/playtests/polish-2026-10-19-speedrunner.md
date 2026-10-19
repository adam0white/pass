# Polish playtest: the min-max speedrunner, 2026-10-19

- **Tester:** a source-unread agent (Sonnet) briefed as a min-max speedrunner. It played through a text harness (`scratch/play.ts`, not committed) that shows what the screen shows, on seed 4242.
- **Build:** the pass@2 sim at commit 8b9dba6 (HF 2.7.0).
- **Export:** [polish-2026-10-19-speedrunner.json](polish-2026-10-19-speedrunner.json).
- **How far:** lost at the end of week 2, ₺735 short. The tester never insisted.

## Their words, verbatim

**1. Verdict.** I lost at the end of week 2 and never once insisted, so I don't know whether the game can be won. The cooks have real texture, but the economy looks harder than the plain play I could manage. I could see too little to optimise the nights.

**2. Fun, flat, unclear, unfair**
- **Fun:**
  - Selim's "After I pray maghrib" was good. From week 2, "Selim kept to what was said last night" meant he kept maghrib on his own.
  - The after-close lines remembered specifics: "You took my no at 20:36", "I said no at 21:56. You let it be."
  - Rafi's ₺50 for his sister's trip came back as "My sister's going on the trip. Because of you."
- **Flat:**
  - Most of a night is silence. At 17:25 to 19:00 and after 21:00, I waited and nothing happened.
  - After Thursday week 2 my loop was ask, wait, ask, wait.
  - Week 2 was a grind: ₺595, ₺655, ₺710 and ₺575 a night against ₺3,220.
- **Unclear:**
  - The first ask after every "open" fails with "No such cook here." That happened Wednesday and Saturday of week 1 and on all of week 2 except my first assignments. The cooks self-assign anyway.
  - On Wed week 2, I tried leaving the cooks alone. At 18:10 Selim was at the dish pit, Dilek was at the dish pit and Rafi was on cold.
  - The cook screen disagrees with the answer. Tue week 1 19:45, Rafi's screen said "grill: yes". He then answered "Not that — I'll wash plates."
  - Rafi's "Can I take some börek home?" (Wed week 2 close) offered no card. `answer yes` printed nothing.
  - I couldn't tell why the ledger moved. The rail shows `grill ○○ cold ●` but nothing links a table to its price or its tab. "On the tab, as Nevin did" (Hasan Bey, Wed week 2) was presumably unpaid, and I only guessed that.
  - Week 1 ended ₺200 short. Week 2 started at ₺0 with ₺3,220 due to Ahmet. I couldn't tell whether the ₺3,220 was the shortfall, a fee, a butcher's bill or all three.
- **Unfair:**
  - Fri week 1: Dilek's mother fell at 19:40. The card sat for 2 hours of game time while she kept working, because my script didn't stop on it. There was no penalty and no nag, and at 21:53 she ran off with "Thank you, Chef."
  - Fri week 2: Dilek's "Five minutes" at 19:18 ran until about 21:55. My script kept re-asking her and the answers never showed. A "five minutes" that lasts 150 is a lie, or a hidden mechanic.
  - Wed week 1: I stopped watching during 19:00 to 20:48. Backlog hit 9 items, five tables left, and ₺600 was the best I could do. Dilek and Rafi were out back at 20:48 and nothing warned me.
  - Mrs Arslan's grandson wanted egg pide at 18:20, and she "took the boy home hungry" at 18:57. The oven was cold and Rafi was on dishes. Nothing told me the oven needed staffing before an order came.

**3. Exploits and dominant strategies**
- **Re-ask cooks the moment they go idle.** "Fine." works as a yes, and "Not now. After I catch my breath." resolves in about 4 minutes without insisting. I earned the "A week without insisting" stamp with no cost I could see.
- **Ignoring request cards.** Delaying an answer cost nothing visible. I didn't test this on purpose.
- **Moving the jar to the pass** (Tue week 1 close) changed nothing I could see. By Wed it was back at the back door.
- **Cross-covering stations.** Rafi shows "yes" for grill, cold and oven, but refuses grill when the pit is empty. I never worked out a reliable way to run four stations with three cooks.
- I didn't try insisting at all, so I can't say whether it breaks cooks or makes more money.

**4. People or dice.** People, in the closing lines. Selim cites maghrib and "My knees". Dilek cites the time she said no and what she'll give later. Rafi connects the jar and "Selim smiled at me tonight. I think." The refusals were readable when they came with a reason ("Let me eat first", "Let me finish it"). They felt like dice when the cook screen said yes and the ask said no (Rafi, Tue week 1), and when "Five minutes" ran two and a half hours.

**5. Three changes**
1. Fix "No such cook here" on the first ask after open. Also put a visible warning on the rail when a station goes unmanned during service, and an oven prompt before pide arrives.
2. Show, or hint at, what each ticket pays and when a regular is on the tab. Show where the debt total comes from. Without that I can't optimise or judge a night.
3. Give request cards an expiry or a visible clock. A request about a mother's fall should not wait two hours. A promised "five minutes" should end near five.

## What the replay showed

| Report | Cause | Fix |
|---|---|---|
| "Five minutes" ran 150 | **Game bug.** The granted call stayed on offer all night. Each time Dilek was asked off the phone she came ("Off the phone for the cold side? One minute."), then chose to ring again. | The call is offered once. Test: "a granted phone call is made once". |
| Mother's call waited two hours | **Game gap.** An unanswered request waited until close. | Dilek waits six minutes, then goes ("I can’t wait for you, Chef. I’m going."), with a larger trust cost than a no. Other requests drop after ten to twelve minutes ("Never mind. Forget I asked."). Her evening line says so. Test: "a call left unanswered". |
| The jar moved back | **Game bug.** The jar choice was accepted on any evening, so a "talk" on Wednesday followed a "move" on Tuesday, and the Wednesday card always said "by the back door". | The jar is decided once, on Wednesday of week 1. Test: "the jar is decided once". |
| Nothing warned that a station was empty or the oven cold | **Gap.** | A handwritten "nobody on it" over a station with waiting work, and "pide waiting". The week 2 intro says somebody has to keep the oven hot. |
| The börek line read as a request | Wording. | Rafi now says he took some home. |
| "No such cook here" after open | **The harness, not the game.** Replaying the export to just after each `open` shows service running with all three cooks on shift. The exact harness cause was not traced. | None in the game. |
| Screen said "grill: yes", Rafi countered | **Not reproduced.** At 19:45 the hint read "grill: rather wash plates", which matches his answer. The tester probably read the screen from 19:41, before Rafi went to the dish pit. | None. |
| Where the ₺3,220 came from | Partly a harness gap: the Sunday page already says "₺3,000 for Ahmet the butcher, and ₺220 carried over". | None. |
| Ticket prices and tabs | Deliberately not shown per ticket. The ledger is the week's total. | Kept as is. |
