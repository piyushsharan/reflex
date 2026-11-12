# REFLEX — Reaction Training Lab

A browser-based reaction-time tester and mini-game training dashboard.

## Features
- Randomized visual reaction test (1–5 second delay)
- Five-round reaction test session and false-start detection
- Average, personal best, test count, recent results and training streak
- Local reaction history with charts and CSV export
- Five trainer games: Target Rush, Pattern Memory, Go / No-Go, Focus Finder and Moving Target
- Saved trainer-game scores with accuracy, date and time in the Trainer games page
- Safe game switching: closing a game cancels its pending timers before another game opens
- Sound and reduced-motion settings
- Responsive dark interface

## Run locally
No build tools or dependencies are required for the website.

1. Download or clone this repository.
2. Open `index.html` in a modern browser.

For a local development server, use the VS Code Live Server extension, or run:

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000`.

## Developer toolkit: Python + TypeScript

The site stays a lightweight, dependency-free JavaScript app so GitHub Pages can serve it directly. The repository also includes:

- **Python**: offline CSV analysis for average, median, best, slowest, standard deviation, 90th percentile and recent-vs-earlier trend.
- **TypeScript**: dependency-free typed analytics primitives in `src/analytics.ts`, ready for incremental integration.

### Python analytics

Export reaction history from the Analysis page, then run:

```bash
python tools/analyze_reaction.py reflex-reaction-history.csv
python tools/analyze_reaction.py reflex-reaction-history.csv --json
```

Run unit tests from the repository root:

```bash
python -m unittest discover -s tests
```

Python analysis runs locally and does not upload your results. The TypeScript module is source code at this stage; it does not add a build step or affect the deployed website.

## Update the existing GitHub Pages site
1. Download and extract the latest REFLEX project ZIP.
2. Open your GitHub repository and choose **Add file → Upload files**.
3. Upload/replace `index.html`, `styles.css`, `app.js`, and `README.md` from the `REFLEX` folder. Make sure the files are placed in the repository root, not inside an extra `REFLEX` folder.
4. Commit the changes to the `main` branch.
5. GitHub Pages should redeploy automatically. Refresh the published website after the deployment finishes; if an old version remains, do a hard refresh (`Ctrl + Shift + R`).

## Data and privacy
Reaction and game history is stored in this browser's `localStorage`. There is no login, server, or cloud sync. The same browser profile on the same device will normally retain its history. Clearing browser site data may erase it. Different devices or browsers have separate histories. Use the reaction-history CSV export in Analysis to keep a backup.

## Measurement note
Reaction times use the browser's high-resolution `performance.now()` clock. Real-world measurements are influenced by display refresh, input device, browser scheduling, and system load. Use the same device and setup when comparing results. The reference ranges are illustrative, not a medical or clinical assessment.

## Project structure
- `index.html` — page structure and content
- `styles.css` — visual design and responsive layout
- `app.js` — test logic, games, local data, charts and settings
- `tools/analyze_reaction.py` — offline Python CSV analytics CLI
- `src/analytics.ts` — typed TypeScript analytics primitives
- `tests/test_analytics.py` — Python analytics unit tests
