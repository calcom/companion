# Running the iOS app in the Simulator

You can run the app against **production** ([app.cal.com](https://app.cal.com))
or against **your own local Cal.com**. Use production unless you have a reason
not to. This guide covers the iOS Simulator on a Mac, not a physical iPhone.

## Contents

- [Prerequisites](#prerequisites)
- [Run against production (default)](#run-against-production-default)
- [Run against a local Cal.com (optional)](#run-against-a-local-calcom-optional)
- [Things to know](#things-to-know)
- [Switching back to production](#switching-back-to-production)

## Prerequisites

- [ ] **Xcode**, from the Mac App Store. Open it once after installing so it
  can install its extra components, including an iOS Simulator runtime. Use
  an iOS 18.0 or newer runtime. The App Store builds use Xcode 26.2.
- [ ] **CocoaPods** (`brew install cocoapods`). `bun run mobile:ios` runs
  `pod install` for you.
- [ ] **Node.js 20.19.4+ and Bun.** The current React Native and Metro versions
  require Node.js 20.19.4 or newer; Node.js 18 is not sufficient. Run
  `bun install` once at the repo root.
- [ ] **For production mode:** access to `calcoms-organization` on
  [expo.dev](https://expo.dev) (see below).

You don't need Maestro to run the app. It's only for the end-to-end test
flows; see the [Maestro guide](../maestro/README.md), and note that Maestro
also needs Java 17.

Run commands from the Companion repo root unless a step says otherwise.

## Run against production (default)

1. **Get access** to the `calcoms-organization` organization on
   [expo.dev](https://expo.dev), with the **Developer** role or higher. The
   project is `calcom-companion`.
2. **Pull the production environment variables:**

   ```sh
   cd apps/mobile
   npx eas-cli@latest login
   npx eas-cli@latest env:pull --environment production
   ```

   This writes `apps/mobile/.env.local` (gitignored). It holds the same OAuth
   client IDs and redirect URI as the App Store build. Sign-in works from the
   Simulator because the dev build uses the same
   `expo-wxt-app://oauth/callback` redirect.

   Check that these values are present:

   - `EXPO_PUBLIC_CALCOM_OAUTH_CLIENT_ID` — US client ID.
   - `EXPO_PUBLIC_CALCOM_OAUTH_CLIENT_ID_EU` — EU client ID, needed for EU sign-in.
   - `EXPO_PUBLIC_CALCOM_OAUTH_REDIRECT_URI` — `expo-wxt-app://oauth/callback`,
     shared by both regions on native builds.

   If a value comes out empty, copy it from:

   ```sh
   npx eas-cli@latest env:list --environment production --include-sensitive
   ```

   Keep the values in `apps/mobile/.env.local`, not the root `.env`. The root
   `.env.example` documents browser-extension redirects; those are not the
   native app's redirect URI. Never commit env files or paste their contents
   into a PR.
3. **Run the app** from the repo root:

   ```sh
   cd ../..
   bun run mobile:ios   # builds the dev client, installs it in the Simulator and starts Metro
   ```

   After that, `bun run mobile` starts Metro for the already-installed app.
   It does not build or install the native app; use `bun run mobile:ios` for
   the first run or after changes that require rebuilding native code.
4. **Sign in with a test account**, in the US or EU region.

   > **Production is real:** bookings, cancellations, and guest messages send
   > emails to real people. Don't use an account with real customers.

## Run against a local Cal.com (optional)

### 1. Run Cal.com locally

Start both of these from the `calcom/cal` repo (see its
[README](https://github.com/calcom/cal#development)):

- The web app on `http://localhost:3000`.
- API v2 on `http://localhost:5555`.

Start the web app with its URL variables set to `http://localhost:3000`:
`NEXT_PUBLIC_WEBAPP_URL`, `NEXT_PUBLIC_WEBSITE_URL`, and `NEXTAUTH_URL`. If your
`.env` sets `NEXTAUTH_URL_INTERNAL`, set it to
`http://localhost:3000/api/auth`. Otherwise sign-in can fail with
`CLIENT_FETCH_ERROR`, or the authorize page can stay blank.

Check that both are up:

```sh
curl -s localhost:3000/api/auth/providers   # signinUrl must start with http://localhost:3000
curl -s -o /dev/null -w '%{http_code}\n' localhost:5555/v2   # 000 means API v2 isn't reachable
```

### 2. Create an OAuth client on your local Cal.com

1. Sign in at `http://localhost:3000` and open
   [`/settings/developer/oauth`](http://localhost:3000/settings/developer/oauth).
2. Create a client with:
   - **Redirect URI:** `expo-wxt-app://oauth/callback`
   - **PKCE:** on. The app is a public client with no client secret.
   - **Scopes:**

     ```text
     EVENT_TYPE_READ EVENT_TYPE_WRITE BOOKING_READ BOOKING_WRITE PROFILE_READ PROFILE_WRITE SCHEDULE_READ SCHEDULE_WRITE EVENT_READ EVENT_WRITE TEAM_EVENT_READ TEAM_EVENT_WRITE TEAM_PROFILE_READ
     ```

     This is the list in `DEFAULT_CALCOM_OAUTH_SCOPE` in
     [`services/oauthService.ts`](../services/oauthService.ts). Keep it aligned
     with the code: if one is missing, sign-in can fail with
     "No authorization code received".
3. If the client shows as pending, approve it as an admin user at
   [`/settings/admin/oauth`](http://localhost:3000/settings/admin/oauth).
4. Copy the client ID.

### 3. Use the local client ID

In `apps/mobile/.env.local`, set:

```dotenv
EXPO_PUBLIC_CALCOM_OAUTH_CLIENT_ID=<client id from step 2>
EXPO_PUBLIC_CALCOM_OAUTH_REDIRECT_URI=expo-wxt-app://oauth/callback
```

Restart Metro afterwards. The values are baked into the JS bundle when Metro
builds it. Expo reads `.env.local` over `.env`, so keep these values in
`.env.local`.

### 4. Point the US region at localhost (local only, never commit)

In [`apps/mobile/utils/region.ts`](../utils/region.ts), change the US branch
of three functions. EU stays on production.

```diff
 export function getCalAppUrl(region: CalRegion = currentRegion): string {
-  return region === "eu" ? "https://app.cal.eu" : "https://app.cal.com";
+  return region === "eu" ? "https://app.cal.eu" : "http://localhost:3000";
 }

 export function getCalApiUrl(region: CalRegion = currentRegion): string {
-  return region === "eu" ? "https://api.cal.eu" : "https://api.cal.com";
+  return region === "eu" ? "https://api.cal.eu" : "http://localhost:5555";
 }

 export function getCalWebUrl(region: CalRegion = currentRegion): string {
-  return region === "eu" ? "https://cal.eu" : "https://cal.com";
+  return region === "eu" ? "https://cal.eu" : "http://localhost:3000";
 }
```

<details>
<summary>Why are all three changes needed?</summary>

- `getCalAppUrl` handles OAuth sign-in and web app links.
- `getCalApiUrl` handles every API call.
- `getCalWebUrl` handles public pages such as an event's **Preview**. Cal.com
  only redirects after login to its own web app or website origin, so
  production `cal.com` links would land on the dashboard instead.

</details>

### 5. Run the app

From the Companion repo root, run `bun run mobile:ios` (or `bun run mobile`
if the app is already installed). On the login screen, choose **US**.

## Things to know

- **Simulator only.** Inside the iOS Simulator, `localhost` is your Mac. A
  physical iPhone can't reach your Mac through `localhost`. Plain `http://`
  works because dev builds allow local networking.
- **Start the backend first.** Keep both the web app and API v2 running before
  launching the mobile app. If the backend is unavailable, authentication or
  account loading can fail, and you may be signed out.
- **Never commit the `region.ts` change**, and never run a release build with
  it. EAS uploads uncommitted source files too. See the
  [iOS release guide](releasing-ios.md) before building for the App Store.

## Switching back to production

From the Companion repo root, review the local changes first:

```sh
git diff -- apps/mobile/utils/region.ts
```

If the only changes are the localhost overrides, restore the file and pull
the production environment variables again:

```sh
git restore apps/mobile/utils/region.ts
cd apps/mobile
npx eas-cli@latest env:pull --environment production
cd ../..
```

`git restore` discards all uncommitted edits in that file. If you have other
work there, undo only the three localhost overrides instead.

Then restart Metro.
