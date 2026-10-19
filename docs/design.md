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

## The people (HF 2.7.0, pinned exactly)
- **Selim**, grill, 56. Worked for Nevin twenty years. Honest, proud, prays maghrib (a quiet offer at sunset; a journal line, no station effect).
- **Dilek**, cold, 34. Smokes; her own rule is no smoke in the rush (an HF abstention); a habit pulls the other way. Reviews by ruminating.
- **Rafi**, dish, 19. Broke. A habit toward the tip jar against his held norm on theft: an HF prompting. If the chef talks to him he gets a practised response (redirect) that grows with use; moving the jar removes the offer instead.
- Everyone holds "I don't walk out on a service" (an abstention to the chef); breaking it forms a resolve in the evening review.

## Concepts not chosen
- **B. Half Time**, coaching an under-14 team through a season. Rejected: slow sim between matches, spatial football on a phone.
- **C. Last Ferry**, the last crossings before a storm. Rejected: a one-night puzzle; too close to The Night Watch.

## Deferred (target: after the owner's first playtest)
- A seventh night onward (a second week) and hiring.
- Waiters and front-of-house as HF people.
- Workers AI voice for the evening (not needed; HF lines carry it).
