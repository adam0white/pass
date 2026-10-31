# The Pass: design

**One line.** You inherited your late aunt Nevin's neighbourhood lokanta, and with it three cooks who were loyal to her, not to you. The bank wants the arrears by Saturday close. Six dinner services. Every cook can say no.

**Done for the first playable** (set 2026-10-18 by the coordinator's brief; the owner accepts feel separately): six playable nights with one new pressure each, an ending, a playtest export that replays, tests, a headless balance measure, a late source-unread playtest recorded verbatim, live at https://pass.adamwhite.work.

## Current service contact and clearing — 2026-10-29

Current pass@19 pins HF4.12.0/client0.5.12/kit0.5.29. This batch builds on the existing public, costed check-in. Tomas asked to talk about what a cook actually said and to have ordinary crew contact during quiet service (`human-framework/docs/lab/reviews/rebuild-2026-10-23/pass-free.md:318,320`; `pass-continued.md:78,100`). Availability controls cannot establish whether it satisfies Tomas or Adam. Owner/player acceptance remains paused, review 2026-11-03.

The player may choose among supported statements actually heard from the selected cook. Inputs carry a source identity; execution checks the exact retained speaker and words. Existing ordinary and private topics remain, with additional actual dining-room and guest-explanation statements. A reply describes actual recorded work, never an invented guest response or private feeling. A missed-prayer follow-up remains discussion of that evening, not completion of a prayer.

A private invitation asks an existing active employee for three minutes away from work. HF chooses among the invitation and real work and need alternatives. A refusal discloses nothing. Accepted work removes the cook from production. Only the exact conversation activity's completed receipt discloses the existing private account. Interruption cannot disclose it through a later conversation. Once heard, the account persists beyond journal eviction and night changes and can be followed up; private discovery is not granted by selecting a biography. The original idle People invitation remains available. No new person or relationship meter is added.

An abandoned plated meal supplies a real clearing task. A cook may choose three minutes to dispose of that meal and return its plate. The plate stays committed to its original eighteen-minute automatic fallback until actual completion; then one plate enters the existing clean stack or dish pile and the matching fallback is removed. Interrupted clearing retains the original return. Clearing cannot produce a second plate, serve the departed table, earn its payment or change later seeded arrivals. The cook loses those cooking minutes. This is bounded existing-crew front-of-house work, not all waiter roles or taking orders.

Foreground tasks settle HF's actual interruption and next decision before the host withdraws their offers. The host keeps the same request available for that handover and records the final HF choice. It does not immediately reconsider a newly started foreground activity in the same game minute. The ordinary rota policy and no-input first-service results remain unchanged. Public coverage words format whole minutes without rounding the actual settlement clock or work duration. The current journal save refuses older engine saves; originals remain stored. Imported file play keeps an occupied native notebook unchanged and asks the player to export file progress before leaving.

### Remaining contracts and acceptance

| Literal item                                                                      | Current bounded work                                                                                                                         | Actual remaining owner and checkpoint                                                                                                                               |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GDI-003: Waiters and front-of-house as HF people.                                 | Existing cooks carry meals and may now clear actual abandoned plated meals.                                                                  | Broader waiter roles remain a Pass host design item; Adam accepts feel, 2026-11-03.                                                                                 |
| F-471: Talk to a cook about what they said; more crew interaction during service. | Selectable retained topics and completion-gated private invitations during actual service.                                                   | Tomas/eligible player and Adam supply judgment; no round in this batch, review 2026-11-03.                                                                          |
| F-472: Ordinary contact during quiet stretches without manufacturing trouble.     | The public check-in already exists; private invitation adds an HF choice with real time/work cost and no trouble gate.                       | Player/owner acceptance remains separate and paused, review 2026-11-03.                                                                                             |
| GDI-571: Voice answers a person's request.                                        | Released `voice.evidence-received` is available. Current request answers and activity receipts are not yet sourced request-outcome evidence. | All/HF4 contract director: expose authority-bound experienced outcome evidence; Pass host owner: stable request occurrence and outcome linkage. Recheck 2026-10-30. |
| GDI-008/009/570: Refusal bounds and shared coverage.                              | Existing work-interval attention and last-cook offer convention stay.                                                                        | All/HF4 contract director: evidence-driven attention and shared obligation/satisfier/reassignment. Recheck 2026-11-03; no arbitrary click cap or local cognition.   |

HF4.8.1's README defines request evidence with stable recipient-specific ID, `occurredAt`, `action`, `granted` and `felt`. `felt` means experienced valence; a grant need not feel good and a refusal need not feel bad. Pass records request kind/person/time and chef answer (including a distinct ignored path), but not a stable request occurrence or its link to later action settlement. Public action-settled events identify the activity and outcome evidence without experienced valence. Inferring it from body changes, trust or approval would fabricate evidence. No request evidence is emitted by this batch. This updates the historical missing-API assessments below; it does not claim the API is absent. No prayer or religious-worth behavior changes.

Technical done remains focused faculty controls, complete native/file host+HF+RNG replay and restoration, occupied native preservation, production-bundle pointer controls in both engines at all four owner sizes, one hosted Codex review, signed source, exact green CI, fresh clean deployment and live verification. Root owns canonical inventory/ledger closure. Adam accepts game readiness separately.


## Historical HF 4 port candidate — 2026-10-28

The `pass@19` edition uses the HF 4 Run and a retained v2 portable-person opening. Earlier HF 3 saves and incomplete shelf passports refuse before a new claim; the source file stays available. A complete none-policy game reached an ending and passed cold restore, host replay and framework replay on the 4.7 candidate, whose published framework payload was verified identical. Delivery checks and Adam's acceptance remain separate.

Pass selects HF's daily numerical fidelity consistently for new `pass@19` batches and receipts. It retains the same faculty equations and reached semantic boundaries, with a looser local numerical estimate than fine fidelity; it is not a global error guarantee. Each fidelity path replays its own results. Earlier editions retain their historical runtime.

A chef answering a request is not evidence of a kept or broken promise. Yes, no and no answer do not directly change advising-voice trust in `pass@19`; earlier editions adjust that trust for each outcome, with a larger cost for no answer than no. A yes that helps the cook records the actual help as a social event. HF 4.7's authored social response changes belief-source trust, which is separate from advising-voice trust, so it does not replace that adjustment. HF4.8.1 now supplies the request-evidence API; current host data/contract gaps and owners are recorded above.

## Historical HF 4.5.1 assessment — 2026-10-28

Remaining: HF G4 must provide a knowledge-bounded forecast of another person's answer before this game can move from HF 3.0.0. Recheck the published contract on **2026-11-17**. Adam accepts game readiness separately.

The target checked was the published HF 4.5.1 GitHub release (npm still returned 404 at the check; npm latest was 4.5.0). Client 0.5.2 is the matching released portable bridge; its own HF 4.4.0 dependency is intentional. Neither is adopted here. The game retains HF 3.0.0 / client 0.4.15 / kit 0.5.17.

`src/sim/kitchen.ts` `hints` uses `predictAs(chef, cook, offers, suggestion)` for hires. Its verdict, words and confidence describe the chef's guess. HF 4.5.1 `preview` with `perspective: {kind: 'person', observer: 'chef'}` and `person: 'cook'` returns `invalid-admission` at `$.perspective`: “Person preview requires the same observer”. `inspect` supplies observed signs and impressions, but no predicted answer. Host preview would use hidden actor state. A game-local prediction calculation would duplicate HF. Both violate the port recipe. This is a framework contract blocker, not a reason to remove the hints or change their knowledge boundary.

The recipe's old blanket G2/G3 blockers are not current: HF 4.5.1 publishes retained portable admission and `DEFAULT_NORMS`. The remaining port still needs a full bridge, finite legacy cast mappings, millisecond conversion, request settlement and exact whole-game export proof. A passing public HF control does not prove this game is ported. The control and live API refusal are retained with `~/code/.lab-scratch/codex/pass-murmur-evidence/run-control451.ts` and `run-control451.json`.

The last query switch guarded the development console handle. Development builds now expose it without a query parameter. Production diagnostics remain in the collapsed Debug item beside Lab privacy. Browser controls use the ordinary URL. The simulation and export pin remain unchanged.

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

| Week | Title        | Services   | New, brought by a person                                                                  | Bill               |
| ---- | ------------ | ---------- | ----------------------------------------------------------------------------------------- | ------------------ |
| 1    | The arrears  | Mon to Sat | Rafi and the plates, the tip jar, the match crowd, the critic and Dilek's call, the bank  | ₺5,200 to the bank |
| 2    | The street   | Wed to Sat | the pide oven (heat you keep up), regulars with names and tabs                            | ₺3,000             |
| 3    | The ledger   | Wed to Sat | the ledger on the pass, hiring and quitting on Sunday                                     | ₺4,200 plus wages  |
| 4    | Nevin's name | Wed to Sat | the anniversary (Nevin's apron), the night the gas fails, a wedding order with a due time | ₺6,200 plus wages  |
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

