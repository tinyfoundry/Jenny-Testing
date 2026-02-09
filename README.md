# Family Fun Finder (Static-First)

Family Fun Finder is a static-first family events site for St. Augustine and Jacksonville, Florida. It runs on HTML/CSS/JS, uses JSON as the data layer, and is designed to deploy on GitHub Pages or Vercel.

## Folder structure
```
.
├── data
│   ├── event_schemas.json
│   ├── events_curated.json
│   ├── events_pending.json
│   └── events_raw.json
├── scripts
│   ├── app.js
│   ├── curate_events.js
│   ├── fetch_facebook_events.js
│   ├── moderation.js
│   └── submit.js
├── .github/workflows/weekly-update.yml
├── index.html
├── events.html
├── submit.html
├── about.html
└── styles.css
```

## How it works
1. **Fetch** public event data (mocked for now) into `data/events_raw.json`.
2. **Curate** descriptions, infer category/city, and write pending events to `data/events_pending.json`.
3. **Moderate** pending events manually and approve them into `data/events_curated.json`.
4. **Frontend** reads `events_curated.json` and renders cards with filters, save, and share actions.

## Data model
Each event uses the fields in `data/event_schemas.json`.

## Scripts
### Fetch mocked public events
```bash
node scripts/fetch_facebook_events.js
```

### Curate events (pending only)
```bash
node scripts/curate_events.js
```

### Approve an event
```bash
node scripts/moderation.js approve pending-1
```

## Manual moderation flow
- New events are written to `data/events_pending.json` with `status = "pending"`.
- Review each event and approve with `scripts/moderation.js`.
- Approved events are appended to `data/events_curated.json` with `status = "approved"`.

## Frontend features
- Region toggle (St. Augustine / Jacksonville)
- Full events list with filters (category, age range, keyword search)
- Save events via localStorage
- Share events via Web Share API with clipboard fallback
- Static submission form with a honeypot spam field

## Local development
```bash
python -m http.server 8000
```
Then open `http://localhost:8000`.

## Deploy
- **GitHub Pages**: enable Pages on the repo and point it to the root.
- **Vercel**: import the repo as a static project.
