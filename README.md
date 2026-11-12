# REFLEX

A reaction-time tester and browser-based training games.

## What it includes

- Reaction test with a random wait before the signal
- Five-round test sessions and false-start detection
- Average and best reaction times
- Reaction history, charts and CSV export
- Five games: Target Rush, Pattern Memory, Go / No-Go, Focus Finder and Moving Target
- Saved game scores
- Sound and reduced-motion settings

## Run it

The project uses plain HTML, CSS and JavaScript. It has no package installation or build step.

1. Clone or download the repository.
2. Open `index.html` in a browser.

To run it from a local server, use:

```bash
python -m http.server 8000
```

Then open http://localhost:8000.

## Where data is stored

Test results and game scores are saved in the browser's local storage. They are not synced to an account or sent to a server. Clearing the browser's site data will remove them, so export your reaction history from the Analysis page if you want a backup.

## Files

- `index.html` — page layout
- `styles.css` — styles and responsive layout
- `app.js` — reaction test, games, navigation and data handling

## About reaction-time results

Results can vary with the screen's refresh rate, mouse or keyboard, browser and system load. Compare sessions using the same device and setup. REFLEX is for practice and general tracking, not a clinical measurement.