## Panel fix cycle: pass@17 (2026-10-27)

New games use pass@17. Existing notebooks retain their recorded edition and replay rules. A seeded Dilek phone request arrives about 18:30 on the first night. The request uses the existing yes/no consequences. Each completed order records its actual payment when earned. The weekly bills, customer patience and normal difficulty stay unchanged.

People offers keep their answer visible in the open sheet. Unavailable offers print their reason beside the disabled button. Each cook answers check-ins and follow-ups from their own notes. The closing page explains booked prices, tables retained and booked meals lost; it does not assign a hypothetical cost to every empty station minute. When no cook can cover, the game says so and stops slowing time for that gap until an option returns. Break edits preserve the selected cover. New board suggestions leave cover unassigned until the player chooses it.

Every gameplay feature from the earlier kitchen, narration and follow-up editions is part of the normal new game. Redundant edition switches are removed. Pace and alternate starts are public. Automatic cast carryover remains on. Cast management belongs to the central shelf. Export, replay verification, import and seed are the only diagnostics in the collapsed Debug item beside Lab privacy. No panel or playtest is part of this fix cycle.

## Deferred — current reconciliation, 2026-10-29

Original panel report and conditional return sentences remain [verbatim](playtests/panel-2026-10-27.md). It was a fictional agent panel on HF3; the driver could not hold a job button, Resume was not tested, and timing complaints were not reproduced at human speed. This source increment runs no round. Source/automated controls do not accept player feel.

| Literal panel clause                                                         | Current source disposition                                                                                                                                                                                                                                        | Remaining owner/checkpoint                                                |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| F1953 taken People offer shows no answer; F1954 greyed offers give no reason | Actual answer appears in People; unavailable offers explain actual guards.                                                                                                                                                                                        | Same-tester/Adam judgment, paused2026-11-03.                              |
| F1955 choices do not visibly change money; F1956 opening has nothing to do   | Actual earned-order receipts, lost-payment accounts, seeded opening request and delivered early booking pressure. Difficulty/arrivals unchanged here.                                                                                                             | Same-tester/Adam judgment2026-11-03.                                      |
| F1957 slowed clock waits without a move                                      | Existing no-cover availability returns chosen pace; reading still slows, only menus pause.                                                                                                                                                                        | Player pacing judgment2026-11-03.                                         |
| F1958 stock cook lines; F1959 break edit changes cover                       | Individual supported words/actual reason and preserved explicit cover choices.                                                                                                                                                                                    | Player/owner judgment2026-11-03.                                          |
| F1960 second-station/prayer warning                                          | Before asking: actual current station coverage and public authored Selim18:35–19:20 window. Plan edits show actual meal overlap. A request can cost coverage; no predicted answer or prayer outcome.                                                              | Source technical gates; player/Adam2026-11-03.                            |
| F1961 clipped text                                                           | Board header wraps; slowdown has its own row with bill retained; job guesses grow and crew controls remain reachable.                                                                                                                                             | Current engine/size source QA and ROOT live gates; player2026-11-03.      |
| F1962 distinct Change labels                                                 | Each visible label names the cook’s plan.                                                                                                                                                                                                                         | Technical gates; player2026-11-03.                                        |
| F1963 tap/keyboard insist                                                    | Distinct disclosure offers labelled buttons using the same existing insist action, cost and disabled guards as hold. HF still chooses.                                                                                                                            | Technical gates; player2026-11-10.                                        |
| F1964 shorter plan quotes                                                    | Compact station/cover outcomes; complete original cook answer in separately labelled disclosure. No clipped/refusal text is discarded.                                                                                                                            | Technical gates; player2026-11-03.                                        |
| F1965 explain rush/station/cold side                                         | Plain first-board context defines each with actual rush18:30–20:30. Names remain.                                                                                                                                                                                 | Technical gates; player2026-11-03.                                        |
| F1966 Feedback prefill                                                       | Already fills chosen stopping/confused words; edit/change/clear preserves authored text. Selection sends nothing. Original report describes behavior, not a demonstrated new defect.                                                                              | Separate real transport/recording receipt and player judgment2026-11-10.  |
| F1967 continue where stopped                                                 | Native save/Resume already exists; file play preserves occupied native. Verify current cold continuation; no claim the tester used it.                                                                                                                            | Player/Adam2026-11-10.                                                    |
| F1968 unexpected cook action                                                 | Actual costed private invitation, heard follow-up and dining-room/clearing work exist. After actually heard Selim notes, three-minute grill guidance with a separately requested learner records real food practice and station costs; it does not award mastery. | Tessa/Adam satisfaction2026-11-10; no invented broad feature/API blocker. |
| F1969 empty desktop right half                                               | Board uses full reading width; an editor opens only when requested.                                                                                                                                                                                               | Technical gates; player2026-11-10.                                        |

