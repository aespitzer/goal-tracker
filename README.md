# Stitch

A small goal tracker. Check in once a day, watch the cloth fill in, review once a week.

Open it at **https://aespitzer.github.io/goal-tracker/**

## How it works

- **Today**: one row per goal. Tap +15 / +30 / +60 (or +1, or "Mark done") to log effort. Add a note if something's worth remembering.
- **Progress**: the cloth (one square per day, darker when more goals got attention), running totals per goal, and counts of bets that worked and dead ends.
- **Goals**: each goal has one current bet, the single thing you're trying next. When it's finished, mark it "It worked" or "Dead end" and set the next one. Dead ends are kept with what you learned. Milestones (outcomes) go here too.
- **Broad goals and links**: a goal can have no daily check-in ("Improve how I look"). Link narrower goals to it as "part of" (a goal can be part of several), and its progress becomes the activity of everything linked under it. "Related to" links connect goals without rolling up. The Goals page shows the whole map.
- **One-time goals**: tracked as "One time" and marked complete once, on Today or from the goal's page with any past date. Completing one logs that day, so broader goals it's part of get credit. Any goal can be marked complete; finished goals move to a Completed section.
- **Colors**: on Automatic (the default), a goal takes the color of the goal it's part of, so clusters share a color. Pick a swatch to override.
- **Link suggestions (Jev)**: optional. When you add a goal, a GitHub Action in the data repo asks Jev how it relates to your other goals and writes `suggestions.json`; Stitch lists them on the Goals page to add or dismiss. Setup steps are in Settings. The Jev key lives only in the data repo's Actions secrets.
- **Review**: three questions each week, plus a parking lot for ideas about this app. One idea gets built per month, once you've checked in on 20 of the last 30 days.

Empty days show as unfilled stitching, never red. After a long gap, the app asks for a review first and doesn't ask you to fill in the missed days.

## Syncing between devices

Data lives in a private repo (`aespitzer/goal-tracker-data`) as `data.json`. This repo only holds the app, so nothing personal is public.

On each device, open Settings (gear icon) and paste a GitHub fine-grained token:

1. GitHub → Settings → Developer settings → Fine-grained tokens → [Generate new token](https://github.com/settings/personal-access-tokens/new)
2. Repository access: **Only select repositories** → `goal-tracker-data`
3. Permissions → Repository permissions → **Contents: Read and write**
4. Generate, copy, paste into Stitch. Username `aespitzer`, data repo `goal-tracker-data`.

The token is stored only in that browser. Changes save on the device first and sync a few seconds later. Edits from two devices merge record by record, newest wins.

To add it to your phone's home screen: open the link in Safari or Chrome, then Share → Add to Home Screen.

## Files

Everything is in `index.html` (no build step). `manifest.webmanifest` and the icons are for the home-screen install.
