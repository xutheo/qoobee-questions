# Jeopardy

A host-led multiplayer Jeopardy app with fair team rotation, live buzzers, two five-category boards, Final Jeopardy, and automatic game recovery from disk. No database or external account is required.

## Qoobee’s Plan

The home page has a **Qoobee’s Plan** tab for an offline, host-operated three-team gauntlet. It also opens directly at `?plan=host`. No player phones are needed. All gauntlet gameplay runs on static hosting. Hidden Word uses host-entered clues and similarity percentages; no AI service or API key is needed.

1. Name three teams (each starts with 1,000 points), then start the gauntlet. Before starting, the audience sees only the centered Qoobee’s Plan title and the three team boxes at the bottom.
2. Open **Audience screen** on the same computer/browser and share only that window. Keep the host console private: it contains secret equations, cubes, words, and pending answers.
3. Collect category wagers, show the game’s rules on the audience screen, then start each game: Count the Rectangles → Equation Decrypto → Memory Poker → Gradation → Hidden Word.
4. Enter spoken buzzes and answers in the host console. The audience screen updates automatically. Count the Rectangles finishes at 3 points; Memory finishes at 5. Equation Decrypto and Gradation use all three round-robin pairings, with spectator wagers locked before each match.
5. Resolve tied game scores in person except in round-robin games, where tied teams split the combined placement rewards and first-place ties refund category wagers. Award 300 / 200 / 100 and settle category wagers. Winning wagers earn the stake in profit; losing wagers lose the stake. Category stakes are reserved when validating spectator wagers.

Progress is saved in this browser’s local storage. Use **Undo last action** to correct a host entry (undo history lasts until reload); export a private backup to move or safeguard a game. Only one host console should be open. The audience window does not receive unrevealed secret inputs.

Host tools include **Next game**, which can finish and award the current game or skip it without awards. Skipping voids outstanding wagers and retains already settled scores. **Adjust points** can add/subtract or set exact overall and current-game scores; changes are logged and undoable. Current-game scores can be edited before placements are awarded. Overall scores cannot be reduced below active reserved wagers.

Count the Rectangles offers Easy (3–5 rows and columns), Medium (6–7 rows and columns, with or without holes), and Hard (irregular connected shapes and the pictured 8×8 perforated board) generators. Choose Puzzle difficulty before showing a puzzle; the choice carries to the next round. Visible cells are editable and may contain blanks or negative numbers. Blank cells count as zero, but missing cells are holes: no valid rectangle can include a hole. The host records the first team to buzz and enters its count. A correct answer earns 1 point; wrong answers lock the team out without deducting points. The host can allow locked teams to re-answer. Puzzles allow five minutes to buzz; there is no time limit once a team is answering. First to three wins. The private answer key enumerates every grid-aligned rectangle. Old active Tower saves start the replacement game’s rules with game points reset, preserving gauntlet balances and wagers.

Other rule adaptations: Memory uses illustrated playing cards and host-controlled individual reveals, with two team-colored chips and specific hand names. The whole board flips before individual hand reveals. Two-way ties award 0.5 points each; three-way ties award none. Memorization lasts 30 seconds. Equation Decrypto collects both guesses privately and publishes both results together, recording simultaneous solves as draws. Gradation plays one seven-cup match per pairing, allowing draws. Both games cap spectator bets at 150; draws refund spectator wagers. Hidden Word uses editable English noun envelopes, simultaneous guesses, three clue stages with thresholds of 90%, 93%, and 95%, and double points in round two. A host-word practice round lets all three teams guess without scoring. After ten unsuccessful clues in a set, the highest-scoring entered clue is used automatically. The host enters and publishes all clues and percentages. Its Piece-funded extra-answer option is omitted because this gauntlet has no Pieces.

Validation: `npm test`, `npm run build`, and `npx playwright test --config plan.playwright.config.ts` (local Microsoft Edge browser).

## Running the app

Requires Node.js 22 or later (developed and tested with Node 24).

```sh
npm ci
npm run build
npm start
```

Open **http://localhost:3000**. For development, use `npm run dev`; the backend serves Vite through the same port.

On this Windows computer, open PowerShell and run:

```powershell
cd "C:\Users\zhaok\Documents\ChatGPT\jeopardy web-app"
npm ci
npm run build
npm start
```

Leave that terminal running while playing. Press **Ctrl+C** to stop the server. On subsequent launches, just run `npm start` from the same folder. Run `npm ci` and `npm run build` again after downloading code changes. If port 3000 is already in use, the app may already be running; use its existing browser address or choose a different `PORT`.