GDR0001 is compound; these bounded source dispositions do not close its same-tester retest or Adam readiness. GDI001/GDR0002/F283–284 old hands-on food acceptance is superseded by [the owner’s explicit removal](playtests/owner-2026-10-21.md). Do not restore chef preparation/call clicks. GDI002/GDR0003/F227 early-service mechanics are delivered; taste still requires eligible player judgment2026-11-03. The whole current GDI/GDR/GDL map, original quotes and exact source anchors live in `~/code/.lab-scratch/games-deferred/recovery-pass-remainder-literal-rowmap.json`; root owns inventory/ledger.

## Deferred — LIGHT retest asks, 2026-10-30 (F-2161–F-2176)

Source: the LIGHT same-tester retest on live b6e919a (fictional agent panel, HF4.12; synthetic observations, not human recruitment). Exact words are in the ask ledger in `~/code/.lab-scratch/playtest/light-1030/source-packets/pass/`. The candidate named below is uncommitted: no row is delivered, and no commit or deploy reference is recorded until signed source, exact CI and a clean deployment exist. Dates are the ledger's targets. Each date below says what must happen first. Owner judgment of player feel is separate from technical gates, and Adam accepts readiness.

The current C1 public `modified` learner verdict is **unobserved** as of 2026-10-30. The negative-credit rule for a modified learner is covered by one labelled historical-native unit test (a genuine R3 pass@20 / HF4.12 checkpoint), accepted by root. That is a test-coverage limit, not a found game bug. It does not show that the current seed and public inputs reach `modified`. Review 2026-11-03.

| Ask (exact words in ledger)                                                                            | Candidate status                                                                                                                                                                                                                                                                                                                                        | What remains, who owns it, date and reason                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F-2166 “a ‘who takes over’ answer should count once; the same question comes back with a new end time” | Source changes: an unanswered question that lapses is never marked covered; an answered “leave it empty” is not re-asked while that absence is open; a visible status line states the window and now keeps any other empty station’s own line and prompt; the five-minute review menu now keeps a cook’s own running activity, with its remaining time. | **Not closed.** The review-menu change is a behavior change that already shifts pacing (see the comparison below), so it is not “undecided”: it is in the candidate. Question counts are not closure. Amal’s phone claim that Dilek went back to cold was not reproduced. What counts as the same absence is a policy choice that is not decided here; no absence policy is invented. Failure of one variant (B2) does not show every alternative needs a difficulty change. Owner: Adam decides on 2026-11-03, with the pacing comparison and the control traces in `~/code/.lab-scratch/games-deferred/pass-light-fixes/evidence/` and `pass-followup1031/`. Reason for the date: the owner readiness review already sits on that day. Live status-line check at 360x690 and the owner sizes: root gate. |
| F-2167 absence or refusal shown in the main view; “toilet first” should happen                         | Source change: a bathroom or prayer span is no longer cut by the host review, so a visit completes and the need falls. The main view says “in the bathroom”. Needs and each cook’s own refusal logic are unchanged. The change does alter cook behavior: visits that used to end early now finish.                                                      | Pacing effect is measured only for the cases in the comparison below. Live check that status, reply and activity agree: root gate (browser at owner sizes, not yet run). Player judgment: same-tester retest after deployment of an exact clean manifest, with Adam’s 2026-11-03 readiness review.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| F-2168 starting plan leaves the grill empty without saying so                                          | Source change: before opening, the board names the cook, the break window and the station. The default plan is unchanged and nothing is covered for the player.                                                                                                                                                                                         | Layout check at 360x690 and 1280x800: root technical gate. Player judgment as above.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| F-2169 same need clause repeated                                                                       | Source change: authored need reasons give the cause, not the same clause again. The need and each cook’s own reply remain.                                                                                                                                                                                                                              | Player judgment after deployment, same retest.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| F-2170 something to do during slowed waits                                                             | No source change.                                                                                                                                                                                                                                                                                                                                       | Owner input needed: whether a wait-time activity is wanted at all. Existing behavior: with no cover available, time returns to the chosen pace; reading still slows time. Guardrails: the owner removed hands-on chef food clicks (`playtests/owner-2026-10-21.md`), so do not restore them; no click cap; no timing defect at human speed was established (the driver could not act at human speed). Adam decides 2026-11-03; same-tester retest 2026-11-10, which needs the fixes deployed first.                                                                                                                                                                                                                                                                                                        |
| F-2171 “Show early whether ₺5,200 is reachable”                                                        | No source change. A progress bar with a mark for tonight’s share and a pace line already exist.                                                                                                                                                                                                                                                         | Owner input needed: reachable cannot be stated without forecasting the player’s success, which would be a new rule. Unknown: what Adam wants shown before night one. Adam decides 2026-11-03; retest 2026-11-10.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| F-2172 how to follow Selim’s later Nevin invitation                                                    | Source change: the disabled private-invite button now states its reason (kitchen open, something to say, not already told, cook free).                                                                                                                                                                                                                  | Unknown whether the note is enough: same-tester retest 2026-11-10. Note layout check: root gate.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| F-2173 carry on from where I stopped                                                                   | No change. Native Resume exists. Not tested by the panel; no save defect established.                                                                                                                                                                                                                                                                   | Reload and Resume check in a real browser: root gate before deploy sign-off, then recorded here.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| F-2174 shorter planning quotes                                                                         | No change this round. Compact outcomes with the complete answer in a disclosure were delivered earlier (F1964).                                                                                                                                                                                                                                         | **Active engineering, not date-only:** root live check at 360x690 and 1280x800 of whether the “I agree to that…” line still repeats the line above it. If it does, a bounded text change follows in the next combined correction. Retest 2026-11-10.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| F-2175 desktop order cards clipped                                                                     | Source change: one ingredient per line from 768 px up. Not verified visually.                                                                                                                                                                                                                                                                           | Browser check at the four owner sizes: root gate.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| F-2176 Insist tap shows nothing                                                                        | No change. A tap-and-keyboard “Insist on a job” disclosure exists; hold was not operable in the driver. No input defect established.                                                                                                                                                                                                                    | **Active check:** root live check with a real mouse at 1280x800 that the ordinary tap opens the disclosure and an insist produces the visible reply. Retest 2026-11-10.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

