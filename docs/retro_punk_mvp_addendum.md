# Retro-punk future theme addendum (MVP)

This addendum introduces presentation-focused implementation details while preserving game mechanics.

## Delivered MVP scope

- **Theme tokens + CRT style layer** via `src/theme/theme.ts` and `src/theme/theme.css`.
- **Message key catalog** through `src/i18n/messageCatalog.ts` to avoid hardcoded display copy in server events.
- **Accessibility toggles** (`high contrast`, `CRT effects`) in `src/accessibility/uiPreferences.ts`.
- **Interactive React + Vite UI shell** in `src/App.tsx` with:
  1. Boot / login messaging sequence
  2. Match lobby link status
  3. Command console with message-key-driven broadcast log
  4. Simulated reconnect flicker behavior
- **Data model extensions** in `db/migrations/20260217_match_theme_and_event_log.sql`:
  - `matches.aesthetic` (default `retro_punk_future`)
  - `matches.ruleset_version` (default `mvp_v1`)
  - `match_events.message_key`
  - `match_events.message_params`

## Notes

- Existing backend resource names can remain unchanged while UI labels present themed terms (e.g., Scrap/Circuitry/Fuel).
- Flicker effects are intentionally sparse and optional, and can be disabled entirely.
