# Curio technical plan

## Context

Curio replaces QuestLearn as the Flip the Switch entry (Track 2 + Code with Wispr, solo). You name something you're curious about, and a team of agents in the Switch room `#curio-mind` maps it onto a living star map, teaches it, and debates it in front of you.

**Time left:** planning finished Thu Nov 5 around noon IST. The deadline is Nov 7, 11:59 PM IST. That leaves about 2 working days, with recording by 4 PM and submission by 8 PM on Nov 7.

**Starting point:** QuestLearn is committed and pushed on `main` (`33c6278`, working tree clean, no secrets tracked), so nothing is at risk. The Switch plumbing carries over and has been tested live. The road UI and the resource and quest logic do not. About a third of the work so far transfers, and it's the riskiest third.

I've assumed Curio fully replaces QuestLearn. If you wanted to keep both, tell me before approving.

## What the Switch docs say

`switch-docs` was already installed and connected, so I ran nothing. The command in your message isn't a valid CLI command, and `docs.flintai.dev` now redirects to `docs.switchagents.ai`.

**How agents are registered**
- `POST /agents` once per agent, using a registration key. It returns `{id, api_key}`, and the key is shown once.
- Registering the same name again gives a 409. `overwrite: true` issues a new key and breaks the old one, so `scripts/bootstrap.ts` stores keys and skips agents it already has.
- Agents with the same owner can address each other. The docs page says a new agent answers only its owner, but the server's default is `owner_and_owner_agents` (`addressing.py`), and QuestLearn's handoffs confirmed that live. No extra call is needed.

**How agents share context in a room**
- **The room log:** each room is an append-only log, and `read_context` returns it grouped into threads.
- **Room Instructions:** every agent gets them on joining.
- **Room documents:** any member can read one with `load_internal_documents`, but only the agent that created it can edit it.
- **Limit:** a client ignores events from before it joined, so all agents join when the room is created.

**How one agent reads and responds to another**
- **There's no subscription to a particular agent**, which the spec assumed. A connection with `filter=all` receives every message in the room. `payload.addressed` says whether the message names that agent.
- To reply, an agent calls `send_targeted_message(body, target_names, thread_id)`. The docs state there's no separate task protocol: a handoff is just a message.
- Follow-ups start only from a person's message, so every debate turn must name its opponent explicitly.
- **Nothing stops two agents replying forever.** I found no limit in the docs or the source for agent-to-agent traffic, though a text search can't prove there's none. Curio must cap turns in code, and Gate 1 tests a long exchange live.

## Spec changes

| Spec says | Reality | Plan |
|---|---|---|
| Agents receive events by SSE | SSE is deprecated and will be removed | Use the existing WebSocket client |
| "Subscribe to another agent's messages" | No such feature | `filter=all` plus addressed replies (section 3) |
| Deadline Nov 7 | 11:59 PM IST | Submit by 8 PM IST |
| Six agents | The app needs a voice in the room and exact XP rules | Add `keeper`, a rules-only agent with no LLM |
| Learner only uses the web app | Rules need a person and an agent to finish a task **in team chat** | `@scout teach me about tides` works in Mattermost, and you can question a debater there |
| Curiosity Scout links revolution to the Enlightenment | Teacher makes that same link at 0:35, so the Scout would repeat it | The Scout may only propose a link that doesn't exist yet. The demo line becomes whatever it really finds |
| Seed a constellation | Passing it off as real history would mislead judges | Generate it with the real agents, backdate it, and label it sample data in the README |
| "Historian" as a debater | Odd for a physics topic | Keep the name. Teacher sets each side's position per topic |
| Mattermost already set up | It's our own Docker stack in `infra/` | Keep it and add `#curio-mind`. QuestLearn's `#quest-build` is left alone |

`frontend-design` isn't installed as a skill, but I've read its file in the plugin folder and will follow it, re-reading it before UI work.