**Pacing comparison (confirmed vs unknown).** This change set is not difficulty-neutral. One bounded run compared live b6e919a (pass@19) with this follow-up branch (pass@20): seeds 7, 42 and 99, Monday only, default board, the doors opened, and every “who takes over” question answered “leave it empty”. Raw output: `~/code/.lab-scratch/games-deferred/pass-followup1031/pace2-base.out` and `pace2-cur.out`.

| seed | served / walked out, b6e919a → now | till, b6e919a → now | minutes a needed station is empty | staffing questions |
| ---- | ---------------------------------- | ------------------- | --------------------------------- | ------------------ |
| 7    | 5 / 10 → 12 / 3                    | ₺200 → ₺480         | 130 → 96                          | 22 → 10            |
| 42   | 6 / 9 → 14 / 1                     | ₺240 → ₺560         | 118 → 35                          | 18 → 9             |
| 99   | 6 / 9 → 12 / 3                     | ₺240 → ₺480         | 154 → 70                          | 23 → 9             |

Confirmed: under that one answering policy, on those three seeds, Monday was easier (more served, fewer walkouts, more till, fewer empty minutes, fewer questions). Not established: how much comes from the running-review change versus the bathroom/prayer change (they were not separated), any other answering policy, any later night, a full week, or human play. This is a changed-pacing candidate and Adam decides on 2026-11-03 whether it stands, as already planned. The comparison does not show that the game is too easy.

Remaining gates before any of this is called delivered: same-reviewer body check of the signed source, separate exact-SHA Opus CLEAR, exact CI, a normal fresh deployment, and Chromium/WebKit checks at 360x690 and 820x1180 plus the other owner sizes. Friends’ playtests and Show HN stay paused.

## Earlier deferred work — original wording (current dispositions below)

- Waiters and front-of-house as HF people.
- Workers AI voice for the evening (not needed; HF lines carry it).
- A cook quitting mid-service, not only on Sunday.
- Bad guests: a table that pushes a cook, and a cook who answers back.
- A supplier failing on the wedding night.
- A limit on how many rush asks a cook will refuse before he stops answering (now unbounded).
- A crew-level duty in HF instead of the host's crew rule (HF request 6).
- A hire's own voice in service: hires speak HF's stock answers until the Sunday page (rule-breaker playtest).
- Talking to a cook outside the scripted moments ("Rafi has been quiet all afternoon"; cozy playtest).

Current mechanisms: existing HF crew room/plate/clearing work, costed ordinary/private conversations and durable heard-source follow-up; HF-selected costed resignation, guest assent/refusal and explanation, finite wedding supply failure/replacement, hire-specific actual words, and published prompting/chronicle/evening narration. These are current public kitchen mechanisms, not new opt-ins. Worker model voice was deliberately not needed. Broader satisfaction/roles without a further literal task are Adam’s judgment2026-11-03, not an invented API absence. Shared obligation/satisfier/reassignment and evidence-driven attention remain All/HF4 contract dependencies2026-11-03; last-cook convention stays. Released voice evidence exists but public experienced-felt/outcome attribution remains All/HF4 plus Pass linkage/adoption, check2026-10-30. No fake evidence or private read; unpublished4.10 does not resolve a released-graph gap.

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

| Policy                                         | pass@8                           | pass@9                                                             |
| ---------------------------------------------- | -------------------------------- | ------------------------------------------------------------------ |
| flex (never cooks)                             | 10/10 won, mean till left ₺2,522 | 10/10 won, ₺1,303 left                                             |
| flex-chef, promise none                        | -                                | 10/10 won, ₺1,698 left                                             |
| flex-chef, promise the first party each Sunday | -                                | 8/10 won; 23 of 30 promises kept; a strike on 5 seeds; ₺2,531 left |
| flex-chef, promise every party                 | -                                | 3/10 won; 39 of 58 kept; ₺3,028 left                               |
| ask / care (never cook, ask for stations)      | 1/10, 1/10 won                   | 0/10, 0/10 won                                                     |
| ask / care under Nevin's pace                  | -                                | 2/10, 2/10 won                                                     |

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

The service clock offers Slow, Steady and Fast. Reading, cook inspection, cooking choices and pending replies keep their existing time protection at every selected speed. Speed is a page-session preference; saves and replay inputs are unchanged.

## Opt-in remaining kitchen candidate — 2026-10-26

Default New game remains `pass@13`. “Try the kitchen edition” explicitly starts
`pass@14`, a separate local notebook. It does not publish a new producer through
the old `pass-13` passport. Root's independent review, clearance and release gates
remain outstanding. Adam accepts readiness and player feel separately.

