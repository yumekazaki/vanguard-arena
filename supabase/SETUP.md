# Enable player accounts, profiles, and cloud decks

Vanguard Arena is a static GitHub Pages site, so it needs a separate service for accounts and shared deck storage. Supabase's free plan is enough for a small friend group, but it has quotas and can pause a project after a week of inactivity. The card images stay on GitHub Pages; deck names, card IDs/counts, account IDs, and profile names are stored in Supabase.

## 1. Create a Supabase project

Create a free project in the [Supabase dashboard](https://supabase.com/dashboard). Keep its database password private; Vanguard Arena does not need it.

## 2. Create the player data tables

In the Supabase dashboard, open **SQL Editor**, create a query, paste all of [`player-decks.sql`](player-decks.sql), and run it. This creates a private deck table and a public player profile table. Players can only change their own profile and decks; usernames and bios can be read by site visitors. Do not disable Row Level Security.

## 3. Add the public client settings

Open the project's **Connect** dialog or **Project Settings → API Keys** and copy the project URL and the **publishable** key (the older `anon` public key also works). In `assets/cloud-config.js`, replace the two empty strings:

```js
window.VANGUARD_CLOUD_CONFIG = {
  url: "https://YOUR-PROJECT-REF.supabase.co",
  publishableKey: "sb_publishable_..."
};
```

These browser values are public by design. Never use a `service_role`, secret, or database password in this file.

## 4. Allow the live site's email links

In **Authentication → URL Configuration**, set the Site URL to:

```text
https://yumekazaki.github.io/vanguard-arena/
```

Add this Redirect URL too:

```text
https://yumekazaki.github.io/vanguard-arena/**
```

Leave email confirmation enabled. Players create an account with their email and password, confirm through the email Supabase sends, and then sign in. The default email sender has a low rate limit, so configure your own SMTP sender if the group outgrows the trial email quota.

## 5. Publish the configuration

Save `assets/cloud-config.js`, commit the change, and push it to the existing `main` branch. After GitHub Pages finishes deploying, the **Account** button will support account creation, sign-in, password reset, player profiles, and per-account cloud deck sync. Signed-in players can save a unique username, display name, and short public bio. Existing browser-only decks stay local until **Import browser-saved decks** is pressed while signed in.

Supabase Free currently includes 50,000 monthly active users, a 500 MB database, and 5 GB egress; free projects pause after one week of inactivity. Limits can change, so check [current pricing](https://supabase.com/pricing) before relying on it for a larger public community.

## 6. Enable password-protected room discovery

In the same Supabase SQL Editor, run [`match-rooms.sql`](match-rooms.sql). This creates the public room directory RPCs. Room passwords are stored only as salted hashes; the directory listing shows room names, host names, and short room codes. Players enter the password and choose Player or Spectator before the site returns the private PeerJS connection ID. Rooms expire from the listing after ten minutes without a host heartbeat and are removed when the host ends the match.