## 1. Folder structure and tech stack

```text
curio/                           # new project, separate from flip-the-switch-demo
├─ README.md                     # leads with how Switch is used
├─ infra/                        # keep: Switch 0.31 Docker stack
├─ apps/
│  ├─ web/src/
│  │  ├─ features/sky/           # Constellation, Star, Edge, Starfield, layout.ts, clusters.ts
│  │  ├─ features/lesson/        # LessonSheet, UnderstandingCheck
│  │  ├─ features/debate/        # DebateChamber, Duelist, ArgumentBubble, TensionMeter
│  │  ├─ features/hud/           # Hud, XpBar, CuriosityBadge, Streak, ScoutSignal
│  │  ├─ features/topic/         # TopicInput (text + voice)
│  │  ├─ features/team/          # TeamFeed (keep)
│  │  └─ store/                  # Zustand store fed by the event stream
│  └─ server/src/
│     ├─ agents/                 # keeper, scout, curriculum, teacher, historian, contrarian, curiosity-scout
│     ├─ prompts/                # one .md per agent
│     ├─ http/                   # keep: Hono routes + SSE to the browser
│     └─ search/                 # keep: tavily.ts, verify.ts
├─ packages/
│  ├─ switch-client/             # keep; add thread support
│  ├─ core/                      # schemas, gameRules, validators, LLM adapter
│  └─ db/                        # new tables
├─ scripts/                      # bootstrap, seed, smoke
└─ seed/                         # generated sample constellation
```

| Layer | Choice | Why |
|---|---|---|
| Base | TypeScript, pnpm, React 18, Vite, Tailwind v4, `motion`, Zustand, Hono, SQLite + Drizzle | Already in place and working |
| Graph layout | `d3-force` 3 with `d3-zoom` 3, drawn in SVG | See section 6 |
| Celebration | `canvas-confetti` 1.9 | Small and proven |
| Voice | Browser Web Speech API, hidden if unsupported. Wispr also types into the same box | No key needed |
| LLM | Gemini while building, Claude Haiku 5.5 (`claude-haiku-5-5`) for recording | Your earlier decision |

**Reused as is:** `packages/switch-client/src/agent.ts`, `register.ts`, `infra/`, `scripts/init-switch-env.mjs`, `scripts/create-registration-key.mjs`, `apps/server/src/http/routes.ts`, `apps/web/src/features/team/TeamFeed.tsx`.

**Adapted:** `handoff.ts` (tag becomes `curio`, adds debate fields, `MAX_HOPS` 12), `scripts/bootstrap.ts`, `apps/server/src/team.ts`, `packages/core/src/llm.ts` (adds a `validate` callback and the Anthropic provider), `agents/game-master.ts` (becomes `keeper`), `agents/curriculum.ts`, the serial `reports` chain from `resource-scout.ts` (reused by Teacher), and the spring-along-a-path idea from `Vehicle.tsx` (reused for the comet on new connections).

**Removed:** `features/map/`, `GoalSign`, `NodeSheet`, the `resource-scout` agent, and the quest schemas. All of it stays in git on `main`. Packages rename from `@questlearn/*` to `@curio/*`.

## 2. The agents on the Switch protocol

| Agent | Type | Filter | Job |
|---|---|---|---|
| `keeper` | Rules, no LLM | `all` | App's voice in the room, only database writer, XP, mirrors the room to the browser |
| `scout` | LLM | `addressed` | Assesses level and finds what you already know that's relevant |
| `curriculum` | LLM | `addressed` | Builds the concept map with its links |
| `teacher` | LLM | `addressed` | Writes lessons and checks, moderates debates |
| `historian` | LLM | `addressed` | Argues one side |
| `contrarian` | LLM | `addressed` | Argues the other side |
| `curiosity-scout` | LLM | `all` | Watches the room and speaks up unprompted |