The seven allocated canonical people remain the whole cast. An employed, present
cook may accept fifteen minutes in the dining room through an HF decision. That
person leaves food production; the rota gap remains real. No new waiter identity,
generated foreground customer or simultaneous second chapter is created. Absent
Rafi, departed employees and people on their own breaks do not join a conversation.
The same actual HF people hear incidental tables at the kitchen door. A guest
asks for an explanation or demands washed plates ahead of other orders. HF can
assent, modify or refuse. Accepted explanations cost three minutes. The existing
plates rule can refuse a guest. Orders, patience, portions and walkouts keep their
world rules; a guest's request grants neither food nor priority by itself.

After repeated actual refusals, HF can weigh putting down work and replies for
twelve minutes or ending employment and taking thirty minutes to travel home,
alongside the existing work and rest choices. The recorded refusals make those
acts available; they do not select an outcome. Both acts cost service coverage.
Resignation retains the night's earned pay and outstanding duties. It grants no
new job, release of family promises or retroactive excuse for the shift.

Ordinary “How are you doing?” offers a three-minute HF conversation. An accepted
conversation takes the cook off production while other people and tickets keep
advancing. A refusal leaves the request declined. The latest heard answer appears
before the longer journal. Hires keep the actual HF verdict and reason, with
individual words grounded in their existing work histories. No generated model
voice or local cognition framework is involved. Reading slows service; Game menu
pause remains separate.

The authored `2026-10-26/wedding-night` supply event belongs only to pass@14's
fourth-week Saturday. The opening notice says eight lamb portions are expected at
six and are not yet on hand. At six the supplier reports a broken van and no
arrival that evening. Missing stock is never added or charged. A replacement
order costs ₺240 and arrives 45 minutes after the actual order. Portions consume
finite ingredients. Tickets retain their original seed, arrivals, orders and
wedding deadline. There is no reseeding or automatic easier service.

### Deferred dispositions at candidate freeze

| Item          | Current source disposition                                                                                                                                                                                                                 | Remaining action / date                                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| GDI-003       | Actual canonical HF room workers; each assignment competes with current work.                                                                                                                                                              | Root review and release; candidate target 2026-10-26.                                                                      |
| GDI-005       | HF-selected mid-service resignation begins a costed home journey and ends employment.                                                                                                                                                      | Root review and release; candidate target 2026-10-26.                                                                      |
| GDI-006       | Heard guest suggestions, actual assent/refusal and physical work outcomes.                                                                                                                                                                 | Root review and release; candidate target 2026-10-26.                                                                      |
| GDI-007       | Dated wedding failure, honest notice, finite ingredients and paid replacement travel.                                                                                                                                                      | Root review and release; candidate target 2026-10-26.                                                                      |
| GDI-008       | HF-selected twelve-minute work/reply boundary; no click-count outcome.                                                                                                                                                                     | Root review and release; candidate target 2026-10-26.                                                                      |
| GDI-010       | Hire-specific spoken context beside the actual HF response.                                                                                                                                                                                | Root review and release; candidate target 2026-10-26.                                                                      |
| GDI-011       | Ordinary costed conversation, actual availability, no service pause.                                                                                                                                                                       | Root review and release; candidate target 2026-10-26.                                                                      |
| GDI-004       | Deliberate prior product decision: “Workers AI voice for the evening (not needed; HF lines carry it).” The source is the earlier deferred list above.                                                                                      | No feature remains from that literal request. No new exclusion or inference call. Revisit only on a new product direction. |
| GDI-009 / 570 | Installed HF3.0.0 has group membership/care, not a transferable crew coverage obligation. Existing last-cook availability convention remains. No local generic substitute.                                                                 | All owns the demonstrated public-contract gap, target 2026-10-29.                                                          |
| GDI-571       | `noteVoicePromise` concerns promises made by a voice; `gestureVoiceTrust` explicitly leaves magnitude to the host. Neither establishes request-answer effect/evidence/repetition semantics. Existing request convention remains unchanged. | All owns the sourced contract/evidence, target 2026-10-30.                                                                 |
| HF request 8  | pass@14 follows actual `review:resolve` `Term.ref` to `Resolve.key`. Missing/ambiguous refs produce no invented resolve line.                                                                                                              | Historical editions intentionally retain their old narration for exact raw continuation.                                   |
| GDI-001 / 002 | Historical source-unread cooking-feel acceptance and first-service retest need actual eligible player input. Builder controls establish neither.                                                                                           | Adam / eligible player review 2026-11-03; this task runs no round. Friends and Show HN stay paused.                        |

The old “after the owner plays pass@3” heading records history. It is not an
engineering gate. The SDK11/kit12 quiet Feedback artifacts, recording switch,
privacy and note-versus-run behavior remain the delivered source contract.

## Opt-in narration candidate — 2026-10-26

“Try the narration edition” explicitly starts pass@16, a separate local notebook
that inherits the follow-up kitchen. Default New game remains pass@13. Saved
13/14/15 notebooks keep their exact rules and prose; none upgrades silently.

The published HF3 prompting narrator supplies plain third-person captions. The
authored kitchen lexicon supplies verb forms to HF chronicle narration. Evening
reports use HF's varied review lines. An ordered cause requires actual assented
or complied work that elapsed across the matching commitment's deadline, or
actually completed work that violated the matching abstention. A matching
commitment activity actually ended early can support an interrupted cause.
Pending requests, refusals and unrelated commitments do not establish a cause.
These observations alter no raw review, resolve, norm or religious assessment.
Missed sunset prayer stays a quiet observation. Other lapses retain ordinary
noncausal wording when the host lacks matching evidence.

GDI-568, GDI-569 and GDI-642 are candidate source only. Parent independent review,
signed delivery, exact green CI and live release checks remain. Adam accepts
game readiness. No player round was run.

## Deferred — second retest asks, 2026-10-31 (F-2496–F-2510)

Source: the second Pass retest, a fictional agent panel on commit `288b2fda7c8589931a9d9e8f044f1a8aaf630333`, app 0.1.0, Human Framework 4.12.0, round `light-1031-pass-retest2`. The panel was the same four standing testers (Maya, Emre, Nia, Rosa) and one new cold tester (Sonia), each in fresh independent contexts on a phone and a desktop, one tester at a time, with a free stop. Collection ended 2026-10-31T07:36:57.910821Z. These are synthetic observations, not human recruitment, and the run lengths (73.602–455 seconds) are model and tool time, not human reading speed.

