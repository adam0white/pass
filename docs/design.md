# The Pass: design

**One line.** You inherited your late aunt Nevin's neighbourhood lokanta, and with it three cooks who were loyal to her, not to you. The bank wants the arrears by Saturday close. Six dinner services. Every cook can say no.

**Done for the first playable** (set 2026-10-18 by the coordinator's brief; the owner accepts feel separately): six playable nights with one new pressure each, an ending, a playtest export that replays, tests, a headless balance measure, a late source-unread playtest recorded verbatim, live at https://pass.adamwhite.work.

## How it was chosen (2026-10-18)

Three concepts were written (kept below) and sent, with the owner's taste signal and nothing else, to two consultants who did not read any source.

- **Game-design expert (Opus):** picked A. "It is the only concept where body, norms, trust and self-review all bite every night, and six nights give the evening reviews somewhere to land." Half Time: high slow-sim risk and a big spatial build. Last Ferry: "plays as a one-night puzzle … sits close to The Night Watch." Biggest risk for A: refusals read as dice rolls in the chaos, so every refusal needs a visible sign before it and a reason in the cook's words; insisting must have a price you can see later; one new pressure per night, introduced by a person, not a tutorial.
- **Wildcard (Sonnet, a line cook turned night nurse who plays on the bus):** picked A ("Reigns with a spatula"), would delete B ("a group chat, not a game"), called C "one puzzle in a costume". Phone-down list: a tutorial before the first ticket, a backstory wall, tiny buttons, unreadable refusals, a fail screen that replays three minutes, any meter. "I want to be mid-rush in 20 seconds." Wild idea: the evening is a dish-pit confession, each cook says one line about your night, and it comes back tomorrow as a consequence; the share card is the crew's lines about you.

**Pick: A, The Pass.** Both consults chose it independently. It is fast (the rush paces it, so it is not another slow expedition sim), its choices are sharp (push a tired cook or fall behind), and every HF faculty that matters shows each night: refusals and counter-offers, trust and insisting, bodily forecasts ("I can do the rush, but I'll be spent for close"), a prompting at the tip jar that a cook can learn to let pass, and the evening review (muhasaba) whose resolve changes tomorrow.

## Rules taken from the consults
1. A night is about 2½ real minutes at normal speed; the clock slows for an unanswered request or a station needing a cook; inspecting a cook eases the clock, and spoken answers get reading time (owner speed sweep, 2026-10-21). Every simulation step stays one minute.
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

## The people (HF pinned exactly: 2.8.0 through pass@9, 2.13.0 from pass@10)
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

- The clock shows its actual game minutes per real second, including the fourfold clear-rail speedup. Unanswered cook requests and missing station coverage use 0.1 min/s until answered. The game sets its own pace: quiet stretches pass briskly, a cook’s account eases the clock, and fresh speech gets reading time. The Game menu preserves that time.
- The rendered journal glosses maghrib as sunset prayer. Simulation text and state stay unchanged for replay.
- Acceptance for this round: the common brief's tests, phone/desktop renders, exact current-edition replay/continuation, deployment and release receipt. The Opus driver retains taste and final review.

## Deferred

- **2026-10-20b taste acceptance (target 2026-11-03):** the lead retains source-unread acceptance of pass@8 after builder checks and deployment. Automated action counts establish availability, not whether cooking feels good.

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

## Design change 2026-10-20 (owner may veto)

**Round 2 (follow-up d), pass@6.** The rota stays. New runs give the chef a reserved portion at a waiting food station. A tap starts that work immediately. The crew cannot finish that portion first. The chef works at their own pace and tires; the kitchen describes the cost in words. During a backed-up service the chef can put one table first at the pass. Its portions and clean plate take priority, so the other tables wait. A cook acknowledges the call. Fixed station controls and waiting tickets offer the same food action. The Game menu holds save, Download this run, and Send this run to the notebook.

Tomasz's fresh retest (no ledger id assigned in the supplied report) praised “the schedule actually held … this let me leave them alone”, then stopped at Monday close, 3:09: “I came for running a busy room and mostly watched it run.” His first two requests were reliable personal food work and something worth managing earlier. These follow Joon **F-243** and Rosa **F-256**, whose repeated station asks the rota removed. The fun review's two recommendations are included: a borrow through close accepts the named source-station gap, and the first two default meal times are swapped so Selim's break overlaps his existing quiet choice. Faith gains no objective or prompt.

**Costs and risks:** doing food work spends the chef's strength and attention. Prioritising a table delays the others. More concentrated early demand may make an unattended opening harder. These are rules and interface checks; the lead still accepts feel through a fresh source-unread retest.

**Revert:** set `GAME_VERSION` in `src/sim/kitchen.ts` to `'pass@5'` for new runs to start on the previous edition. Keep the explicit `canReplay` support for pass@6 if any pass@6 notebooks exist. Existing pass@3/4/5 notebooks retain their original rules and serialized state. To revert the entire interface, restore `src/ui` from `7116cfc8fe32b8e2504ed9f29ba382d515d599b6`; preserve notebooks first. HF stays exactly 2.8.0.

**Done for this round:** the ranked owner brief implemented, replay and behavior tests, headless policy measurements, phone and desktop renders, `npm run check`, signed commit with Codex trailer, main pushed, deployed release equal to HEAD with `dirty: false`, green CI, and the follow-up d report. The lead retains taste and source-unread acceptance.

The first three existing seeded orders arrive at opening plus one, three and five minutes in pass@6, creating an opening dinner rush without adding tables. Their dishes, prices and seeded patience stay intact. Simultaneous arrivals use distinct free table numbers. The pass call appears when at least two unfinished tables owe more than four minutes of a station's current capacity. It happens at most once per service. If the kitchen clears the choice before the chef answers, the call ends. A chosen table reserves its last necessary clean plate as well as portion priority. Cooking prevents making that call until the chef's hands are free; it does not stop the other cooks. Work can avert the backlog, so a player who cooks constantly may never need a pass call.

## Design change 2026-10-20b (owner may veto)

**Round 2, pass@8 (2026-10-20).** A tap takes a waiting portion, or marks one **Chef’s next** while your hands are busy. The crew leaves that portion for you. When you are free, a station briefly offers its next portion in the cook’s words, “Yours, Chef?”, before taking it. Each recipe has one time choice: plate the salad now or dress it carefully; pull the lamb now or rest it properly; take the pide out or give its crust another minute. Care takes extra kitchen time while other tables wait. The food and the table’s words record the result. A large board, pan or oven surface holds the direct acts. **Finish on instinct** delegates only that portion at plain quality. Its compact control stays available while inspecting a cook. Completed-step feedback and controls update together; full scene speech moves to the journal rather than being cut.

Mateus’s supplied live retest (no new ledger id assigned) quit at **3:35**: “I do not want another round of the same text-button steps”; “two attempts to take a portion returned ‘already plated’”; “I want to cook, not race my reading against automatic completion.” The supplied adversarial review says pass@7 “replaces some watching with prescribed taps, while the interesting decisions still concern tables and people.” This extends **F-276/F-277** and serves **DL-13, DL-14, DL-15, DL-22, DL-23, DL-30, DL-31, DL-32 and DL-33**. The lead retains taste and fresh source-unread acceptance.

**Round-2 costs and risks:** reserving work can delay a table; careful food takes longer and spends more of the chef’s strength. A plain portion can feed someone sooner. Delegation lets the chef attend to people without accelerating their room. Builder policies establish availability and costs, not enjoyment or a reason to repeat the campaign.

**Round-2 revert:** set `GAME_VERSION` in `src/sim/kitchen.ts` back to `'pass@7'` for new runs; retain the explicit pass@8 replay branch for existing notebooks. Restore `src/ui` from `bf28f56a244bc23afe4c4d3ae555720741771369` to remove this round’s interface, preserving notebooks first. The pre-change live asset and pass@7 full-state hashes are recorded in `test/fixtures/edition7-live-pattern-hashes.json`; pass@3..7 fixtures remain required. HF remains exactly 2.8.0.

**Round 1, pass@7 (superseded for new runs by round 2).** A reserved portion has short acts on its station: sear, turn, rest and plate on grill; cut, dress and plate on cold; shape, bake and plate at the oven. The kitchen says when each act is ready and names its game-clock time. A ready act has an eight-minute window. Default and Slow playback slow for reading and tapping; Fast handles the steps on instinct at plain quality. Timely work produces a careful plate, noticed in words. Late or missed work still finishes, slower and plainer. Cooking spends the chef's existing bodily capacity. Finished plates wait visibly at the pass. Tapping one calls service; a runner takes plates left waiting, cooler. The rota and occasional table-priority choice remain. The ticket rail sits above the cooking controls, with reserved header space, so a new portion or plate cannot move an existing table target. Presses preserve controls through a short release interval; stale replies appear immediately.

Adaeze **F-277**: “There is no chopping or serving action to perform while it cooks.” Her ranked requests also asked to know what happened after a disappearing portion was tapped, and to keep the table target steady. Tomasz **F-276**: “I came for running a busy room and mostly watched it run.” These drive scene cooking and plate calls (**DL-32/DL-33**), immediate stale-tap replies (**DL-13**), stable ticket targets (**DL-23**), readable step timing (**DL-15**) and visible phone commit rows (**DL-22/DL-30**). The fun review **F-282** supports keeping the rota and its reduced staffing repetition.

**Costs and risks:** careful food asks for more attention and bodily work. Runner fallback keeps unattended service possible, with cooler plates. More acts do not establish enjoyment or campaign balance. A headless policy reacts without human reading delay; its counts are builder evidence only. The lead retains taste and fresh source-unread acceptance.

**Edition proof:** before simulation edits, the live `19419a9` production asset was executed for pass@5 and pass@6, seeds 42/1001/2026 and idle/plain/insist input policies. `test/fixtures/edition6-live-pattern-hashes.json` records provenance, 54 full-state checkpoints, restored thirty-step continuations and complete notebooks. Tests replay, restore and re-export those notebooks exactly. Prior edition fixtures remain required. HF stays exactly 2.8.0.

**Revert:** set `GAME_VERSION` in `src/sim/kitchen.ts` to `'pass@6'` so new runs use pass@6. Keep pass@7 replay support for existing notebooks. To remove the new UI as well, restore `src/ui` from `19419a989064d17d33be96c3a8bc687e1af1d0a9`, preserving all notebooks first. Acceptance for this round is the owner brief's tests, measurements, phone/desktop renders, signed commit, push, live receipt and green CI. The lead accepts feel separately.


**Builder measurement (2026-10-20b):** `node scripts/measure-hands-on.ts` compares pass@6/pass@7 on seeds 7/21/42, three policies and six services (108 service rows). The attentive policy averages 17.28 → 86.39 scene acts per service; tables fed are 446/447 → 440/447. Its longest Monday unavailable gap is 25.67 → 20.00 real seconds, including the final clear-rail wait from 20:00 to 22:00 at 6 game min/s in seed 7. Through the last feed, the worst gap is 20.67 → 16.33 seconds (seed 42, 17:46–18:51 in pass@7, with clear-rail acceleration). This meets the twenty-second threshold with no margin at closing. Manual staffing asks remain zero; staffing decisions average 0.17/service. Chef exertion before evening recovery averages 0.192 → 0.242; these internal numbers are measured, never displayed to the player. In pass@7 attentive play serves 221 careful/hot and 219 plain/hot plates. Instinct play serves 440 plain/hot plates. Hands-off play feeds 421/447 in both editions; pass@7's plates arrive cooling. The instinct policy holds default playback timing to isolate quality; it is not a measurement of browser Fast duration. Policies inspect once per game minute with no reading or reaction delay. These are availability and balance measurements, not enjoyment evidence.

## They came back (pass@9, 2026-10-20; owner may veto)

**Why.** The owner played the original week 1 (pass@1), won it 143 of 149 tables, and asked for more: "Improve pass, too, including extending it coz I need more!" (F-013). Weeks 2-4 (pass@2), the rota (pass@5) and chef cooking (pass@6-8) already exist and he has not played them, so this slice stays inside the 18 services and adds no week 5. The measure says why it is needed: on pass@8 a bot that touches nothing pays week 1 on every seed, and a flexible bot that never cooks wins all four weeks on every seed with ₺450-₺2,100 to spare (`~/code/.lab-scratch/pass-more/measure-baseline.txt`). A strong player is not tested after the first Saturday. Owner, 2026-10-20: "It's okay to have slight controversies, for example on difficulty." So the default gets harder for a player who is winning, and the easier setting is opt-in.

**How it was chosen.** A Codex wildcard (a meyhane cook turned board-game designer) proposed six shapes of more and picked returning guests with promised dinners. An adversarial review (Opus, contrarian management-sim designer) kept the idea and changed it: no week-1 booking (the week the owner loved stays as it is), the player chooses what to promise on Sunday, a strike only for a promise the player made, a broken promise in week 4 is a strike and not a loss, the booking sits in the measured rush, and its own fields (not the wedding's `due`). The lead added: the guests come back whether or not you promise, and how many come depends on how well you have done. Both files are in `~/code/.lab-scratch/pass-more/`.

### Rules (new notebooks, pass@9)

1. **Week 1 is unchanged.** Every rule and seeded table of pass@8 holds through Saturday close of week 1. Only the version string differs.
2. **Returning parties.** Each Sunday page of weeks 1, 2 and 3 names two parties coming next week (`PARTIES` in `src/sim/campaign.ts`). They are chosen from the seed and the week, never by input; the food writer is one of week 1's two if she smiled on Friday. A party has a host, a night, a seating time, an order and one **signature portion** (a station and how it should be done: "the lamb, rested properly"). They come whatever the chef decides. A party that is a regular's replaces that regular's own ticket on that night, so nobody comes twice.
3. **Word gets around.** A party's order is its base size (two or three portions), plus one portion if last week had no walkouts, plus one per promise kept so far (at most two). A kitchen that is winning gets larger parties in its busiest hours. A kept promise also sets the regular's existing `friendNext`. And whoever is owed next week saw the queue: after a paid bill with nothing carried, next week's bill rises by half of what is left in the till (`SEEN_SHARE`), shown on the Sunday page ("and ₺260 more: Ahmet saw the queue on Saturday"). A winner cannot sit on a cushion; a kitchen that only just pays sees almost nothing.
4. **The promise.** On Sunday, each party gets one choice: **Promise it** (the signature portion done with care, the whole order out by the served-by time) or **As it comes** (ordinary service). Leaving Sunday without choosing means as it comes. The card shows the night, seating, order in words, the signature, the served-by time, and one line from the cook of the signature's station, chosen by how much they trust the chef.
5. **Promised service.** When a promised party sits, it comes first: its portions and its clean plate go before every other table at every station and at the pass (ahead of a pass-priority choice). Its signature portion is the chef's: the crew never takes it, and it waits behind the chef's current portion as Chef's next. Kept means the chef chose care on that portion and the whole order was served by the served-by time (seating plus 25 minutes). A promised party waits up to 35 minutes before leaving. Finishing the signature on instinct hands it to the crew at plain quality and breaks the promise. A kept promise pays a premium and raises the regular's regard; the journal names the table that waited longest while the chef cooked it. A broken promise costs regard and is written down.
6. **The stake.** At Saturday close a broken promise is a strike. A short bill and a broken promise in the same week together make one strike, not two. Two strikes lose the lokanta, as before. In week 4, a short bill still loses at once; a broken promise alone is a strike.
7. **Nevin's pace (opt-in, easier).** On the title page, before a new notebook, "Nevin's pace": every week keeps week 1's table patience (38 minutes), and nobody adds to a bill for having seen the queue. It is recorded as the notebook's first input, so a notebook replays with it. The default stays hard. Parties and promises are unchanged by it.
8. **Begin at week two (opt-in).** On the title page, "Begin at the second week": a steady hand runs week 1 (a fixed host policy, recorded as ordinary inputs, so the notebook replays exactly) and the chef takes over on Sunday of week 1, with the first two parties on the page. For a player who has already played week 1, and for playtests.

### HF made visible by it
A party in the rush collides with agreed meal breaks, so a cook's break, refusal or counter-offer now has a named cost. The bodily forecast says whether a cook can hold the station through the party. Insisting can save a promise and comes back as protest, trust lost and Sunday quits. The station cook's Sunday line reads their trust in the chef in words.

### Depends on, and fallback
The promise rests on pass@8's chef cooking, whose feel is not yet accepted (deferred, target 2026-11-03; two testers quit on it, F-283, F-284). If the owner vetoes chef cooking, the promise becomes a pass priority plus the served-by time: the same choice, without the signature portion. Not built.

### Acceptance (builder checks; the lead accepts taste)
- pass@3..8 notebooks replay and continue exactly; pass@8 gets a full-state fixture captured from the live 5a2a449 asset before any simulation edit. HF stays exactly 2.8.0.
- Week 1 under pass@9 equals pass@8 (full-state hashes with the version normalized) for every measure policy through Saturday close.
- `scripts/measure.ts`, seeds 1000-1009, adds `flex-chef` (flex plus careful chef cooking) in two arms, promising every party and promising none. Targets: flex on pass@9 banks less or walks more on party nights than flex on pass@8 (the default rises for a winner); `flex-chef` promising everything takes a strike on at least 2 of 10 seeds and walks at least one more table on party nights than promising none; promising ends with a higher mean till than not promising, but not on every seed; ask and care win more seeds under Nevin's pace than without it.
- Fresh testers start with Begin at the second week, and should be able to say which promise they made and why, and name the table that waited while they cooked it.

### Revert
Set `GAME_VERSION` in `src/sim/kitchen.ts` back to `'pass@8'`; keep pass@9 in `canReplay` for existing notebooks.

### As built (pass@9, 2026-10-20)

Engine by a Codex worker (`327eb11` live pass@8 fixture, captured before any simulation edit from the live asset of 5a2a449; `432a01d` engine; `3984766` party-first rule), UI by a Codex worker (`dbbc313`), lead's taste and tuning pass on top. Values: premium ₺650 per kept promise; served-by seating + 25 minutes; promised patience 35; `SEEN_SHARE` 0.5. Seatings sit in the rush as booked (Aksoy 19:45, Demirs 19:40, writer 19:50, Hasan 19:55, Kemal 20:10, Ilyas 20:15; Mrs Arslan 18:20 before the grandson's bedtime, against the early meal breaks). Base orders are small (two or three portions) and grow with success.

**Lead's changes to the review's plan, and why.** Round 1 had promised parties wait their turn: the careful bot broke 29 of 44 promises (the signature was always careful; the rest of the order was late) and lost every campaign, so promising was a trap. A promise now puts the party first, and the price is paid by the other tables, which the journal names ("Table 6 waited longest while I rested the lamb."). The worker's tuning then moved every seating to 19:00; the lead restored the booked times, because seven parties at the same minute read as a timer, and the bookings' own words give their times. Round 1 also left a winner who declines every promise with the same game as pass@8 (flex lost ₺22 of margin), so the lead added "they saw the queue".

**Measure** (`scripts/measure.ts`, seeds 1000-1009, bots act every five game minutes with no reading delay; builder evidence, not enjoyment):

| Policy | pass@8 | pass@9 |
|---|---|---|
| flex (never cooks) | 10/10 won, mean till left ₺2,522 | 10/10 won, ₺1,303 left |
| flex-chef, promise none | - | 10/10 won, ₺1,698 left |
| flex-chef, promise the first party each Sunday | - | 8/10 won; 23 of 30 promises kept; a strike on 5 seeds; ₺2,531 left |
| flex-chef, promise every party | - | 3/10 won; 39 of 58 kept; ₺3,028 left |
| ask / care (never cook, ask for stations) | 1/10, 1/10 won | 0/10, 0/10 won |
| ask / care under Nevin's pace | - | 2/10, 2/10 won |

Reading it: a strong kitchen still wins without promises, with half the cushion. Promising one party a week is a bet a careful chef wins most weeks and that pays; promising everything usually loses the lokanta. Weak play loses more than before, and Nevin's pace gives it back some. Week 1 is exactly pass@8 (full-state hashes through Saturday close, 28 seed-policy cases). A source-unread tester has not yet played it; the owner has not.

**Unmet or open.** The review's target "ask wins more under Nevin's pace" is met only against pass@9 default (0 → 2 of 10), not against pass@8 (1 of 10). The promise rests on chef cooking, whose feel is unaccepted (see above).

### Begin at the first party (2026-10-20)

Both fixed-build testers left Wednesday before a party sat (Mert: "The named supper is the reason I might come back."). A third title start, "Begin at the first party", reuses the first-week host run and leaves Sunday's promises to the player. The same steady hand (`advance(s, 'flex-chef', 'promise-none')`) then runs the services and evenings before the earliest promised party next week (or the earliest party if none was promised). The player sets that night's rota board, because the party collides with meal breaks, and opens the doors. The steady hand runs the service to 20 game minutes before the party sits (`runToSeating`, `HANDOVER_LEAD` in `src/sim/firstweek.ts`), and the player takes the pass, possibly mid-portion. A caption names the party, seating and promise. A Codex worker first fell back to a board-only start because it waited for the chef's hands to be free, which the host policy rarely allows; the lead dropped that condition, since the board-only start still left a whole service before the seating.

Difficulty, values, rules, the host policy and `GAME_VERSION` are unchanged. Every host decision is an ordinary input, so seed plus inputs replays exactly; the start choice and the caption live only in UI save metadata. Hand-over on seeds 42, 1000 and 1001: 19:30 for a 19:50 seating, 19:50 for 20:10, 19:30 for 19:50.

Display fixes: one nearest table within eight minutes of walking says “about to leave”; the oven choice and journal say “Leave it in for the crust” beside the unchanged duration; phone Sunday links to both party cards above the fold; the journal explains a refused board station later taken autonomously, using the recorded move and board answer.

## What is new since the week you played (for the owner)

You played the first week of pass@1 on 2026-10-19. Since then, in order:
- **Four weeks, not one** (pass@2): 18 services, a Sunday page between weeks, a bill each Saturday (the bank, Ahmet the butcher, the landlord, the bank again), strikes and carried debt, hiring and quitting, Nevin's regulars and their tabs, the pide oven, the anniversary, the night the gas fails, the Yıldız wedding.
- **Cooks who say no and remember it** (pass@2-3): insisting is visible pressure and comes back in the evening and on Sunday; cooks go where work waits; requests expire.
- **A rota board before each service** (pass@5): each cook agrees a station, a meal break and who covers it; "Same as last night" in one tap.
- **The chef cooks** (pass@6-8): take a portion, rest the lamb or pull it now, call a table first at the pass, finish on instinct.
- **They came back** (pass@9, new): parties return because you fed someone well, larger the better you do; on Sunday you choose what to promise them; whoever you owe sees the queue. Start with "Begin at the second week" to skip the week you know; "Nevin's pace" is the easier way in.
- **Clarity fix after the pass@9 retest** (2026-10-20, display only, every edition replays unchanged): both fresh testers who began at the second week quit confused on Wednesday because nobody was on the oven and nothing said the chef cannot warm it. The board now says when nobody is on a food station ("only a cook standing at it keeps it hot"); the chef's oven button reads "Cold. Nobody on it" and is disabled until a portion can start; a held oven portion says nobody is warming it; a cooking step that is not yet due is shown disabled instead of as a live button. Difficulty is unchanged: the oven still needs a cook, taken from somewhere else.
- **Second retest round** (2026-10-20, live c021f83): the oven fix worked for Dara, who put Rafi on the oven from the board warning ("The warning actually tells me why pide would fail"). Mert's run gives no evidence on it: Selim refused the oven on the board, then went to it on his own, and Mert did not understand why ("makes me unsure whom to trust"). Both quit BORED on Wednesday, the first night, before any promise resolved: the cooking loop repeats for a whole service, and a party night is one to three services away. Mert: "The named supper is the reason I might come back." Fixed: a named ticket (a regular or a party) now also says its table number, because the pass calls tables by number. Fixed by Begin at the first party (2026-10-20): the new start hands the player the pass 20 game minutes before the first party sits. Also fixed, display only: the oven choice now agrees with its duration; the nearest table about to leave is named in words; phone Sunday links to both party choices; a cook’s autonomous move to a station refused on the board gets an explanation in their words. Recorded, not changed (target 2026-11-03): at Fast a portion can finish on instinct between looks.

## pass@10 (HF 2.13.0)

New notebooks use pass@10 and pin `@adam0white/human-framework` to exactly 2.13.0. Returning parties, promises, Nevin’s pace, the rota and chef cooking carry forward from pass@9.

Every pass@10 cook, including hires, enables HF suggestion reasons. Captions, rota replies and job-button hints translate `decidedBy` into kitchen words: a running break, work that would leave the cook spent later, a habit, a held rule or a bodily need. Unknown or absent explanations get a neutral line; sources and margins are never shown. After Deniz's retest (F-398), a probe found the neutral line hid Selim's sunset prayer (`norm:salah`); a deferral it decides now says “Let me pray first, Chef.” Across 280 probed deferrals on five seeds no neutral line remains. Counter-offer buttons remain. A break deferral repeats the original reason until that break ends. Earlier editions retain their old wording and do not enable the flag.

Selim alone holds “my rule about the plates” with `firm: true`: he will not wash plates in the rush, even when the chef insists. Dilek’s smoking rule, Rafi’s jar rule and every rule owed to the chef keep their existing behavior. No hire template has a personal abstention to make firm. The host policies skip a refused insist.

The live pass@9 asset from `382bba8` was captured before edits: `test/fixtures/edition9-live-pattern-hashes.json` records its URL, SHA-256 and byte count, nine seed/policy rows, 27 checkpoints with restored continuations, and a sample notebook. No earlier fixture was changed. `test/hash.ts` compares legacy hashes and notebooks after normalizing only each person’s engine stamp to the fixture’s recorded HF version and removing `ref` only from `review:resolve` terms. HF CHANGELOG 2.9.0 documents that added reference; 2.13.0 documents the version stamp and opt-in features. Every other serialized field remains covered by the legacy hashes.

The body-reason test uses HF’s real prediction on autonomous offers with controlled depletion. Direct station-cover offers currently omit `followedBy`, so they generally cannot produce a `forecast:body` explanation; this edition preserves that offer rule. The engine checks establish deterministic behavior, not player acceptance of the wording or feel.

**Playtest fixes in the same release** (display and playback only, every edition; Selin's run, ledger F-392 to F-394): under Begin at the first party, the Sunday button names the night the player takes over and follows the promise choices (F-393), and the hand-over caption says the steady hand ran the service and what the chef's hands hold then; saves from before this release say only that the steady hand ran the service. On phones, the party's name, the promise and its out-by time sit beside the active portion (F-392). At Fast, an unanswered "Yours, Chef?" no longer slows the clock; Slow and Steady still do, and the simulation's offer window is unchanged (F-394). A Codex review found one issue (old saves described the current kitchen as inherited), fixed before release.

**Revert:** set `GAME_VERSION` in `src/sim/kitchen.ts` back to `'pass@9'`. Keep pass@10 in `canReplay` so its existing notebooks still load with their own rules.

## Opening approaches and the optional tally (F-414, F-415)

Selim offers time to get the lamb right; Dilek wants to learn the usual rush. Their opening lines explain Nevin’s pace and the unchanged default. The second-week and first-party starts still say that a steady hand runs the kitchen before the hand-over. These are presentation changes. The pace input, waiting rules, start policies, edition, saves and replays keep their existing behavior.

The Game menu offers “Keep a tally in the notebook”, off until chosen and forgotten on page reload. Only the final page shows it, including a lost kitchen. The kitchen’s tally is tables served minus tables walked plus ten times weekly bills paid, taken from the existing night reports. The final page discloses every component and calls it the game’s own reckoning, not a measure of people. Changing the checkbox on that page updates it immediately. No tally or preference enters the simulation, save or export.


## Learnings from the hands-on chef route

The owner rejected chef cooking after run `r-eezsdpskcr` on pass@10. Their [verbatim verdict](playtests/owner-2026-10-21.md) takes precedence over the earlier chef plans. The route began with pass@4 help portions, expanded in pass@6 into reserved chef portions and rush table priorities, added timed steps and table calls in pass@7, and added portion choices, reservations and finishing on instinct in pass@8. Pass@9 then required a careful signature portion for a Sunday promise. These features made the player repeat kitchen actions while the people waited. Two earlier testers stopped before reaching a party. The owner called even table calls too involved.

**Decision, pass@11:** the crew cooks and sends completed plates automatically. Remove chef portions, timed steps, care choices, instinct finishing, portion reservations and table-priority calls from play. Keep the rota and decisions about people. Keep refusals that say why, Selim’s firm plates rule, returning parties, Sunday promises, Nevin’s pace and the first-party start. A promise puts the party first and requires its whole order by the agreed time; it no longer requires a chef signature. This is the fallback already described in the pass@9 design.

The useful lesson is about the player’s job: decisions about a person can carry a visible consequence; repeated preparation and dispatch clicks distract from those decisions. A named party and an agreed deadline make the cost legible without extra hand actions. Keep a short route to that decision and explain refusals in the cook’s words. The owner also asked the builder to insist next time when a proposed route conflicts with that purpose. Treat that as a requirement to state a recommendation plainly and defend it with evidence before expanding scope.

Historical simulation rules remain only to replay existing notebooks. Loading or continuing a pass@3–10 notebook appends one `people-run` input and shows one sentence: “The crew now cooks and sends plates; you run the pass through people.” Migration frees unfinished chef work and any plates held at the pass, preserves the seed and earlier inputs, and replays deterministically. Existing party bookings keep their times and choices.

Done for this change means a verified pass@11 build, replay and continuation checks for the owner’s notebook and historical fixtures, and phone checks for the first-party start and migration. The owner accepts the feel after playing the released build; builder tests do not establish that acceptance.
