# The Pass: design

**One line.** You inherited your late aunt Nevin's neighbourhood lokanta, and with it three cooks who were loyal to her, not to you. The bank wants the arrears by Saturday close. Six dinner services. Every cook can say no.

**Done for the first playable** (set 2026-10-18 by the coordinator's brief; the owner accepts feel separately): six playable nights with one new pressure each, an ending, a playtest export that replays, tests, a headless balance measure, a late source-unread playtest recorded verbatim, live at https://pass.adamwhite.work.

## How it was chosen (2026-10-18)

Three concepts were written (kept below) and sent, with the owner's taste signal and nothing else, to two consultants who did not read any source.

- **Game-design expert (Opus):** picked A. "It is the only concept where body, norms, trust and self-review all bite every night, and six nights give the evening reviews somewhere to land." Half Time: high slow-sim risk and a big spatial build. Last Ferry: "plays as a one-night puzzle … sits close to The Night Watch." Biggest risk for A: refusals read as dice rolls in the chaos, so every refusal needs a visible sign before it and a reason in the cook's words; insisting must have a price you can see later; one new pressure per night, introduced by a person, not a tutorial.
- **Wildcard (Sonnet, a line cook turned night nurse who plays on the bus):** picked A ("Reigns with a spatula"), would delete B ("a group chat, not a game"), called C "one puzzle in a costume". Phone-down list: a tutorial before the first ticket, a backstory wall, tiny buttons, unreadable refusals, a fail screen that replays three minutes, any meter. "I want to be mid-rush in 20 seconds." Wild idea: the evening is a dish-pit confession, each cook says one line about your night, and it comes back tomorrow as a consequence; the share card is the crew's lines about you.

**Pick: A, The Pass.** Both consults chose it independently. It is fast (the rush paces it, so it is not another slow expedition sim), its choices are sharp (push a tired cook or fall behind), and every HF faculty that matters shows each night: refusals and counter-offers, trust and insisting, bodily forecasts ("I can do the rush, but I'll be spent for close"), a prompting at the tip jar that a cook can learn to let pass, and the evening review (muhasaba) whose resolve changes tomorrow.

## Rules taken from the consults
1. A night is about 2½ real minutes at normal speed; the game slows while a cook's sheet is open (tactical slowdown, no pause).
2. Verbs: tap a cook, then a job. Tap asks; press and hold insists. No menus during service, no meters for a person.
3. Each job button carries the cook's likely answer in their hand (HF `predict`, pure). A refusal names its reason in their words.
4. Insisting gets compliance under protest (slower work) and costs trust; it comes back in the evening line and in later answers.
5. One new pressure a night, brought by a person: Rafi and the plates (2), the tip jar (3), the match crowd (4), the critic and Dilek's call (5), the bank (6).
6. Mid-rush within 20 seconds: the first ticket arrives in the first minute; the story is three lines on the first page.
7. The evening is the confession: each cook's review in their own words, one line about you, then tomorrow.

## The world (host side, all in `src/sim`)
- Tickets are pre-rolled from the seed per night (`rng.ts`, keyed by night and ticket index), so no input moves a later table: the fix for The Night Watch's "looks more like randomness".
- Stations: grill, cold, dish. A cook working a station turns minutes into portions at a rate set by skill, HF body capacity, and protest. The pass plates a ticket when its portions are ready and a clean plate is free. A table that waits too long walks out.
- Money is world truth and may be shown as a number. A person's inner state is never shown as a number: posture, hand-written lines and the journal show it.

## The people (HF 2.8.0, pinned exactly)
- **Selim**, grill, 56. Worked for Nevin twenty years. Honest, proud, prays maghrib (a quiet offer at sunset; a journal line, no station effect).
- **Dilek**, cold, 34. Smokes; her own rule is no smoke in the rush (an HF abstention); a habit pulls the other way. Reviews by ruminating.
- **Rafi**, dish, 19. Broke. A habit toward the tip jar against his held norm on theft: an HF prompting. If the chef talks to him he gets a practised response (redirect) that grows with use; moving the jar removes the offer instead.
- Everyone holds "I don't walk out on a service" (an abstention to the chef); breaking it forms a resolve in the evening review.

## Concepts not chosen
- **B. Half Time**, coaching an under-14 team through a season. Rejected: slow sim between matches, spatial football on a phone.
- **C. Last Ferry**, the last crossings before a storm. Rejected: a one-night puzzle; too close to The Night Watch.

## The campaign (pass@2, 2026-10-19; pass@3 after the polish round)

The owner played week 1 and asked for more. pass@2 is four weeks, 18 services, one notebook.

| Week | Title | Services | New, brought by a person | Bill |
|---|---|---|---|---|
| 1 | The arrears | Mon to Sat | Rafi and the plates, the tip jar, the match crowd, the critic and Dilek's call, the bank | ₺5,200 to the bank |
| 2 | The street | Wed to Sat | the pide oven (heat you keep up), regulars with names and tabs | ₺3,000 |
| 3 | The ledger | Wed to Sat | the ledger on the pass, hiring and quitting on Sunday | ₺4,200 plus wages |
| 4 | Nevin's name | Wed to Sat | the anniversary (Nevin's apron), the night the gas fails, a wedding order with a due time | ₺6,200 plus wages |

