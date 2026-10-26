# The Pass

Run Nevin’s neighbourhood restaurant kitchen in Turkey for four weeks. Every cook can say no. [Play The Pass](https://pass.adamwhite.work).

## How to play

1. On **Tonight’s plan**, choose each cook’s station and 20-minute meal break. A relief cook leaves their own station empty while covering a break. Ask about changed plans before opening. Each cook can agree or refuse.
2. During service, tap a cook, then tap a job. Hold the job button to insist. The words below a job are your guess at the cook’s answer. A refusal can stand; insisting can cost trust.
3. Watch the tickets and ready dishes. The pass is the counter where finished food waits to be served. A dot marks a dish ready to serve. The crew cooks and sends dishes automatically. Answer requests and choose who covers an empty station. Time slows while someone needs an answer. Nevin’s pace, selectable through lab tools, lets tables wait longer before leaving.
4. Read the crew’s evening accounts. Saturday’s bill is paid from the till. Sunday choices affect the next week, including staffing and promises.

The campaign has 18 services: Monday–Saturday in week one, then Wednesday–Saturday in weeks two through four. Each week adds pressures and a bill. The [design history](docs/design.md) preserves the original six-service first playable.

## What the Human Framework does

HF supplies the people: their decisions and predictions, perceptions, needs, trust and other social state. Their persisted experience affects later answers. The game owns the physical kitchen, stations, dishes, tickets, money, calendar and consequences of kitchen work. It also owns the situations and wording that connect those systems. People conversations, work offers and releases are gameplay.

## Saves, Feedback and recording

The game saves your notebook on this device. It replays the seed and your inputs with pinned chapter data. Resume continues it; New game asks before replacing it. The menu also offers Feedback, Full screen, All games and Recording. Opening the menu pauses play.

Ordinary Feedback includes **Keep a copy of this run**, which works with recording off. It also offers a note, an optional name and an optional verdict. The shipped verdicts are “I’d keep playing”, “Not sure” and “I’d stop here”. The current source also offers “I'm stopping” and “I'm confused”. Choosing one puts
those words in the note and sends nothing. Changing or clearing the choice removes only
its unchanged generated prefix; your edited text stays. **Submit** sends the current
note with any optional verdict. See HANDOFF for live-delivery status.

The Recording switch controls linked lab recording under the existing notice and [Lab privacy policy](https://human.adamwhite.work/lab/privacy/). Feedback shows what will be sent. With recording off, the optional sharing choice can enable it; without sharing, the note can be sent alone. Fictional continuity is automatic and separate from recording. Local replay or a downloaded file does not establish ownership of a continuing person. Imports and Sunday rewinds do not acquire native ownership. Diagnostic starts, imports, replay verification and continuity controls require `?lab=1`.

## Development and status

Use Node 24 or later (current delivery: Node 26) and TypeScript 7 or later. Run `npm ci`, then `npm run dev`. Run `npm run check:lane` through the shared suite wrapper described in [HANDOFF.md](HANDOFF.md) before committing. [AGENTS.md](AGENTS.md) records delivery rules; [player text rules](docs/lab/plain-english.md) govern wording.

The app package is `0.1.0`; new games use `pass@13`, continuation rules `pass-13` and cast chapter `pass-cast/1`. Current pins are HF package `3.0.0`, Person engine `2.23.0`, lab-client `0.4.11` and lab-kit `0.5.12`. These version numbers describe different contracts. See HANDOFF for the signed app source, CI, deployed receipt and browser-check limits. Adam’s game-readiness acceptance remains separate. Friends’ playtests and Show HN remain paused.
