# Deadlinetracker

Semesters come with a lot of moving parts: five classes, six deadlines each week, and the one you forget is always the one that matters. This app doesn't try to be anything fancy. It's a place to dump your deadlines and see them sorted by urgency so nothing slips through the cracks.

Everything lives in your browser — no account, no server to set up. Open it, add something, close it. Come back later and it's still there.

---

## What it does

**Add assignments.** Give it a name and a due date. That's the form: two fields, one button. No course names, no priority levels, no categories. The app figures out what's urgent on its own.

**See what's burning.** Cards are color-coded by how much time is left:

| Timeframe | Color | What it means |
|-----------|-------|---------------|
| Past due | Red | You're behind |
| 0–2 days | Amber | Burning soon |
| 3–7 days | Sage green | This week |
| 8+ days | Neutral | Future you's problem |

The list sorts by urgency automatically. Overdue items appear first. Completed items sink to the bottom no matter what color they were. You don't have to worry about sorting manually — it's just there when you open the app.

**Track progress.** Toggle assignments as done when you submit them. They fade out and drop to the bottom so your attention stays on what's left. Mark them undone if you need to see them in context again.

**Filter.** Three pills at the top: All, Pending, Completed. Each shows a count. Click one and the grid reflows smoothly — cards slide into their new positions with Framer Motion, nothing jumps around.

**Dark mode.** Picks up your system setting automatically. Works fine after 10pm when you're working in a dark room because that's when students actually use deadline apps.

---

## How it works

### Data storage

All assignment data lives in your browser's localStorage under the key `deadlinetracker_assignments`. Each entry is just:

```json
{
  "id": "abc123",
  "name": "Math Chapter 12",
  "dueDate": "2025-12-15",
  "completed": false,
  "createdAt": 1730000000000
}
```

No network calls. No API keys. Nothing leaves your machine. If you clear your browser data, the assignments go with it — there's no cloud backup by default since this is meant for personal use on one machine. That's a simplification worth knowing: if you want this across devices, add sync later. It's straightforward to bolt on.

### Urgency calculation

Each assignment gets a color based on days remaining from the current date:

```
diff = dueDate - today  (in whole days)

if diff < 0       → overdue (red)
elif diff <= 2    → due soon (amber)
elif diff <= 7    → this week (sage green)
else              → future (neutral)
```

No complex scoring. No weighted priorities by course. A single number — how many days until it's due — is enough for sorting. The tradeoff is honest: if you have three assignments all due next month, they're all the same color and you'll need to open each card to see which is sooner. That's fine for this scope. You can add relative priority later.

### Sorting order

The list is always sorted in two steps: first by urgency group (overdue → soon → this week → future), then by date within each group. Completed items sink to the bottom regardless of when they're due. This means your task list never lies to you — nothing past-due can hide behind a future item.

### Dark mode

Dark mode activates when your OS reports a dark color scheme preference. The app watches for changes mid-session too, so if you toggle it while the app is open, everything updates immediately. The urgency colors shift on dark backgrounds so reds and ambers stay visible — a flat `#C0392B` on black would be unreadable, so each gets a darker variant: `#D94F4F` for urgent, `#E0A040` for warning.

---

## Side by side with similar tools

Most deadline trackers are full-featured calendar apps or Trello boards with extra steps. They sync to the cloud, have kanban views, and require accounts. This does one thing well: tell you what's due next in five seconds flat. It's not trying to replace Google Calendar or Notion — it's for when you just need a quick list that doesn't ask you for an email address.

---

## Tech stack

React + Vite + TypeScript, styled with Tailwind CSS. Framer Motion handles card animations. Fonts are Lora for headings and Nunito Sans for body text — serif for personality, sans for reading. The whole thing is a single static site: `npm run build` spits out plain HTML, CSS, and JS that deploy anywhere.

---

## Getting started locally

### Prerequisites

- Node.js 18 or newer
- npm

### Install and run

```bash
cd week9
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The app hot-reloads as you edit files.

### Build for production

```bash
npm run build
```

Output goes to `dist/`. Serve it with any static file server.

---

## Deployment

### Cloudflare Pages (automatic)

Connect your repo in the [Cloudflare Pages dashboard](https://dash.cloudflare.com/pages):

| Setting | Value |
|---------|-------|
| Build command | `npm run build` |
| Output directory | `dist` |
| Node version | 20+ |

Every push to main auto-deploys.

### Cloudflare Pages (manual)

```bash
npx vite build
wrangler pages deploy dist --project-name deadlinetracker
```

### Vercel, Netlify, GitHub Pages — any of them

Same thing: run `npm run build`, push the `dist/` folder. It's static HTML + CSS + JS. That's all it needs.

---

## Project structure

```
week9/
├── package.json          # Dependencies and scripts
├── vite.config.ts        # Vite build config
├── tailwind.config.ts    # Design tokens: colors, fonts, spacing
├── tsconfig.json         # TypeScript settings
├── postcss.config.mjs    # Tailwind processing
├── index.html            # Entry HTML
├── public/favicon.svg    # App icon
└── src/
    ├── main.tsx          # React entry point, dark mode detection on mount
    ├── App.tsx           # Root layout: state management + sort logic
    ├── index.css         # Base styles, fonts, typography matching Wren spec
    ├── types.ts          # Data types (Assignment, Filter)
    ├── hooks/
    │   └── use-assignments.ts  # localStorage persistence hook
    ├── utils/
    │   └── countdown.ts        # Urgency classification + color mapping
    └── components/
        ├── Navbar.tsx          # Top nav: wordmark + add button
        ├── Hero.tsx            # Landing heading with fade-in
        ├── AddAssignment.tsx   # Form: name input + date picker
        ├── FilterBar.tsx       # All / Pending / Completed pills
        ├── AssignmentGrid.tsx  # Responsive card grid (1→2→3 cols)
        ├── AssignmentCard.tsx  # Urgency color, countdown label, Done toggle
        └── EmptyState.tsx      # Prompt when list is empty
```

Ten source files. You can read every one in under an hour. That's intentional — if you need to change something, you should be able to find where without hunting through abstractions.

---

## Design

The palette leans warm: soft paper background (`#FBF6F2`), sage green as the primary accent (`#5B755B`), blush pink for surfaces (`#F3E7DF`). Cards are rounded at 24px — nothing sharp around here. Headings use a serif font (Lora) to give the app personality, body text stays clean in Nunito Sans.

Respects `prefers-reduced-motion` automatically — if your OS is set to minimize animations, everything stops moving and it looks fine anyway.

---

## Running it

```bash
cd week9
npm install
npm run dev        # Start development server on port 5173
npm run build      # Production build to dist/
npx vite preview   # Preview the production build locally
```

Open the app in your browser. Add a few assignments, try filtering, toggle dark mode by changing your system setting. Clear your browser data to reset everything — there are no seeds or demo data.

---