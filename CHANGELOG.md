# Changelog

All notable changes to the **Jovaltus** Hermes plugin are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## v0.3.0 — 2026-07-11

### Added

- **State management** (`~/.hermes/jovaltus_state.json`) — JSON file tracking installation mode (Skills only vs Skills + SOUL.md) and last updated timestamp per profile
- **CLI: `status`** — shows Jovaltus installation status for the jovaltus-agent profile
- **Interactive prompts** (`_prompt_yes_no()`) with TTY detection — falls back to defaults in non-interactive environments
- **Profile sync on `update`** — after pulling latest code, refreshes SOUL.md and timestamps for tracked profiles, even when already up to date (handles state drift)
- **Stale skill detection** — compares `~/.hermes/skills/` against bundled skills after update, interactively removes orphaned skills
- **TypedDict return types** in `git_utils.py` — `FetchResult`, `AheadBehind`, `PullResult`, `CommitResult`
- **`_is_skill_dir()` helper** — factorised directory check pattern
- **`_get_bundled_skill_names()`** — scan bundled skills
- **`_remove_installed_skill()` / `_remove_stale_skills()`** — stale skill cleanup workflow

### Changed

- `setup` now uses interactive prompts for skill and SOUL.md installation (defaults: skills=yes, SOUL.md=yes, overwrite=no)
- `setup` persists installation state to `~/.hermes/jovaltus_state.json`
- `update` now re-applies SOUL.md for tracked profiles, removes stale skills, and refreshes all bundled skills
- `update` refreshes skills and SOUL.md even when already up to date (fixes state drift)
- `_install_bundled_skill()` renamed to `_install_bundled_skills()` — handles multiple bundled skills
- `git_utils.py` return types migrated to TypedDict for better type safety

### Added (tests)

- 8 new tests covering state management (load/save/set), profile sync (SOUL.md, skills-only, missing profiles), and stale skill detection

---

## v0.2.0 — 2026-07-09

### Added

- Profile + SOUL.md setup via `hermes jovaltus setup`
- Update checking via `hermes jovaltus update --check`/`hermes jovaltus update`
- Git utilities for remote operations (fetch, pull, ahead/behind check)
- Bundled skill registration

---

## v0.1.0 — 2026-07-09

Initial release. Jovaltus Agent Mode — automated development pipeline (Plan → Implement → Verify → Simplify) as a Hermes plugin.