**What remains.** Every row below is open. Each date names the day a decision or a check is due, not a delivery. Nothing here changes the game. Adam decides readiness and policy. The games-deferred Pass host owner owns source inspection and fixes within the existing authorization; no blanket owner-decision prerequisite is added.

**Loop state.** This is the second game-fix and retest iteration. By the owner’s two-iteration rule, the player loop ends once this Deferred record is integrated. That ends the loop; it does not say any ask is fixed, and it is not player or owner acceptance. This record claims no clearance, no CI result, no deployment and no canonical HF import. No third panel and no automatic fix or easier game is proposed.

**Source record.** Producer words are unchanged in a private sealed packet at `~/code/.lab-scratch/playtest/light-1030/source-packets/pass-retest2/`. Its future path in the human-framework repository, `docs/lab/reviews/light-2026-10-30/pass-retest2/`, is prospective: nothing has been imported, so no public link is given. Report SHA-256 hashes (`report.original.md.txt`): Maya `eccfb8e9d3ef25acc0e391910d71bbbbdcae9f3854b21c2533aa2546bf64dd5c`, Emre `d0bfccb7a52da2bac5ebf03263b8bab87d8483a487d3d5c75090073b88660b39`, Nia `c2f21abf75e5076c9ef974c121d806fdc89935aba23d7bf44c1d954dc135639d`, Rosa `c7c47c055a88894651ea7bd7cfc1114a2262ad30dd596cfb67e56a4857c3a9a0`, Sonia `8a15f348d51431fed8e762b55f8cf87e9f8395ba28e8285221aa59b276c7fbd3`. The full inventory is `sha256.json` in the packet.

**How to read the rows.** Ranked asks are F-2496 to F-2510, five testers with three asks each. The quotation after each id is the tester’s own text. It gives the ranked ask first, then each later wording from the same report that differs, labelled by report section. Later spans are kept so a changed condition is not lost; the sealed packet holds the full reports. Rows F-2491 to F-2495 are the five return answers, not additional asks. F-2511 to F-2520 are unused. Each report’s verdict is `mixed`: the tester’s own conditions, not a vote and not a population estimate.

**Planned directions (decisions due, not decided).** On 2026-11-03: explain meaning, status, preview, duplicate wording, warnings and the bank target (F-2496, F-2498, F-2501, F-2503, F-2505 to F-2510). On 2026-11-10: broader story, a recovery preference, whether a saved-run Resume exists and works (it was untried), and pacing after the C14 human-speed comparison (F-2497, F-2499, F-2500, F-2502, F-2504). Packet dates are kept as written.

**Limits that stay.** No automatic cook obedience, undo, free cover, hard pause, clock or difficulty retune, new story or religious policy follows from these asks. Specific qualifications from the packet:

- Maya saw a warning in one session and wrote later that none appeared. Both statements stay; there is no universal absence claim.
- Nia insisted on purpose, with the trust warning visible, and found it amusing. A recovery request is not an automatic undo.
- Emre knowingly retained a cover that had refused, to see its cost.
- Monday money totals do not prove the ₺5,200 target impossible. Explaining the target early is clarity, not a financial guarantee.
- A cook eating earlier than a planned break could be a different meal. It does not show the schedule was ignored.
- Prefix time, stale controls and live-clock drift during model latency do not show a timing defect. Clock, skip and speed are retuned only after calibration C14.
- Recorded history reads were partial for Emre (598 of 907 lines), Nia (599 of 963) and Rosa (399 of 1583), so their statements about earlier material may concern text they did not read. Maya and Sonia read their supplied history in full.
- The Native v2 hold took 1.8 seconds. No fix is credited for the difference from the earlier instrument.
- All five reports are conditional. There are no votes and no acceptance.
- The technical proof for fonts, native files, geometry and the current SDK stays separate, partial or UNRUN. Existing GDI items and older source and candidate history above stay historical. This record closes none of them.

### F-2496 — Maya Chen

- Player words, exact (opening ask, then labelled later spans): "Warn me before I tap a talk or a follow-up that the cook will leave the grill or cold side, and for how long. Do the same for a table complaint at the kitchen door, which pulled Dilek and Selim away on their own." Later wording (section 8): "Tell me before I tap that a talk, a follow-up or a table complaint will take a cook off a station, and for how long." Later wording (section 9): "I still got no warning about the Nevin follow-up, or about a table complaint pulling a cook away."
- Disposition and conditions: Add a warning before a talk, follow-up or table complaint at the kitchen door takes a cook off a station, with the length. The tester saw the opening-page and private-talk warnings and, in the same visit, wrote that nothing warned her about the Nevin follow-up. Both statements stay. The source must be inspected first for the table-complaint pull. No claim is made that a warning is absent everywhere.
- Owner and date: the games-deferred Pass host owner; sealed route `target2026-11-03 (open)`, so Nov 3. Verdict word: mixed (the tester’s own stated conditions, not a vote).
- Source: `docs/lab/reviews/light-2026-10-30/pass-retest2/maya/report.md` in the sealed packet.

### F-2497 — Maya Chen

- Player words, exact (opening ask, then labelled later spans): "Make "ask me about Nevin" lead to a longer reply. Selim's line was one short sentence, and the follow-up pulled him off the grill." Later wording (section 8): "Make "ask me about Nevin" lead to more than one short line. The follow-up should not cost me the grill." Later wording (section 9): "It gave one short line after a long wait. On the phone it never appeared, because the choice was disabled or offered only the wait line."
- Disposition and conditions: Longer reply to “ask me about Nevin”: a broader-story preference. On desktop it came after a long wait; on the phone it did not appear. No automatic change. Difficulty, quiet faith, agency and refusal stay as they are.
- Owner and date: the games-deferred Pass host owner; sealed route `target2026-11-10 (open)`, so Nov 10. Verdict word: mixed (the tester’s own stated conditions, not a vote).
- Source: `docs/lab/reviews/light-2026-10-30/pass-retest2/maya/report.md` in the sealed packet.

### F-2498 — Maya Chen