The server listens on all network interfaces. For players on the same Wi-Fi, open `http://YOUR-COMPUTERS-LAN-IP:3000` on the host and player devices. A `localhost` invite only works on the host computer. The host's firewall must permit incoming traffic on the chosen port. Use a server with HTTPS and WebSocket support for remote internet players.

Optional environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | HTTP and Socket.IO port |
| `DATA_DIR` | `./data` | Private persistent save directory |
| `ALLOWED_ORIGINS` | Empty | Comma-separated frontend origins allowed cross-origin API and Socket.IO access |

PowerShell example:

```powershell
$env:PORT = '3000'
$env:DATA_DIR = 'C:\JeopardyData'
npm start
```

## Publish the website on GitHub Pages

The website is hosted at **https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/**. The included workflow builds and publishes the frontend to GitHub Pages. The Node.js game server runs separately: GitHub Pages serves static files and cannot run the live buzzer server or write game saves.

### 1. Push this project to GitHub

Create an empty repository and push the project from this folder (replace the example URL):

```sh
git add .
git commit -m "Add team Jeopardy with GitHub Pages deployment"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
git push -u origin main
```

If an origin remote already exists, use it. Saves and dependencies are excluded by .gitignore. Keep downloaded host keys and game backups outside the repository.

### 2. Start the separate game server

Use any Node.js host with HTTPS, WebSocket support, and a persistent disk. The optional render.yaml configures this backend on Render:

1. In [Render](https://dashboard.render.com/), choose **New → Blueprint** and select the repository.
2. Set **ALLOWED_ORIGINS** to your Pages origin, e.g. **https://YOUR-USERNAME.github.io**. Do not include the repository path. For a custom domain, use that domain's HTTPS origin instead.
3. Review the cost and create the service. This optional backend configuration uses paid compute and a 1 GB persistent disk. See [Render disk requirements](https://render.com/docs/disks).
4. Copy the resulting HTTPS backend URL, such as **https://quiz-social-example.onrender.com**.

The backend starts with `node --import tsx server/index.ts --production` and stores games under /var/data/jeopardy on its mounted disk. Automatic backend redeploys are disabled to avoid interrupting games. Deploy backend updates manually between games. You may use another server instead; Render is not required for Pages hosting.

For a self-hosted backend, keep the usual `npm ci`, `npm run build`, and `npm start` commands. Set ALLOWED_ORIGINS before starting and expose the server through HTTPS. A public Pages site cannot reliably use a plain HTTP or localhost backend; localhost refers to each player's own device.

### 3. Configure GitHub Pages

1. In the GitHub repository, open **Settings → Pages** and choose **GitHub Actions** as the source.
2. Open **Settings → Secrets and variables → Actions → Variables**.
3. Add a repository variable named **VITE_SERVER_URL**, with the HTTPS backend origin from step 2. Do not append /api or a repository path. This is a public URL, not a secret.
4. Open **Actions → Deploy website to GitHub Pages → Run workflow** on main. Future pushes to main also publish the frontend automatically.
5. Once the workflow succeeds, open the Pages URL shown in Settings → Pages. Share that website with the host and players.

The workflow derives the correct repository or custom-domain base path from GitHub Pages. Join links, shared-display links, home navigation, and assets stay under that path. Only the dist directory is uploaded; backend code and game saves are not deployed to Pages. Missing or invalid VITE_SERVER_URL causes a clear build failure instead of publishing a nonfunctional multiplayer site.

Changing VITE_SERVER_URL requires running the Pages workflow again, because it is included at build time. Changing your Pages domain also requires updating ALLOWED_ORIGINS on the backend and restarting it. Multiple allowed origins can be comma-separated. Separate repositories under the same github.io origin should use separate backends or be treated as equally trusted browser origins.

### Recovery and verification

Server restarts and redeploys preserve snapshots if the backend's persistent disk remains attached. The host opens the saved game from the Pages website and resumes. To move a local game to a different backend, download its backup and import it through the new website; this creates a new room and credentials.

`npm run test:pages` builds a frontend under /quiz/ and tests it against a different-origin backend, including host-only API access, live player joining, display links, and navigation. It uses installed Microsoft Edge by default, like the other browser tests.

The deployment files are prepared locally. Publishing still requires your GitHub repository and a reachable HTTPS backend. No GitHub or paid hosting resource has been created by these edits.

References: [GitHub Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [Vite Pages deployment](https://vite.dev/guide/static-deploy.html).

## Play a game

1. Select **Host a game** and name the game.
2. Open **Edit game boards**. Enter five categories with five clues each on both boards, plus Final Jeopardy. **Use sample questions** loads a complete collection you can play immediately or customize.
3. Invite players with the six-character room code or invite link. Each player joins from their own browser and chooses a team. **Teams & players** lets the host rename or add teams, rebalance the lobby, and assign captains.
4. Connect players on at least two teams, then select **Let's play**.
5. Select a clue. The app chooses a representative per team. The 10-second countdown starts immediately for a normal question.
6. The first eligible player to buzz answers aloud. The host marks **Correct** or **Incorrect**. After 10 seconds of active thinking time, buzzing opens to everyone on teams that have not already answered.
7. After the last clue is finished, return to the board to automatically advance to the next board or Final Jeopardy. In Final Jeopardy, captains submit private wagers and answers; the host judges the results.

The shared display is available under **Game tools**. It shows the board, active representatives, buzzer winner, and scores without exposing private answers.

## Rules implemented

- Board 1 values: 100, 200, 300, 400, 500. Board 2: 200, 400, 600, 800, 1,000.
- Representative fairness is per team. Each available teammate plays once before the rotation repeats. Disconnected players retain an owed turn when they return. Rotation continues between boards.
- Buzzing pauses the thinking timer. Incorrect answers subtract points, lock out the whole team for that clue, and resume the remaining timer. Correct answers add points and finish the clue.
- Negative scores are allowed. The host may close unanswered clues without scoring.
- Final Jeopardy permits wagers from zero to the greater of 2,000 points or the team's score, including teams with zero or negative scores. Answers have a 30-second timer. Missing answers are incorrect. Ties share the win.
- Late arrivals wait for host admission. Team changes are available in the lobby. The first teammate is initially captain; the host may reassign that role.
- Host disconnects pause the game. An immediate **Undo last ruling** restores the previous answer opportunity, provided no subsequent buzz or transition has occurred. Older corrections use a score adjustment with a reason.

## Player reconnection

Players do not load saved game states. If their connection briefly drops, the open page reconnects automatically. If they close the tab, switch devices, or clear browser data, they can enter the room code and their original username on the join screen to reconnect to the existing player.

Username matching ignores capitalization and extra spaces. The original team, captain role, participation history, and current representative slot are preserved; the team selector applies only to new players. A username that is still connected cannot be claimed from another browser. After an abrupt network loss, wait for the server to detect the disconnect before retrying. A host's decision to sit a player out is preserved on rejoin.

This is a room-code-and-username recovery flow intended for trusted game participants. Usernames are unique within each game. Rejoining from a fresh browser replaces the old device's session credential.

Only host sessions appear in **Your saved games**. Backup and host-key import are under **Host a game → Restore a game backup or host key**. Players simply reconnect to the active room; only the host resumes a recovered or paused game.

## Saving and restoring

Hosts can choose **Delete session** under **Your saved games** and confirm **Delete permanently**. This removes the complete game directory from the server, including every snapshot and interrupted write, and removes the saved session from the host's browser. Connected players are disconnected. Other games are unaffected. Downloaded backups on your own computer are separate files and are not deleted. Deletion is irreversible; canceling the dialog makes no changes.

Every accepted game action is saved before the server acknowledges it. Running timers additionally checkpoint once per second. Files live at:

```text
data/games/<game-id>/snapshot-000000000001.json
```

Snapshots contain the complete state, including boards, scores, scoring history, fair-selection queues, accepted buzzes, timer remainder, Final Jeopardy submissions, and hashed session credentials. Temporary writes are flushed and renamed into numbered generations. The latest 20 generations are retained, with checksums and structural validation.

**After a process restart:** start the app with the same `DATA_DIR`, open **Your saved games** in the same host browser, and select the game. The game is recovered paused. Players reconnect with their existing browser identities; the host reviews the roster and resumes. Downtime does not consume timer time. A running timer may gain back roughly one second plus checkpoint scheduling/write delay.

**If the latest snapshot is corrupt:** the server tries an older valid generation and prominently reports that recent progress may be missing. If no valid snapshot exists, it preserves the files and reports the failure. Newer unsupported schemas require a compatible app version.

**If saving fails:** the server freezes gameplay instead of announcing unsaved actions. Fix the disk or directory permissions, then use **Retry storage** to reload the last valid saved state, followed by **Resume**.

**Host access from another browser:** download the private host key from **Game tools** in advance. On the home page, choose **Host a game → Restore a game backup or host key** and select that key. Host keys grant full control and must stay private. The key refers to the existing server save; it is not a game backup.

**Portable backups:** **Download game backup** exports state without access credentials. Import it through **Host a game → Restore a game backup or host key** to create a separate paused room. Returning players join the new room, and the host uses **Teams & players → Claim saved player** to link new connections to saved identities. Private question answers and wagers are included in backups.

Use a persistent local disk or mounted volume. Temporary container storage does not survive deployment replacement. File snapshots protect against ordinary process interruptions, but disk failure requires an independent backup. Atomic rename and power-loss durability depend on the underlying filesystem; directory syncing is used where supported. Run only one backend process per save directory; a process lock prevents accidental duplicate writers.

## Development and verification

```sh
npm run check       # TypeScript
npm test            # Game rules, storage, and live-server restart tests
npm run build       # TypeScript + production browser bundle
npm run test:e2e    # Desktop host and mobile player browser flow
```

Browser tests use installed Microsoft Edge by default. Set `BROWSER_CHANNEL=chrome` to use installed Chrome instead. Tests create isolated game data, and browser tests save screenshots to `artifacts/`.

The automated tests cover selection cycles, disconnected players, deadline-edge buzzing, simultaneous buzzes, paused timers, team lockouts, duplicate scoring protection, answer privacy, Final Jeopardy, corrupted snapshots, retention, failed writes, forced server restarts, restored player identities, and a browser game through both boards and the finale.

## Project layout

- `src/`: React screens and responsive styling.
- `shared/`: shared types, validation schemas, point values, and sample boards.
- `server/game.ts`: server-authoritative game rules and role-filtered views.
- `server/storage.ts`: validated snapshots, retention, and directory ownership.
- `server/index.ts`: HTTP APIs, live connections, command queues, timers, and recovery.
- `tests/`: rule, persistence, integration, and browser tests.
- `DESIGN.md`: product rules and design rationale.

This version uses one backend process. GitHub Pages hosts the frontend, with a separate game backend; an optional Render backend configuration is included. No hosted service is provisioned automatically. Account-based host access, automatic speech judging, and multi-server scaling are outside this version. Google Fonts enhance the visual design when available; local font fallbacks keep the app usable without that connection.

## Images, group activities, Qoobee Boost, and fullscreen

In **Edit game boards**, each clue can be a question or a group activity. Questions support an optional **Qoobee Boost** checkbox. Attach PNG, JPEG, or WebP images (up to 8 MB input); the browser compresses them for storage. Images are embedded in board exports and saved snapshots, so recovery and deletion include them. Board and backup imports support up to 16 MB.

For a group activity, enter its name, HTTPS link, and result type. **Broadcast link & start** sends the link to all players. Players open it in another tab and return to submit:
- **Time:** **Finished** records elapsed server time from the host's start, excluding game pauses. It can only be submitted once. Times include the time taken to open the activity and return to this app, plus network delivery time.
- **Score:** players enter text such as `4/6` and may update it until submissions close.

The host selects **End activity**, compares results, and uses a team’s award button to assign points. There is no automatic winner. Players submit activity scores or completion times for the host to compare. Points are awarded only to teams, once per team per activity. Then finish the activity. Corrections remain available in Game tools → score adjustment. Reconnecting players retain submitted results. Recovery starts paused; elapsed activity time resumes from the last saved checkpoint.

For **Qoobee Boost**, representatives are selected when the clue is opened. The host chooses the wagering team and enters the wager agreed on by that team before revealing the question. Only that team's already-selected player answers aloud. A correct answer adds the wager and an incorrect answer subtracts it; either ruling ends the clue. The wager range is zero to the greater of the team's score or 1,000 points.

**Fullscreen** expands the game while keeping host controls, questions, images, activities and scoring interactive. Exit with the button or Escape. Browsers without native fullscreen use an expanded layout instead.

Players can see their team and teammates, and switch teams in the lobby. New players cannot join once gameplay starts; existing players can reconnect using their original username. Activity results are grouped by team; **End activity** locks results and opens team award controls. Boost losses subtract the full wager and can put a team below zero.

## Host console and streamed board

Use **Open streamed board** in the host toolbar to open a separate read-only display. Click **Fullscreen** in that window, then share it with players. Fullscreen hides display controls, fills the view with the board, and keeps team scores at the bottom. Selecting a clue on the host console updates the stream; host rulings and answer reveals update it too. Host editing, judging, activity results, and scoring remain in the host console.

In the lobby, **Teams & players → Remove [team]** deletes a team and randomly reassigns each member to another team. At least two teams must remain. Teams with no members are hidden after the game starts and do not block final wagering.

After **Finish activity**, **Unfinish activity** restores the activity's scoring review before returning to the board. Results remain locked and existing awards are preserved; a team cannot accidentally receive the same award twice.

When the host selects **End activity**, the streamed board shows up to five leaderboard entries with player names, teams, and submitted results. Timed activities rank fastest first. Score activities use **Leaderboard order** in the question editor: higher scores first by default, or lower scores first for games such as Wordle. Plain numbers and numeric fractions are ranked; fractions are compared as ratios. Other text (such as `X/6`) is left unranked and flagged for host review. Equal values share a rank; the display still contains at most five entries. These rankings never award points automatically.

Streamed clue panels have a spinning-card entrance, bordered question and answer areas, and a gold Qoobee Boost reveal. Reduced-motion preferences disable the spinning and moving rays.

The streamed board uses larger point values, a 1.6-second card spin, a centered clue area, and a countdown bar that freezes while a player answers or the game is paused. The accepted buzzing player's name is emphasized below the clue. **Close clue and reveal answer** ends a question and shows its answer without changing scores.

Use **Game tools → Reset game** to return the room to the lobby. A confirmation explains that scores, played clues, submitted activity/final results, wagers, and representative rotation history are cleared. Questions (including images), teams, players, and their access remain. Starting again randomly selects a participating team to choose the first clue.

The clue-selecting team is highlighted blue with **SELECTS NEXT**. A correct ruling transfers selection to that team; an incorrect ruling or closing a clue leaves selection unchanged. Undoing a ruling restores the previous selector. The host still operates the board on the selecting team's behalf.

Player team lists and the streamed scoreboard highlight the active representative in gold. Once someone buzzes, the actual answering player is highlighted. At the end of the ten-second exclusive window, everyone can buzz, so there is no single active representative until a buzz is accepted.

New player names are limited to six characters. Existing saved player identities are preserved for compatibility.

Players can use **Unfinish** to withdraw their own timed or scored activity result while submissions remain open. Finishing again records the new elapsed time. The streamed board zooms from the selected tile and shows the committed Qoobee Boost wager.

### Custom team puzzles
In **Edit game boards → Question type**, choose **Bomb defusal**, **Codebreakers**, or **Timelines**. Edit the shared message and private clue lines; each type includes a sample. Bomb defusal uses unique wire/symbol labels and a full cutting order. Codebreakers accepts one or more exact answers (case and surrounding whitespace ignored). Timelines uses unique event labels, matching private event clues, and an earliest-to-latest solution. Use at most 20 items/answers and 30 hints; every event needs a hint.

The host chooses **Broadcast clues & start**. Each team gets one operator chosen through the fair rotation, and clues are distributed round-robin across active teammates (repeated when there are more teammates than clues). For Timelines, each private clue includes its event name. Only the operator sees the wires or submission controls. The host can transfer this role using **Team operator**. Reconnects retain clues, progress, mistakes, and elapsed time. Pauses and server downtime do not count toward completion or lockouts.

Wrong wire selections add a mistake without cutting that wire; correct cuts remain. Wrong code answers add a mistake. Wrong timeline orders impose a 10-second team lockout. Completed answers cannot be withdrawn. After **End activity**, team results appear on the streamed board and the host can award team points. Bomb defusal and Codebreakers rank fewer mistakes first, then faster completion; Timelines ranks completion time. Unfinished teams do not outrank completed teams. Exact ties share rank. Points are not awarded automatically.

Import `public/team-puzzles-sample.json` using **Import boards** for a complete test collection with all three puzzle types in the first category. Puzzle solutions and other players' private clues are removed from player/display network views.

**Use sample questions** now loads all game modes. On board one, **Team Challenges** contains timed activity (100), scored activity (200), Bomb defusal (300), Codebreakers (400), and Timelines (500). The 1,000-point **Numbers Game** clue on board two is Qoobee Boost. The remaining clues are regular questions, followed by Final Jeopardy. Timed/scored samples use an HTTPS practice link; replace it with your chosen activity URL. Loading samples replaces the current boards after confirmation.

Team puzzle presentation now has three stages: selecting the clue shows **How to play** on the streamed board; **Broadcast clues & start** releases puzzle material and private clues to players; **End activity** displays the top five teams with completion times and mistakes. Customize the pre-start text using **Streamed instructions before starting** in the puzzle editor. Existing puzzles use built-in instructions automatically.

After **End activity**, **Undo end activity** reopens submissions and restores the streamed activity panel. Results, puzzle progress, and existing point awards are preserved; the elapsed clock resumes without including time spent reviewing results. This is separate from **Unfinish activity**, which reopens a finished clue for review. Bomb operators now use a visual wire module with colored cables, terminals, and separated wire ends after a correct cut.

Each board begins with five host-controlled category introductions. Add a **Category description** in the editor; it appears only on the large streamed intro panel. **Next category** minimizes the current panel into its board header, and **Show board** finishes the last intro. The current intro position is saved for recovery.

Incorrect bomb cuts flash/shake the module and enforce a one-second server-side cutting lockout. The module header shows mistakes beside **WIRE MODULE**. Positive activity point awards transfer next-question selection to that team; if several teams receive points, the last positive award determines the selector. Zero or negative adjustments do not transfer selection.

New players join with a room code and username, without choosing a team first. The server randomly selects among the teams with the fewest roster members, keeping assignments balanced as players arrive. Players may use **Switch team** after joining the lobby. Reconnecting by username retains the original team. The streamed lobby uses enlarged title/code text and team cards with player names for viewing on a shared screen.

## Final Jeopardy reveals

After answers lock, the host can select **Show team** on any team, in any order. **Reveal answer** and **Reveal wager** independently reveal that team's submission on the streamed board; selecting another team preserves earlier reveals. **Correct** adds the wager and **Incorrect** subtracts it exactly once, including negative totals. Judging selects that team on the stream and shows the score change. A score change necessarily indicates the wager even if its separate reveal panel is still hidden.

After judging every team, select **Show final leaderboard** to display the winners, all team totals, shared ranks for ties, and celebration effects. The last team's reveal remains visible until this button is pressed. Presentation state is saved with the game; reset clears it. Reduced-motion preferences disable celebration animations.

## Six-category boards and whole-team questions

New boards contain six categories and five clues per category (60 clues total). In the category editor, **Whole-team questions** marks a column with red borders on the streamed board. Regular questions in that category allow every active player to buzz immediately, with no representative-only countdown. The first buzz still wins, and an incorrect answer still locks that team out of the current clue. Qoobee Boost and group activities retain their own rules.

The sample JSON places **Team Questions** fifth and **Team Challenges** sixth on both boards. Board one's final column contains the five Bomb Defusal levels; board two's contains the other team activities. Older five-category imports/saves remain supported without inserting questions into games already in progress. Load the updated sample file to replace a lobby's boards with six categories.

### Pixel Perfect categories

In the question editor, enable **Pixel Perfect — images sharpen every 5 seconds** for a category, then attach an image and enter the prompt and accepted answer for each of its five questions. Keep each question's type set to Question and leave Qoobee Boost off. Enable **Whole-team questions** for immediate buzzing by any teammate; otherwise the usual selected-player rotation and 10-second exclusive period apply.

The host and streamed board show the same pixelated image. The longest edge starts at 8 pixels and increases to 12, 18, 27, 40, and 60 pixels at five-second intervals; after 30 seconds the original image is shown. Buzzing and pausing freeze the reveal. A wrong answer resumes it, and revealing the answer shows the original image immediately. Progress is saved with the game and retained across reconnects. Exported/imported categories preserve the `pixelPerfect: true` setting and embedded images.

### Mental Math Relay

Choose **Mental Math Relay** in a question's type menu. Set difficulty (1–5) and the operation types used after the opening addition. Each team gets different numbers with the same operation pattern, one private expression per active player, and a shuffled relay order. Expressions use `__` for the previous teammate's answer. Only the final player can submit; other players pass their results verbally.

The host broadcasts the relay with **Broadcast clues & start**. Wrong numeric answers add a mistake without a lockout, and elapsed time continues until the correct answer arrives. Results rank completed teams by mistakes, then time. **End activity**, **Undo end activity**, and team point awards work as for other team puzzles. Relay order, expressions, answer, and progress persist across reconnects and recovery. The sample collection contains five relay difficulty levels in board two's third category.
Relay difficulty now sets the number of operations in each private expression: levels 1–5 use 1–5 operations per player. Expressions use standard PEMDAS without unnecessary parentheses: multiplication and division first, then addition and subtraction, left to right within each precedence level. Answers remain positive whole numbers.