- **Bills and strikes.** Each Saturday the week's bill is paid from the till. A shortfall is carried at 1.1× and gives a strike; two strikes, or any shortfall in week 4, loses the lokanta.
- **Sunday page.** Between weeks: who changed (HF `diffChronicle`, unprompted habits in kitchen words), who quits (an HF `decide` between staying and leaving, moved by trust and how often they were pushed), two candidates to hire (new HF people with their own temperament; their hints are the chef's guesses through `predictAs`, pencilled until known), and a decision card or two: Dilek's day off, the regulars' tabs, the pide price, letting a cook go, the offer to buy the name.
- **Saves on the same fiction.** The notebook is the save: seed plus inputs, replayed. The title page offers "Turn back to Sunday, week N", which replays the inputs up to that Sunday.
- **Stamps** in the notebook for a week without walkouts, without insisting, Rafi keeping his rule, and others (`STAMPS` in `campaign.ts`).
- **Refusals said at the pass.** The last answer is a caption at the pass in the cook's words, with a "Take it" button when it carries a counter-offer.
- **The crew rule.** Break, smoke, eat and phone are offered only while another cook is in the kitchen (`docs/hf-requests.md` 6).
- **A break's no stays the same no.** A cook who defers a job from a break they chose says why this job and not another, and keeps that answer until the break ends (owner bug, `docs/playtests/owner-2026-10-19.md`).
- **Cooks go where the work is, and say so** (pass@3). Work waiting at a station makes it more meaningful to a cook (HF `advertises.meaning`, in proportion to what waits). A self-chosen move goes in the journal with its visible reason.
- **Requests do not wait forever** (pass@3). Dilek's mother: six minutes, then she goes anyway. Other requests drop after ten to twelve minutes. Ignoring costs more trust than a no.
- **The crew rule covers going home** (pass@3). The last cook in leaves only with leave given or an empty rail.
- **Close lines claim only what happened** (pass@3). Lapses are named in each cook's words, and only for commitments the cook would talk about. A no is remembered as let be only if it stood. Selim prays maghrib at home on days without service.
- **Pushing is remembered** (pass@3). Sunday quits run from the first Sunday; earlier weeks' compliance carries over, halved each week. A quit after week 1 opens hiring early.
- **A quiet kitchen runs the clock four times faster** (page only).

## Deferred (target: after the owner plays pass@2)
- Waiters and front-of-house as HF people.
- Workers AI voice for the evening (not needed; HF lines carry it).
- A cook quitting mid-service, not only on Sunday.
- Bad guests: a table that pushes a cook, and a cook who answers back.
- A supplier failing on the wedding night.
- A limit on how many rush asks a cook will refuse before he stops answering (now unbounded).
- A crew-level duty in HF instead of the host's crew rule (HF request 6).
- A hire's own voice in service: hires speak HF's stock answers until the Sunday page (rule-breaker playtest).
- Talking to a cook outside the scripted moments ("Rafi has been quiet all afternoon"; cozy playtest).
