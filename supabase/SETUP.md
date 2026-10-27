# Supabase setup

Vanguard Arena uses Supabase for optional account/deck sync and for online room discovery and Realtime relay. The browser must contain only the project URL and publishable (or legacy anon) key. Never put a service-role key in the site.

## Online rooms

1. Create a Supabase project and configure its URL and publishable key in the site's Supabase settings.
2. In **Authentication → Sign In / Providers**, enable **Anonymous Sign-Ins**. The match relay creates a separate anonymous session for each player, even when they are not signed into a named account.
3. Run [`match-rooms.sql`](match-rooms.sql) in the Supabase SQL Editor.
4. Run [`match-auth-v1.sql`](match-auth-v1.sql) in the SQL Editor after the base migration.
5. Create a new room and test joining it from a separate browser session. Rooms created before the authenticated-seat migration do not have the required host identity; close those rooms and create new ones.

The room directory exposes room code, room name, and host name, but not the password hash or connection secret. The password-gated resolve function returns the secret connection ID. The authenticated migration binds each player seat to an auth user and limits Realtime publishing to that seat's direction. Spectator messages remain on their separate public topic and must contain redacted snapshots.

## Accounts and saved decks

The account dialog can use the same project URL and publishable key. Configure the project's email/password provider and deploy the account/deck tables and policies required by the account feature before enabling account sync. Account sign-in is optional for local decks and is separate from the anonymous identity used for each online match.

## Authority limitation

The Realtime policies authenticate who may send on each room channel. They do not validate Vanguard actions or own canonical game state. At present, the host browser still validates and applies guest commands. A trusted server reducer, versioned server-owned state, private decision delivery, and server-side replay/concurrency protection are still required before online match actions can be considered authoritative.

`match-authority-v1.sql` contains the next private state/command database boundary, but it has no worker or website cutover yet. Do not apply it as a live-game fix: until a trusted reducer is deployed and both clients submit through it, matches still use the host browser as authority. See the repository's `MATCH_AUTHORITY_SETUP.md` for the staged design and remaining work.

`match-authority-v4.sql` adds the service-only card-definition catalog and transactional deck-to-state verification used by `functions/match-initialize`. The catalog returns only rows explicitly marked `redistribution_authorized`; the tracked Cardfight Area snapshot is marked for personal local use and is not an authorized source for a public server import. The initializer and v4 migration have local tests, but the migration has not been applied to PostgreSQL, no licensed catalog import is configured, and the endpoint is not deployed or connected to the clients.

`match-authority-v5.sql` adds authenticated seat-scoped state and action-result reads. It projects opponent private zones and pending ability/cost prompts away from each player. The local projection and SQL-contract tests pass, but the migration is not applied and neither client reads through these RPCs yet.