- Player words, exact (opening ask, then labelled later spans): "Fix the doubled bathroom wording in Selim's "How are you doing?" reply." Later wording (section 8): "Fix the doubled bathroom wording in Selim's reply." Later wording (section 9): "wording not met. Selim's bathroom line still repeats."
- Disposition and conditions: Selim’s “How are you doing?” reply says the bathroom line twice, seen on both devices. Reproduce in source first.
- Owner and date: the games-deferred Pass host owner; sealed route `target2026-11-03 (open)`, so Nov 3. Verdict word: mixed (the tester’s own stated conditions, not a vote).
- Source: `docs/lab/reviews/light-2026-10-30/pass-retest2/maya/report.md` in the sealed packet.

### F-2499 — Emre Kaya

- Player words, exact (opening ask, then labelled later spans): "Don't leave me watching when a station is empty. "Time is slowed. A station needs a cook" came up on both devices. I still found nobody on desktop Tuesday 18:42 whose predicted reply was anything but "bathroom", and Fast barely sped it up." Later wording (section 8): "Give me something to do when a station is empty. Let me ask someone useful, or skip the slowed stretch." Later wording (section 9): "But Tuesday 18:42 on desktop and Monday 18:15 on phone were still dead waits, and Fast did not shorten the slowed stretch."
- Disposition and conditions: Something to do, or a skip, while a station is empty and time is slowed. Fast was not tested in a normal stretch. Clock, skip and speed change only after the C14 human-speed comparison. Emre chose Dilek’s meal break and the refused cover on purpose to see their cost; there is no free cover.
- Owner and date: the games-deferred Pass host owner; sealed route `target2026-11-10 (open)`, so Nov 10 (calibration C14). Verdict word: mixed (the tester’s own stated conditions, not a vote).
- Source: `docs/lab/reviews/light-2026-10-30/pass-retest2/emre/report.md` in the sealed packet.

### F-2500 — Emre Kaya

- Player words, exact (opening ask, then labelled later spans): "Let me carry on from where I stopped, so I don't replay Monday. This is a repeat ask. I did not see whether that exists, because I never opened Resume." Later wording (section 8): "Resume from where I stopped. I did not check whether Resume exists." Later wording (section 9): "not seen. I never opened Resume."
- Disposition and conditions: Carry on from where he stopped. This is a repeat ask. He never opened Resume, and the in-game menu Resume is an unpause, so this is not evidence that a saved-run Resume is absent. Check what exists before any change (the saved-run Resume was untried).
- Owner and date: the games-deferred Pass host owner; sealed route `target2026-11-10 (open)`, so Nov 10. Verdict word: mixed (the tester’s own stated conditions, not a vote).
- Source: `docs/lab/reviews/light-2026-10-30/pass-retest2/emre/report.md` in the sealed packet.

### F-2501 — Emre Kaya

- Player words, exact (opening ask, then labelled later spans): "Show how table counts grow. The "I need about ₺920 a night" line is a real answer to my earlier ask. Monday was ₺600 again (15 of 15 tables), and I still can't see how to earn more than that." Later wording (section 8): "Show how the 15-table count grows through the week, next to the ₺920 a night target." Later wording (section 9): "Table growth is still not explained. Monday was 15 of 15 tables and ₺600 again."
- Disposition and conditions: Show how the table count grows next to the ₺920-a-night target. An early explanation of the bank target is clarity, not a financial guarantee. Monday’s ₺600 does not prove the target impossible. No bank deadline was reached; Emre reached Tuesday 18:42 and the other testers stopped on Monday.
- Owner and date: the games-deferred Pass host owner; sealed route `target2026-11-03 (open)`, so Nov 3. Verdict word: mixed (the tester’s own stated conditions, not a vote).
- Source: `docs/lab/reviews/light-2026-10-30/pass-retest2/emre/report.md` in the sealed packet.

### F-2502 — Nia Okafor

- Player words, exact (opening ask, then labelled later spans): "Let me recover when I insist and it goes badly. On desktop, one click on "Insist: Dilek, go home" sent her home until 22:00. I got ₺0 and no tables served, and I could not fix it." Later wording (section 8): "Let me recover when I insist and it goes badly. A "go home" click should not remove a cook for the whole night with nothing to do about it." Later wording (section 9): "On desktop the effect was big enough to wreck my night."
- Disposition and conditions: Let the player recover after an Insist “go home” goes badly. Nia insisted on purpose despite the visible trust warning and agreed it was for fun. This is not an automatic undo and not mandatory compliance. The 215-minute claim was not observed for 215 game minutes and its source is unverified. Difficulty, refusal and agency stay.
- Owner and date: the games-deferred Pass host owner; sealed route `target2026-11-10 (open)`, so Nov 10. Verdict word: mixed (the tester’s own stated conditions, not a vote).
- Source: `docs/lab/reviews/light-2026-10-30/pass-retest2/nia/report.md` in the sealed packet.

### F-2503 — Nia Okafor

- Player words, exact (opening ask, then labelled later spans): "Answer what I actually asked. "How are you doing?" got a toilet or prayer line on the phone. It got a real reply about Nevin on desktop." Later wording (section 8): "Answer what I actually asked. "How are you doing?" should get a reply about the person, not the toilet or prayer line plus a refusal." Later wording (section 9): ""How are you doing?" got a canned refusal on the phone and a real reply on desktop."
- Disposition and conditions: “How are you doing?” got a toilet or prayer line with a refusal on the phone and a real Nevin reply on desktop. Meaning, status and preview wording. Inspect the source for reply selection first. No rule that a cook must always obey.
- Owner and date: the games-deferred Pass host owner; sealed route `target2026-11-03 (open)`, so Nov 3. Verdict word: mixed (the tester’s own stated conditions, not a vote).
- Source: `docs/lab/reviews/light-2026-10-30/pass-retest2/nia/report.md` in the sealed packet.

### F-2504 — Nia Okafor

- Player words, exact (opening ask, then labelled later spans): "Cut the waiting stretches, or give me something to do in them." Later wording (section 8): "Shorten the stretches where I can only watch, or give me something to do in them." Later wording (section 9): "I still waited 12–28 s several times while tables left."
- Disposition and conditions: Shorter watching stretches, or something to do in them. Waits of 12 to 28 seconds are model and tool time, not proof of a defect at human speed. Clock, skip and speed change only after the C14 comparison. Difficulty, quiet faith, agency and refusal stay.
- Owner and date: the games-deferred Pass host owner; sealed route `target2026-11-10 (open)`, so Nov 10 (calibration C14). Verdict word: mixed (the tester’s own stated conditions, not a vote).
- Source: `docs/lab/reviews/light-2026-10-30/pass-retest2/nia/report.md` in the sealed packet.