Each is a custom client on the documented protocol, built with `SwitchAgent`. Agents share no memory in code, even though they run in one Node process: anything one knows about another comes through a Switch message or room document. If Switch stops, all coordination stops.

**Handoff line** (reads like QuestLearn's, which was tested live):

```text
@contrarian > "bread prices doubled in 1789" ... That explains the anger, not the demands.
[curio v1 type=debate.turn debate=d_12 turn=3 of=6 pressure=4 hop=5]
```

**Spine flow:**

1. A topic arrives from the web (via `keeper`) or from `@scout` in Mattermost.
2. `scout` reads the `mind-map` document (owned by `keeper`), writes `target-<id>`, and hands off to `curriculum`.
3. `curriculum` writes `map-<id>` and sends `map.ready` to `keeper` and `teacher`.
4. `keeper` saves the concepts and stars appear. `teacher` writes every lesson straight away, 3 at a time, into `lessons-<id>`, so clicking a star doesn't wait on the model.
5. When you pass a check, `keeper` posts `concept.mastered` to the room and updates `mind-map`.

## 3. The Debate Chamber

This is real agent-to-agent messaging. Each debater only knows what Switch delivers to it.

```text
You click "Debate this"
  keeper     -> @teacher     debate.requested
  teacher    -> thread root: the question and both positions (room doc debate-<id>)
             -> @historian   debate.open
  historian  -> @contrarian  debate.turn 1
  contrarian -> @historian   debate.turn 2     reads the thread, quotes turn 1, answers it
  ...                        turns 3 to 6
  last turn  -> @teacher     debate.closed
  teacher    -> @keeper      debate.verdict    what they disagree on, what both accept, your takeaway
```

**On each turn, a debater:**
1. Receives the addressed message over its WebSocket.
2. Calls `read_context` and takes the debate's thread as the transcript.
3. Sends that transcript to the model, which returns `{rebuts, argument, pressure, concedes}`.
4. Has code check that `rebuts` is a word-for-word quote from the opponent's last message, retrying once if it isn't. The debate can't be scripted, because each turn must quote text that didn't exist until the other agent wrote it.
5. Replies with `send_targeted_message`, naming its opponent, in the same thread.

**Safeguards:**
- Both debaters stop at `turn == of` (6 turns), and the hop cap backs that up.
- `message_id` duplicates are skipped, as they are today.
- A 90-second watchdog in `keeper` ends a stalled debate, and the UI says so plainly.

**You can join in.** Anything you post in the thread is in the transcript the next speaker reads, and the prompt tells them to answer you first. This shows the debate is live, and it counts as a person and agent working in chat.

**Browser view:** `keeper` already sees every message, so it parses each turn and sends it over SSE. The UI shows who's composing while the model works. It paces how bubbles appear but never changes their content.

**Expected time:** 8 model calls, so roughly 30-50 seconds. Gate 1 and the Haiku test give the real number.

**Optional, cut first:** each debater runs one Tavily search and cites only verified results, reusing `search/`.

## 4. Knowledge data model

```ts
Topic      { id, title, cluster, level, status: building|ready|failed, createdAt }
Concept    { id, topicId, title, summary, cluster, order,
             status: forming|locked|current|mastered, masteredAt? }
Edge       { id, fromId, toId, kind: within|prior|cross_topic, why,
             createdBy: curriculum|curiosity-scout, revealedAt? }
Lesson     { conceptId, paragraphs[], connection?: { conceptId, sentence } }
Question   { id, conceptId, prompt, options[4], correctIndex, explanation }
Attempt    { id, conceptId, score, total, passed, createdAt }
Debate     { id, conceptId, question, positionA, positionB, threadId, status, verdict? }
DebateTurn { id, debateId, turn, speaker, rebuts, argument, pressure, messageId }
Offer      { id, fromId, toId, message, status: pending|accepted|dismissed, createdAt }
Progress   { xp, streakDays, lastActiveDate }      // level is derived
Activity   { id, sender, senderName, body, timestamp }
```

- **Clusters:** a fixed list of history, science, ideas, geography, language and arts. The model picks one, and code maps it to a color.
- **Check:** 3 questions, pass 2 of 3. `correctIndex` and `explanation` stay on the server until grading.
- **XP (`packages/core/src/gameRules.ts`):** lesson +20, debate +30, mastery +100, first-try bonus +25, accepted connection +50.
- **Curiosity Levels:** Wanderer, Asker, Explorer, Scholar, Polymath.

## 5. Agent system prompts

Shared preamble:

```text
You are {name} on the Curio team in #curio-mind.
Work only from the documents and messages you were given.
Never invent sources, quotations, statistics or learner history.
Where historians or scientists disagree, say so.
Return only JSON matching the schema.
```

- **Scout:** "Given a topic and the learner's known concepts, return a focused learning target, their likely level (new, some, solid), and up to 8 known concept ids that truly relate to it. If none relate, return none. Never stretch a connection."
- **Curriculum Agent:** "Turn the target into 4-6 concepts in learning order. Each teaches one idea, with a short title and one-sentence summary, and links to an earlier concept in this map or a known concept from the list, using ids exactly as given. Say why in one sentence. Pick a cluster from the fixed list."
- **Teacher (lessons):** "Teach this concept in 3 short paragraphs for a curious adult. If a known concept is linked, open by connecting to it, in a way that genuinely helps. Then write 3 multiple-choice questions testing understanding, not recall, with 4 plausible options, one correct, and a one-sentence explanation."
- **Teacher (moderator):** "Frame one real, contested question about this concept and two defensible positions. Both must be positions serious people hold. After the debate, state where the two truly disagree, what both accept, and one takeaway. Don't declare a winner."
- **Historian:** "Argue your assigned position from evidence: what happened, in what order, and why that matters. Quote one exact phrase from your opponent's last message in `rebuts`, then answer it directly. Under 80 words. Concede a point when it's fair. If the learner has spoken, answer them first."
- **Contrarian:** "Argue your assigned position by attacking the weakest assumption in what was just said. Quote one exact phrase from your opponent's last message in `rebuts`, then answer it directly. Under 80 words. Disagree with the reasoning, never the person. If the learner has spoken, answer them first."
- **Curiosity Scout:** "You receive the learner's mastered concepts with their clusters, ages and existing links. Find one surprising, true connection between two concepts in different clusters that aren't already linked. Write one inviting sentence to the learner. If nothing is genuinely interesting, return found: false."
- **Keeper:** no prompt. Posts fixed templates such as "Mastered: Estates-General. +100 XP."

## 6. The constellation UI

**Layout engine: `d3-force` with SVG rendering.** React Flow is built for node editors. `react-force-graph` draws to canvas, so Framer springs and path drawing wouldn't apply and the signature animation would be custom work. A demo sky holds well under 100 stars, which SVG handles easily.

**How the layout works (`features/sky/layout.ts`):**
1. Forces are `forceLink`, `forceManyBody`, `forceCollide`, and `forceX/Y` toward each cluster's anchor on a ring.
2. When concepts arrive, existing stars are pinned so the map doesn't jump. New stars start at the star they link to.
3. The simulation runs to rest off-screen (about 300 ticks), and Framer springs each new star to its computed spot. This gives the pop and settle without re-rendering every frame.

**Node states:**

| State | Look |
|---|---|
| `forming` | Dim pinpoint while Teacher writes |
| `locked` | Hollow ring in the cluster color |
| `current` | Bright, pulsing halo |
| `mastered` | Gold core, cluster-colored halo |

**The signature line:** `prior` and `cross_topic` edges stay hidden until earned. On mastery, the edge draws using `pathLength` from 0 to 1 along a gentle curve, with a bright comet following it. The far star flares when the comet lands, then come confetti and the XP fill. `within` edges stay faint from the start.

**Drift:** stars don't move individually, because lines would detach. The whole map sways slowly (about 1 degree), and three starfield layers shift with the pointer for parallax. Halos use radial gradients, since SVG blur filters get slow. Reduced motion turns drift off.

**Design direction, "The living star atlas":** an old engraved celestial atlas that has come alive, rather than a sci-fi dashboard. The sky is the one bold element, and everything else stays quiet.

| Token | Value | Use |
|---|---|---|
| Void | `#07070F` | Background (from the spec) |
| Gold | `#FFD66B` | Mastered, XP |
| History / Science | `#FF7A66` / `#4FD8EB` | Clusters |
| Ideas / Geography | `#A78BFA` / `#5EE6A8` | Clusters |
| Language / Arts | `#FF7AB6` / `#7C9CFF` | Clusters |

- **Type:** Fraunces for star names and display, in its soft italic like hand-lettered atlas labels. Figtree for body text.
- **Atlas details:** thin engraved rings around each cluster, with cluster names set along the arc.
- **Debate Chamber:** a full-screen overlay. Two original avatars face each other and a spotlight moves to the speaker. Each bubble shows the phrase it's rebutting with a thin line back to the bubble it came from, so you can see them answering each other. The tension meter tilts using each turn's `pressure`, and the chamber closes on Teacher's verdict.
- **HUD:** XP bar, Curiosity Level badge, streak, stars collected, and a small star that lights up when the Curiosity Scout has something.

I'll critique from screenshots as I build, using the existing Playwright scripts.

## 7. How concepts and connections are generated

Everything comes from the model at runtime, and code checks it before it reaches the map.

1. `keeper` keeps `mind-map` current: concept ids, titles, clusters, status and age. A sky this size fits in one prompt, so no embeddings are needed.
2. `scout` picks the known concepts that really relate.
3. `curriculum` links each new concept to an earlier one in the map or to a known one.
4. Code rejects any id that doesn't exist and sends the error back for one retry.
5. `teacher` receives the linked concept and opens the lesson with that connection.
6. If nothing relates, the concept links only within its topic. A missing link is better than a fake one.

**Curiosity Scout (Level 3):**
- It runs on `filter=all` and sees `concept.mastered` even though nobody addressed it. That's what makes it proactive.
- With 2 or more clusters mastered and a cooldown passed (90 seconds, configurable), it asks the model for a connection.
- Code confirms both concepts are mastered, in different clusters, and not yet linked.
- It posts to the room and sends `curiosity.offer` to `keeper`, and the HUD star lights up.
- Accepting in the app, or `@curiosity-scout yes` in chat, draws a `cross_topic` line across the sky.
- "Last week" comes from real timestamps supplied by code, so the model can't invent it.

## 8. Day-by-day plan

**Gate 1, first thing today (about 30 minutes):** register `historian` and `contrarian` and run 8 alternating turns in a thread with no person involved. It confirms:
- Replies stay addressed, with no refusal or throttling.
- `read_context` returns the thread in order.
- The thread shows correctly in Mattermost.
- Round-trip time per turn.

If threads misbehave, debates run as top-level messages tagged with a debate id.

| Day | First half | Second half | Must be true by the end |
|---|---|---|---|
| **Nov 5** | Branch, rename, Gate 1, bootstrap `#curio-mind`, schemas, `keeper`, `scout`, `curriculum` | `teacher`, `layout.ts`, Constellation, Star, LessonSheet | A topic becomes stars through Switch, and clicking one opens a real lesson connected to prior knowledge |
| **Nov 6** | Check, mastery, `gameRules`, HUD, edge drawing, confetti, voice. **Level 1 done by 2 PM** | `historian`, `contrarian`, moderator, Debate Chamber, Haiku connected. **Level 2 done by midnight** | A real debate runs live in the app and in Mattermost |
| **Nov 7** | `curiosity-scout`, seed sky, polish. **Level 3 done by 1 PM** | README, clean the room, fresh-clone test, record by 4 PM, submit by 8 PM | Submitted with about 4 hours spare |

Debate work doesn't start until Level 1 passes end to end, and the Curiosity Scout doesn't start until debates work. **Level 4 isn't in this plan**: Explain it 3 Ways, Connection Council and Quizmaster stay out unless everything is finished early.

**If time runs short, cut in this order:** debate sources, sound, chat `yes` for offers, cluster arc lettering, tension meter (the spotlight stays), voice button (Wispr still works). Real Switch debates and the line-drawing moment are never cut.

## 9. Demo seed data

`scripts/seed.ts` runs real topics through the real agents, then backdates their mastery over the previous 2 weeks and saves the result to `seed/`:

- **History:** The Enlightenment, The Silk Road
- **Science:** How tides work
- **Ideas:** Supply and demand, How tariffs work
- **Arts:** Harlem Renaissance

That's about 15-20 stars with a 5-day streak. Lessons and links are real model output, never hand-written facts. The README states that this history is sample data.

Recording runs the French Revolution live, with waits cut. If a live run fails, the video says so rather than passing a replay off as live.

## 10. Submission checklist

**Track 2**
- [ ] Public repo passes a fresh-clone test
- [ ] README covers how Switch is used, the architecture, setup (use `infra/`, because the native Console server has no Gateway), and which data is sample
- [ ] Video shows real debate traffic in Mattermost
- [ ] Video shows a person and an agent completing a task in chat
- [ ] You can explain the code, as the rules require

**Code with Wispr**
- [ ] Prompts, agent instructions and docs dictated throughout
- [ ] Scorecard screenshot from Insights in the Wispr Flow desktop app

## Your steps

1. Add Anthropic credit by Nov 6 for the Haiku recording.
2. Create a public GitHub repo for Curio before submitting. I won't commit or push until you ask.
3. Replace your Gemini and Tavily keys after the hackathon, because both were pasted in chat.

## First steps after approval

1. Create `D:\Workspace\hackathon\curio` as its own git repo, copying the reusable code. `flip-the-switch-demo` is left as it is.
2. Update memory: Curio replaces QuestLearn.
3. Run Gate 1.

## Verification

- **Unit tests (Vitest):** `gameRules`, handoff parsing, check grading, link validation, the `rebuts` quote check, and the turn cap.
- **`scripts/smoke.ts`:** runs a topic and a debate, then uses `read_context` to assert that all 6 turns exist and each quotes the previous one.
- **Switch dependency test:** stop Switch and confirm topics and debates both refuse to run with a clear message.
- **Live debate test:** post a question in the Mattermost thread and confirm the next speaker answers it.
- **Curiosity test:** master a concept in a second cluster and confirm an offer arrives with nobody addressing the Scout, and that it never proposes an existing link.
- **Answer leak test:** the check API returns no `correctIndex` before grading.
- **Visual check:** screenshots of each star state, the line draw, the Debate Chamber, and a run with reduced motion.
- **Fresh clone:** follow the README from an empty folder.

## Sources

- [Agent protocol](https://docs.switchagents.ai/switch-rooms/internals/agent-protocol), [agent events](https://docs.switchagents.ai/switch-rooms/internals/agent-events), [agent connection](https://docs.switchagents.ai/switch-rooms/internals/agent-connection), [life of a message](https://docs.switchagents.ai/switch-rooms/internals/life-of-a-message)
- [Share context](https://docs.switchagents.ai/switch-rooms/using/shared-context), [work in a room](https://docs.switchagents.ai/switch-rooms/using/work-in-a-room)
- Live `GET /agents/{id}/ops` signatures for `send_targeted_message`, `read_context` and the room document operations
- [Switch source](https://github.com/sandbox-quantum/switch): `core/switch_core/addressing.py`, Mattermost adapter
