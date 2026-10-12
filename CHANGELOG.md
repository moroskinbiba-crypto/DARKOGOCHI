# TRAUMAGOCHI — development notes

## New progression and quality-of-life systems

- Added Chronicles with a daily vow, a permanent achievement collection, and a memory-upgrade tree.
- Each vow rotates daily and rewards resources when completed. Progress and claim status persist in the save.
- Achievements award resources once and use lifetime counters that survive rebirths.
- Death grants memory shards once per life; shards and permanent upgrades survive rebirth.
- Added five permanent upgrades for slower hunger/spirit decay, reduced exhaustion damage, better ritual odds, and a safer darkness threshold.
- Added evolution progress and a dynamic mood hint below the pet stage.
- Made resonance timing slower and more humanly playable.
- Rebalanced passive survival decay so the early form can realistically reach its first evolution without changing the existing evolution requirements.
- Added periodic autosave and immediate saving for care/shop actions. Old saves keep the existing `traumagochi_state` key and migrate to defaults for new fields.
- Offline simulation uses the same per-minute survival function as the live game, keeping the rules consistent.

## Verification

Run `node tests/validate.mjs` from the repository root. It compiles the inline game code and tests legacy migration, decay math, achievements, daily-vow rewards, memory upgrades, one-time death rewards, and reincarnation persistence.


## Offline timing correction

- Separated the last simulated game tick from the last autosave timestamp. Frequent autosaves no longer reset the offline simulation window.
- Delayed live timers catch up elapsed minute ticks, with the same one-day cap as offline catch-up.
- Migrated older saves that do not have a simulation timestamp, then immediately persisted offline progress to prevent re-awarding it after a quick reload.
- Added a regression test simulating four minutes offline despite autosaves.


## UX, accessibility and resilience audit

- Constrained the game shell to a centered, phone-like width on desktop while keeping the dark gothic theme and adapting the layout to short screens.
- Removed the zoom lock, added visible keyboard focus, keyboard activation for the pet, reduced-motion support, dialog labels, and screen-reader announcements.
- Added an explicit way to abandon Resonance and support Escape to close interruptible dialogs.
- Fixed an invalid dead-pet CSS filter and made offline catch-up summaries match the time actually simulated, including the one-day cap.
- Stopped autosaving after death and restarted the autosave timer after rebirth instead of leaving a needless interval running.
- Added recovery messaging for corrupted or blocked browser storage and expanded regression checks for these cases and accessibility basics.
