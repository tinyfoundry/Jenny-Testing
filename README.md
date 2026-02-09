# Family Fun Finder (Static Site)

A clean, front-end-only website for family event discovery in St. Augustine and Jacksonville.

## Pages
- `index.html` — Family Fun Finder: St. Augustine
- `jacksonville.html` — Family Fun Finder: Jacksonville

## Quick customization
### Add an event
1. Open the city page (`index.html` or `jacksonville.html`).
2. Copy an `.event-card` block inside the `#event-grid` section.
3. Update the date, title, time, location, and description.
4. Add optional search keywords in `data-tags`.

### Add or update an ad
1. Find the `Community Partners` section.
2. Replace the text in an `.ad-card`.

### Update colors
Edit the CSS variables in `styles.css` under `:root`.

## Run locally
```bash
python -m http.server 8000
```
Then open `http://localhost:8000` in your browser.

## Deploy
- **Vercel**: Drag-and-drop the folder or connect a repo.
- **GitHub Pages**: Commit the files and enable Pages for the repository.
