-- Retro-punk future MVP addendum
-- Adds match-level skin/ruleset metadata and message key based event formatting.

alter table if exists public.matches
  add column if not exists aesthetic text not null default 'retro_punk_future',
  add column if not exists ruleset_version text not null default 'mvp_v1';

comment on column public.matches.aesthetic is
  'Client-facing skin identifier. Defaults to retro_punk_future for MVP.';
comment on column public.matches.ruleset_version is
  'Gameplay/ruleset identifier for seasonal iterations.';

alter table if exists public.match_events
  add column if not exists message_key text,
  add column if not exists message_params jsonb not null default '{}'::jsonb;

comment on column public.match_events.message_key is
  'Stable event i18n key (e.g. build.complete) consumed by UI catalog.';
comment on column public.match_events.message_params is
  'Structured params used for interpolation by client renderers.';