### F-2505 — Rosa Alvarez

- Player words, exact (opening ask, then labelled later spans): "Rewrite the cook sentences I could not follow. This covers "I will explain the wait. I am leaving the other tables for three minutes…", the "Insist / Hold it to insist" help line, and the status "in the bathroom" beside that sentence." Later wording (section 8): "Rewrite the sentences that confused me. "I will explain the wait. I am leaving the other tables for three minutes." should say who he talks to. Make the status ("in the bathroom") match the quote. Replace "Insist" and "Hold it to insist" with plain words." Later wording (section 9): "the "Insist / Hold it to insist" help line and Selim's "I will explain the wait" quote. Each cost me a reread, and together they ended both sessions."
- Disposition and conditions: Rewrite the sentences Rosa could not follow, make the status match the quote, and replace “Insist” and “Hold it to insist”. She reread twice by her own table. Meaning, status and duplicate wording. Source cause unverified. No rule that a cook must always obey.
- Owner and date: the games-deferred Pass host owner; sealed route `target2026-11-03 (open)`, so Nov 3. Verdict word: mixed (the tester’s own stated conditions, not a vote).
- Source: `docs/lab/reviews/light-2026-10-30/pass-retest2/rosa/report.md` in the sealed packet.

### F-2506 — Rosa Alvarez

- Player words, exact (opening ask, then labelled later spans): "Show early whether ₺5,200 is reachable (still not seen)." Later wording (section 8): "Show early whether ₺5,200 is reachable. A line such as "You have ₺360. You need ₺5,200 by Saturday." would do." Later wording (section 9): "I saw only "₺160 … ₺5,200 due Saturday" and a bar. I saw no forecast."
- Disposition and conditions: Show early whether ₺5,200 is reachable. Rosa saw no forecast. An early bank-target explanation is clarity, not a financial guarantee. Monday totals do not prove the target impossible. No bank deadline was reached.
- Owner and date: the games-deferred Pass host owner; sealed route `target2026-11-03 (open)`, so Nov 3. Verdict word: mixed (the tester’s own stated conditions, not a vote).
- Source: `docs/lab/reviews/light-2026-10-30/pass-retest2/rosa/report.md` in the sealed packet.

### F-2507 — Rosa Alvarez

- Player words, exact (opening ask, then labelled later spans): "Warn about Dilek's meal break in the rush as well as Selim's. After that, make the "Nobody will work at the grill while Selim eats" line match the break I chose." Later wording (section 8): "Warn about Dilek's meal break in the rush as well as Selim's. Also make the plan dialog line "Nobody will work at the grill while Selim eats" match the break I chose." Later wording (section 9): "Also, Selim ate at 19:48 when I had moved his break to 21:00, and I could not tell why."
- Disposition and conditions: Warn about Dilek’s meal break in the rush, and make the plan-dialog line match the chosen break. Selim eating at 19:48 after a 21:00 plan may be a different meal; it is not proven that the schedule was ignored. Warning and status wording.
- Owner and date: the games-deferred Pass host owner; sealed route `target2026-11-03 (open)`, so Nov 3. Verdict word: mixed (the tester’s own stated conditions, not a vote).
- Source: `docs/lab/reviews/light-2026-10-30/pass-retest2/rosa/report.md` in the sealed packet.

### F-2508 — Sonia Ionescu

- Player words, exact (opening ask, then labelled later spans): "When a cook agrees, the cook should do it. If they will do something else, tell me before it happens. Examples: Selim said "I will do that now", then went to eat. Dilek's 18:35 break plan was followed by her eating at 20:24." Later wording (section 5): ""I will do that now" under a job button does not mean he will. The page does say these are "the chef’s guess", but then why show it?"
- Disposition and conditions: Sonia saw cooks agree to a plan and then be shown eating at another time. Preview versus action wording. Source cause unverified. An earlier meal than planned could be a different meal; it is not proven that the schedule was ignored. No rule that a cook must always obey. Refusal and agency stay.
- Owner and date: the games-deferred Pass host owner; sealed route `target2026-11-03 (open)`, so Nov 3. Verdict word: mixed (the tester’s own stated conditions, not a vote).
- Source: `docs/lab/reviews/light-2026-10-30/pass-retest2/sonia/report.md` in the sealed packet.

### F-2509 — Sonia Ionescu

- Player words, exact (opening ask, then labelled later spans): "The label should match the words. Dilek asks to phone her mother and the label says "bathroom". Selim is labelled "in the bathroom" but drawn at the back door while explaining the wait to tables. He was due to pray, and later the same hour it says toilet." Later wording (section 5): "Dilek said "I’m not at my agreed station" while marked outside."
- Disposition and conditions: Labels and words disagree: a bathroom label while Dilek asks to phone her mother, and Selim labelled “in the bathroom” but drawn at the back door. Status and preview wording. Source cause unverified. No rule that a cook must always obey.
- Owner and date: the games-deferred Pass host owner; sealed route `target2026-11-03 (open)`, so Nov 3. Verdict word: mixed (the tester’s own stated conditions, not a vote).
- Source: `docs/lab/reviews/light-2026-10-30/pass-retest2/sonia/report.md` in the sealed packet.

### F-2510 — Sonia Ionescu

- Player words, exact (opening ask, then labelled later spans): "Show me early how the week's money could work. ₺40 a table against ₺5,200 by Saturday. And say what flatbreads are, if there are always 0." Later wording (section 5): "Flatbreads are always 0 and never explained."
- Disposition and conditions: Early help to see how the week’s money could work, and what flatbreads are when they are always 0. An early bank-target explanation is clarity, not a financial guarantee. Monday’s ₺520 and ₺560 do not prove the target impossible. No bank deadline was reached.
- Owner and date: the games-deferred Pass host owner; sealed route `target2026-11-03 (open)`, so Nov 3. Verdict word: mixed (the tester’s own stated conditions, not a vote).
- Source: `docs/lab/reviews/light-2026-10-30/pass-retest2/sonia/report.md` in the sealed packet.
