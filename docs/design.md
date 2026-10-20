# The Pass: design

**One line.** You inherited your late aunt Nevin's neighbourhood lokanta, and with it three cooks who were loyal to her, not to you. The bank wants the arrears by Saturday close. Six dinner services. Every cook can say no.

**Done for the first playable** (set 2026-10-18 by the coordinator's brief; the owner accepts feel separately): six playable nights with one new pressure each, an ending, a playtest export that replays, tests, a headless balance measure, a late source-unread playtest recorded verbatim, live at https://pass.adamwhite.work.

## How it was chosen (2026-10-18)

Three concepts were written (kept below) and sent, with the owner's taste signal and nothing else, to two consultants who did not read any source.

- **Game-design expert (Opus):** picked A. "It is the only concept where body, norms, trust and self-review all bite every night, and six nights give the evening reviews somewhere to land." Half Time: high slow-sim risk and a big spatial build. Last Ferry: "plays as a one-night puzzle … sits close to The Night Watch." Biggest risk for A: refusals read as dice rolls in the chaos, so every refusal needs a visible sign before it and a reason in the cook's words; insisting must have a price you can see later; one new pressure per night, introduced by a person, not a tutorial.
- **Wildcard (Sonnet, a line cook turned night nurse who plays on the bus):** picked A ("Reigns with a spatula"), would delete B ("a group chat, not a game"), called C "one puzzle in a costume". Phone-down list: a tutorial before the first ticket, a backstory wall, tiny buttons, unreadable refusals, a fail screen that replays three minutes, any meter. "I want to be mid-rush in 20 seconds." Wild idea: the evening is a dish-pit confession, each cook says one line about your night, and it comes back tomorrow as a consequence; the share card is the crew's lines about you.

**Pick: A, The Pass.** Both consults chose it independently. It is fast (the rush paces it, so it is not another slow expedition sim), its choices are sharp (push a tired cook or fall behind), and every HF faculty that matters shows each night: refusals and counter-offers, trust and insisting, bodily forecasts ("I can do the rush, but I'll be spent for close"), a prompting at the tip jar that a cook can learn to let pass, and the evening review (muhasaba) whose resolve changes tomorrow.

## Rules taken from the consults
1. A night is about 2½ real minutes at normal speed; the clock slows for an unanswered request or a station needing a cook; inspecting a cook keeps the current rate. Every simulation step stays one minute.
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

## Clarity follow-up (F-227, 2026-10-20)

- The clock shows its actual game minutes per real second, including the fourfold clear-rail speedup. Unanswered cook requests and missing station coverage use 0.1 min/s until answered. Waiting for a cook to act runs at the chosen speed. Inspection alone does not slow time.
- The rendered journal glosses maghrib as sunset prayer. Simulation text and state stay unchanged for replay.
- Acceptance for this round: the common brief's tests, phone/desktop renders, exact current-edition replay/continuation, deployment and release receipt. The Opus driver retains taste and final review.

## Deferred

- **Resolved in pass@4, 2026-10-20 — F-227 first-service problem frequency:** the new edition brings three seeded tickets forward and adds chef food work. The original pass@3 schedule and autonomous returns remain unchanged for its notebooks. This replaces the 2026-11-03 deferral for new runs; taste still needs a source-unread retest.

## Earlier deferred work (target: after the owner plays pass@3)
- Waiters and front-of-house as HF people.
- Workers AI voice for the evening (not needed; HF lines carry it).
- A cook quitting mid-service, not only on Sunday.
- Bad guests: a table that pushes a cook, and a cook who answers back.
- A supplier failing on the wedding night.
- A limit on how many rush asks a cook will refuse before he stops answering (now unbounded).
- A crew-level duty in HF instead of the host's crew rule (HF request 6).
- A hire's own voice in service: hires speak HF's stock answers until the Sunday page (rule-breaker playtest).
- Talking to a cook outside the scripted moments ("Rafi has been quiet all afternoon"; cozy playtest).

## New runs: pass@4 (2026-10-20)

The owner accepts the feel of the new service separately. The edition is part of the notebook. New runs use pass@4. A pass@3 notebook stays on pass@3 when loaded, replayed, exported or continued. The old edition keeps its original ticket rolls, decisions, input effects and serialized state. No cover or chef-task keys are added to a pass@3 state. The HF dependency remains exactly 2.8.0.

- **A station request has an end.** In pass@4 the requested station offer includes the full duration when predicting and deciding. If accepted, the cook says which station they will hold and the clock time they will finish. Before 20:30 this means until the rush eases at 20:30, or at least 45 minutes if asked near that time. Later it means 45 minutes, bounded by close. The cook keeps the station through the old 25-minute batch boundary and autonomous reviews. Body time, fatigue and food production continue each minute. A new explicit request can change the assignment. A granted emergency request can interrupt it. At the agreed end the cook chooses again. Autonomous work still uses the old 25-minute offers.
- **The chef can make food.** An open ticket offers one unfinished grill portion or cold plate. The chef works on one selected portion for five kitchen minutes while the crew continues. The ticket records the finished portion. The normal pass still requires the other portions and a clean plate. A table that leaves cancels the task. If the crew finishes those portions first, the chef puts the ingredients back and says so. No extra portion is banked. There is no oven shortcut, and the chef cannot grill without gas.
- **Monday starts sooner.** The first three existing seeded tickets arrive one, nine and seventeen minutes after opening. The number, price and dishes of those tickets keep their seeded values. Later arrivals keep their old rolls. This gives the opening service a short sequence of food and staffing decisions without adding another character or tutorial.

`test/fixtures/edition3-hashes.json` was captured before the edition changes. It covers three policies across eight services, the first Sunday, full-state SHA-256 checkpoints, and thirty-minute continuations restored from those checkpoints. The previous counter-offer save and its continuation hash remain separate acceptance evidence.

## Round 4 controls (2026-10-20)

The crew row reserves the same position throughout each service, including selection, queued requests, spoken answers, incoming requests and quiet rails. Asking keeps the selected cook. Clock updates preserve the control nodes, keyboard focus and an active press. Each job shows its own current likely answer; the separate preferred-station body forecast has been removed from the sheet. Station duration is shown beside the jobs, and accepted pass@4 cover stays visible there. pass@3 explains its original 25-minute stretch and subsequent autonomous choice.

Acceptance remains the common brief's builder checks and release receipt. The driver accepts feel separately after a fresh source-unread test. In particular, the longer assignments reduce repeated asking; the old six-night policy that forced a quit is retained as a pass@3 test. pass@4 tests still verify lost trust from insisting, bodily costs, refusals and campaign progression; a specific Sunday quit under the new policy is not claimed.

## Design change 2026-10-20 (owner may veto)

New notebooks use **pass@5**. Before opening, a sensible board offers each present cook a station, a twenty-minute meal break and named relief (or an explicit uncovered interval). One proposal lets the crew answer through HF in their own words. An accepted station uses pass@4's existing `cover` and agreed end time: first to the break, then to close. The player can change station, time or relief and ask again. A refused revision cancels the old agreement. Conflicting relief cannot cancel a cook's own break. “Same as last night” carries the arrangement, reconciled with tonight's crew, in one tap; tonight's answers remain visible before opening.

Joon, **F-243**: “asking cooks back to stations was more of the activity than the food”. Rosa, **F-256**: “grill is still empty, Rafi is still on dishes, and I do not want to keep pulling people back into place on my break.” Her requested change: “I want to make an occasional staffing decision, not repeatedly discover an empty grill.” The board keeps routine coverage running. An unplanned bodily need or emergency creates one staffing choice naming the cook, station and expected absence. Choosing temporary cover borrows that cook until the expected return, then restores their agreed station. Only playback slows for the unanswered choice. A planned uncovered meal break is a known tradeoff, not a repeated alert.

Ad-hoc asks, refusals, insisting and its trust cost, body forecasts, the jar, evening accounting and the campaign remain. During an agreed break, the existing HF offers can still lead to a private cigarette, jar temptation or quiet prayer before the cook eats and returns at the agreed time. In pass@5, a deferred ad-hoc answer explicitly says **no cover is promised**; it does not create a hidden queue. The current-service journal excludes old departures. A job dot means the cook's current station. The opening and help gloss Turkish lira once; all monetary rendering uses `lira()` with English grouping. Legacy stored narration is formatted at rendering, without changing saved text.

**Costs and risks:** the opening adds a board proposal and a separate open action so refusals remain readable. The cook can reject relief, leaving a planned gap; the player may revise it or knowingly open with it. Default Monday has two cooks for two stations, so meal breaks leave a station uncovered. Coverage improves overall in the plain six-night comparison, but Friday's demand gap is slightly worse (167 versus 163 station-minutes). These measurements establish behavior, not enjoyment. The lead retains taste and source-unread acceptance.

**Edition and revert:** pass@3 and pass@4 notebooks retain their original rules, serialized keys and exact replay/continuation hashes. Set `GAME_VERSION` in `src/sim/kitchen.ts` back to `'pass@4'` to make new notebooks start on the previous edition. Existing pass@5 notebooks remain supported by the explicit `canReplay` allowlist when making that change. No HF pin change. Remove this edition's UI by reverting this edition's commit if the owner vetoes the whole change; preserve exported notebooks before doing so.

**Acceptance:** passing checks and browser tests, pre-change full-state legacy fixtures, before/after phone and desktop renders, published release receipt and green CI. The lead accepts feel separately. Nothing in the requested implementation is deferred.

### Follow-up b (2026-10-20)

The lead's taste review of `final-agreements-360.png` found a native 12-hour picker inside a kitchen that speaks 24-hour time, actions before the people answering, and carried gaps when a relief cook joins. The board now offers station, break and cover chips. Breaks name 18:10 before the rush, 19:45 during it and 21:00 after it; a saved/default time remains selectable. All targets are at least 44px. Cards come first, then “Open the doors” and, only for unanswered edits, “Ask them about the changes”. “Same as last night” still proposes the carried choices in one tap, including deliberate gaps.

The default names available dish relief when the crew changes. Actual HF answers, including refusals, appear beside that choice. Monday plainly says “No one to cover; the grill waits while Selim eats.” Borrowing another cook names the station that waits. Reading a board previews the unchanged HF decision on a copy; opening records that existing board input before the open input. Viewing/resuming a notebook adds no input. An already agreed board is shown exactly as saved.

**Costs and risks:** the board is longer and scrolls on a phone; actions follow all cards. A named relief cook may refuse. The lead retains taste and fresh source-unread acceptance. This follow-up changes UI input suggestions only; simulation source and the exact HF 2.8.0 pin are unchanged. Existing pass@5 exports retain their edition and exact replay/continuation hashes captured from 87f5701. Revert the follow-up UI with `git restore --source=87f5701 -- src/ui/app.ts src/ui/style.css`; the extra UI helper then has no callers. No work is deferred.


### Follow-up c (2026-10-20)

The lead's review of `final-agreements-360-b.png` found that the roughly 1500px phone board put “Open the doors” beyond the first screen (DL-22, DL-6). On phones, each cook now shows a station/break/cover summary and the actual answer. “Change” expands that cook's chips; switching cooks retains unanswered edits. “Done” collapses the chips. Desktop keeps the chips inline. The phone action group sticks to the bottom with safe-area padding. Its measured height reserves scroll clearance, so focused chips and answers can be brought above it. The group retains its own space below the cards. “Same as last night” remains one tap.

An unchosen cover says “No cover chosen” and names the available cook and the station borrowing them would leave waiting. A refusal still says that the named cook has not agreed. No simulation, edition, HF pin, replay fixture, or input schema changes.

**Costs and risks:** editing now takes one extra tap; long replies and larger crews still scroll. The default Monday cards and opening response fit the first 360×690 viewport. Renders and browser checks establish reachability, not a first-time player's actual thirty-second decision time; the lead retains taste and source-unread acceptance.

**Revert:** restore `src/ui/app.ts`, `src/ui/style.css`, and `test/browser/rota.browser.ts` from `640188f0153032e12112133c370a21935eb4c785`. Existing pass@5 notebooks remain on their unchanged rules.
