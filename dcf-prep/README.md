# DCF Exam Prep v1 (Static Frontend)

This folder contains a static, GitHub/Vercel-friendly DCF exam-prep app built from uploaded source PDFs only.

## What is included

- `data/content-map.json` — normalized Domain → Topic → Subtopic → Learning Objectives map.
- `data/question-bank.json` — question engine source (MCQ, multi-select, scenario, true/false, ordering).
- `index.html`, `styles.css`, `app.js` — complete static frontend.

## How content was derived

1. Source PDFs were parsed from uploaded files only.
2. Repeated module key points were used to identify domains and high-frequency exam concepts.
3. Learning objectives and questions were synthesized from those key points.
4. Ambiguous extracted text was flagged in `content-map.json` under `ambiguity_notes`.

## Modes implemented

- **Practice Mode**: topic/domain filtering + immediate rationale and option-by-option feedback.
- **Exam Mode**: mini and full timed exams, weighted domain randomization, delayed feedback.
- **Adaptive Mode**: weak-domain resurfacing and difficulty-leaning selection without ML.

## Progress tracking (local-only)

Stored in `localStorage` key: `dcfPrepV1`.

Tracked fields:
- Completed modules
- Domain accuracy
- Weak domains
- Exam history
- Cumulative readiness and pass-likelihood estimates

The storage structure is in `app.js` and can be migrated to a backend later.

## How to add new source documents

1. Add new PDFs to the repo.
2. Re-run your extraction workflow.
3. Update `data/content-map.json` with new domains/topics/objectives.
4. Add or revise entries in `data/question-bank.json` with references to new source logic.

## How to expand the question bank

For each new question include:
- `type`
- `difficulty`
- `domain/topic/subtopic`
- `prompt/choices/correctAnswers`
- `explanation`
- `whyWrong`

## Run locally

From repository root:

```bash
python3 -m http.server 8000
```

Open:

- `http://localhost:8000/dcf-prep/`

## Deploy as static site

- **GitHub Pages**: publish root, then browse `/dcf-prep/`.
- **Vercel**: import repo, no build step required for this folder.

