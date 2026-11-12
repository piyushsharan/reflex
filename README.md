# REFLEX — Reaction Training Lab

A browser-based reaction-time tester and mini-game training dashboard.

## Features in this first release
- Randomized visual reaction test (1–5 second delay)
- Five-round reaction test session and false-start detection
- Average, personal best, test count, recent results and training streak
- Local history with charts and CSV export
- Target Rush, Pattern Memory, Go / No-Go, Focus Finder and Moving Target
- Sound and reduced-motion settings
- Responsive dark interface inspired by the supplied dashboard reference

## Run locally
No build tools or dependencies are required.

1. Download or clone this repository.
2. Open `index.html` in a modern browser.

For a local development server, you can use the VS Code Live Server extension, or run:
```bash
python -m http.server 8000
```
Then visit `http://localhost:8000`.

## Publish with GitHub Pages
1. Upload `index.html`, `styles.css`, `app.js`, and `README.md` to the root of your GitHub repository.
2. Open the repository's **Settings** tab.
3. Select **Pages** in the left sidebar.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select branch `main` and folder `/ (root)`, then click **Save**.
6. Wait for GitHub Pages to publish. The URL will be shown in the Pages section.

## Data and privacy
Reaction and game history is stored in the browser's `localStorage`. This version has no login, server, analytics, or cloud sync. Clearing browser site data may erase the history. Use the CSV export in Analysis to keep a copy.

## Measurement note
Reaction times use the browser's high-resolution `performance.now()` clock. Real-world measurements are influenced by display refresh, input device, browser scheduling, and system load. Use the same device and setup when comparing your results. The reference ranges are illustrative, not a medical or clinical assessment.

## Project structure
- `index.html` — page structure and content
- `styles.css` — visual design and responsive layout
- `app.js` — test logic, games, local data, charts and settings
