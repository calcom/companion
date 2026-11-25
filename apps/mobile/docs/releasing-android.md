# Releasing the Android app to Google Play

This guide takes you from "I have never shipped an Android app" to "the new
version is live on Google Play". It covers the Cal.com Companion Android app in
`apps/mobile`. For iOS, see [releasing-ios.md](./releasing-ios.md).

You'll do about an hour of hands-on work, then wait a few hours to 2 days for
Google's review.

## How the pieces fit together

| Name | What it is | What you use it for |
|------|------------|---------------------|
| **Expo / EAS** ([expo.dev](https://expo.dev)) | Expo's cloud service. EAS Build compiles the app on Expo's servers and signs it with Cal.com's upload key. | Building the app file (`.aab`) from your terminal. |
| **Google Play Console** ([play.google.com/console](https://play.google.com/console)) | Google's website for managing the app on Google Play. | Uploading builds, testing, store paperwork, sending for review, publishing. |
| **Internal testing** | A test track in Play Console, the Android counterpart of TestFlight. Testers install the build from the Play Store app. | Installing a build on an Android phone before anyone else gets it. |
| **Production** | The track real users get. | Releasing the version you tested. |

The flow:

1. **Build** the app on EAS from an up-to-date `main`.
2. **Upload** the `.aab` to the Internal testing track. Nothing is public yet.
3. **Test** that exact build on an Android phone through the Play Store.
4. **Promote** that same build to Production and send it for Google's review.
5. **Publish** it once Google approves it.

## Quick reference

| Thing | Value |
|-------|-------|
| Play Console account | Cal.com, Inc. |
| Package name | `com.calcom.companion` |
| Play Console app | https://play.google.com/console/developers/7302107749715755197/app/4976446608528654495/ |
| Expo organization / project | `calcoms-organization` / `calcom-companion` ([builds](https://expo.dev/accounts/calcoms-organization/projects/calcom-companion/builds)) |
| Version number | `version` in `apps/mobile/app.json`, shared with iOS |
| Version code | Set by EAS on every production build (`appVersionSource: remote`, `autoIncrement: true` in `eas.json`) |
| Build settings | `production` profile in `apps/mobile/eas.json`. It produces a signed `.aab` |
| Managed publishing | **On**: approved changes wait until someone clicks **Publish changes** |

Command, run from `apps/mobile` on a clean, up-to-date `main`:

```sh
npx eas-cli@latest build --platform android --profile production
```

Then upload the `.aab` in Play Console by hand (Part 3). `eas submit` can do
the upload instead once a Play admin has set it up; see
[Making uploads automatic](#making-uploads-automatic).

---

## Part 0: Get access (once per person)

1. **A Google account** that you'll use for Play Console. Your work account is
   best.
2. **A seat in the Cal.com, Inc. Play Console account.** Ask an Admin to invite
   you in Play Console → **Users and permissions**. The simplest is admin
   rights for the app. At a minimum you need permission to release to testing
   tracks and to production, to manage tester lists, and to edit the app's
   policy declarations (App content). Accept the email invite, then open
   Play Console and pick **Cal.com, Inc.** if it asks which account.
3. **A seat in the Expo organization.** Same as for iOS: ask an Owner or Admin
   of `calcoms-organization` to invite you with the **Developer** role or
   higher.
4. **Tools on your Mac:** this repo cloned, plus Node.js, so `npx` works.
5. **An Android phone** with the Play Store, signed in with a Google account
   you can add as a tester. No Android phone? Use an emulator; see
   [Testing without an Android phone](#testing-without-an-android-phone).

---

## Part 1: Before you build

1. **Check the version.** `expo.version` in `apps/mobile/app.json` is shared
   with iOS. Android usually ships the same version as iOS, so if iOS already
   released it, don't bump it just for Android. Google only requires the
   **version code** to go up, and EAS handles that.

   Play never accepts the same version code twice, even from a build you
   discarded. EAS stores the last code on its servers and raises it by one on
   every production build, so this only matters if you upload by hand.
2. **Make sure the backend is live.** Google's reviewer uses the real
   app.cal.com. Anything the new features need on the Cal.com side must already
   be in production, including new OAuth scopes on **every** production OAuth
   client (US and EU).
3. **Check the build's environment variables.** Builds use the variables stored
   on expo.dev in the **production** environment. Your local `.env` files are
   never uploaded.

   ```sh
   cd apps/mobile
   npx eas-cli@latest env:list production
   ```

   Android needs the same `EXPO_PUBLIC_CALCOM_*` OAuth variables as iOS, plus
   `GOOGLE_SERVICES_JSON` (the Firebase file for push notifications, stored
   as a secret file).
4. **Note anything Google will ask about:**
   - **New permissions or uploaded data** (camera, photos, microphone…):
     you'll update the Data safety form in Part 5.
   - **New hardware use:** a permission like camera makes Play assume the
     phone *must* have that hardware, and it hides the app from devices
     without it. `apps/mobile/plugins/with-optional-android-features.js`
     marks camera, autofocus, microphone, telephony and Bluetooth as
     optional. If the release uses new hardware, add it there. Part 3, step 7
     shows how to check.
   - **Foreground services:** if the release adds a new foreground service
     type (1.2.0 adds a phone-call service for Cal Video), Play asks for a
     one-time declaration with a short video under App content. See Part 5.

---

## Part 2: Build

1. **Run the Autosana workflow on this commit and wait for it to pass.** The
   workflow builds an emulator copy (`.apk`) of `main` on EAS, uploads it to
   [Autosana](https://autosana.ai) and runs the end-to-end tests in
   `.autosana/` that are labelled `regression` on a cloud Android emulator. On
   GitHub, open **Actions → Autosana → Run workflow**, leave the branch on
   `main`, set **Platforms** to `android` (or `both` if iOS ships too) and
   click **Run workflow**. Or from a terminal:

   ```sh
   gh workflow run autosana.yml --ref main -f platforms=android
   ```

   The job log links to each test's run on Autosana, with a recording. If a
   test fails, fix the bug on a branch, merge it, and run the workflow again
   on the new commit. Don't build a release from a commit that hasn't passed.
   The workflow runs on a branch or tag, so to test an earlier commit, push a
   tag at it and pick that tag instead of `main`.
2. **Start from a clean, up-to-date `main`:**

   ```sh
   cd ~/path/to/companion/apps/mobile
   git switch main
   git pull
   git status
   ```

   `git status` must say `nothing to commit, working tree clean`. EAS uploads
   the files in your folder, **including uncommitted changes**, so a local test
   tweak (for example a `region.ts` pointing at localhost) would ship to Google
   Play. `git log -1` must show the commit the Autosana run passed on. If
   `main` has moved on since, go back to step 1.

   To ship exactly the code of an earlier release (for example the commit iOS
   shipped), build from a separate clean checkout of that commit:

   ```sh
   git worktree add ../companion-release <commit>
   cd ../companion-release && bun install && cd apps/mobile
   ```

3. **Log in to Expo** (once per machine):

   ```sh
   npx eas-cli@latest login
   npx eas-cli@latest whoami
   ```

4. **Build.** This runs on Expo's servers and takes about 20–30 minutes.

   ```sh
   npx eas-cli@latest build --platform android --profile production
   ```

   If it asks to **generate a new Android keystore**, say **no and ask an
   Admin**. EAS already holds Cal.com's upload key, and Play rejects builds
   signed with a different one.

   You can close the terminal once the build starts. Follow it on
   [expo.dev → Builds](https://expo.dev/accounts/calcoms-organization/projects/calcom-companion/builds)
   or with `npx eas-cli@latest build:list --platform android --limit 3`. Check
   that the build shows your version, a new version code and the commit you
   expect.
5. **Download the `.aab`** once the build shows **Finished**: click
   **Download** on the build's page on expo.dev. The file is about 85 MB.

   Or from the terminal, using the build ID from `build:list`:

   ```sh
   npx eas-cli@latest build:view <build id> --json   # check status, appVersion, appBuildVersion, gitCommitHash
   curl -L -o ~/Downloads/companion-android.aab \
     "$(npx eas-cli@latest build:view <build id> --json | jq -r '.artifacts.applicationArchiveUrl')"
   ```

---

## Part 3: Upload to Internal testing

All in Play Console → **Cal.com Companion** → **Test and release** →
**Testing** → **Internal testing**.

1. **Add testers** (once): open the **Testers** tab and click **Create email
   list**. Name it (for example "Cal team"), add the Google accounts of the
   people testing, and click **Save changes**. Back on the Testers tab, make
   sure the list is ticked, then click **Save**.
2. Under **How testers join your test**, find **Join on the web** and click
   **Copy link**. You'll open it on the phone in Part 4.
3. Open the **Releases** tab and click **Create new release**.
4. Under **App bundles**, click **Upload** and pick the `.aab`. Wait for it to
   process. The release name fills in as `<version code> (<version>)`, for
   example **41 (1.1.0)**.
5. **Release notes:** replace the text between the `<en-US>` tags with a short
   line. Testers see it in the Play Store.
6. Click **Next**. The page lists errors and warnings:
   - **"This App Bundle contains Java/Kotlin code, which might be obfuscated"**
     (no deobfuscation file): ignore it. The app isn't obfuscated, and every
     release has shown it.
   - **Errors** block you. See [Troubleshooting](#troubleshooting).
7. **Check the devices.** Under **Changes to your supported devices**, every row
   must show **0** devices no longer supported. If it shows a number, the build
   declares some hardware as required (see Part 1, step 4). Don't ship it to
   Production like that: those devices would be stuck on the old version.
   Clicking the arrow on the bundle's **Required features** shows which ones.
8. Click **Save and publish**, then confirm. If it only offers **Save**, that's
   managed publishing: open **Publishing overview** in the left sidebar and
   click **Send changes for review**. Internal testing usually goes through
   within minutes, without a full review.

---

## Part 4: Test on a phone

1. **Join the test.** Open the **Join on the web** link (Part 3, step 2) while
   signed in with a tester's Google account, and click **Accept**. You can do
   this on a computer; the phone just needs the same Google account.
2. **Install.** On the phone, open the link's **Download it on Google Play**
   button, or find Cal.com Companion in the Play Store, and tap **Install**
   or **Update**.
   - The first install right after joining can still be the old version. Wait
     10–15 minutes and update again.
   - To check which build you have: Play Store → Cal.com Companion → **About
     this app** → **Version**.
3. **Test the release** with real production accounts:
   - Sign in with the **US** and the **EU** region on the login screen.
   - Try every new feature, especially anything that uploads data or asks for a
     permission.
4. **Found a bug?** Fix it on a branch, merge to `main` (keep the same
   `version`), and repeat Parts 2 and 3. Create a new Internal testing release
   with the new `.aab`. Testers get it as a normal update.

**Letting a teammate test:** add their Google account to the email list (Part 3,
step 1) and send them the join link.

---

## Part 5: Store paperwork (App content)

Play Console → **Policy and programs** → **App content**. Google reviews these
together with the release, so update them before Part 6.

1. **Data safety** (only if the release collects new data). Click **Manage**,
   keep every existing answer and click **Next** until you reach the data
   types. Tick the new type and answer its questions. For example, 1.1.0 added
   **Photos and videos → Photos** for event cover and speaker photos:
   - **Collected:** Yes. **Shared:** No.
   - **Processed ephemerally:** No.
   - **Required or optional:** Optional (users choose).
   - **Purpose:** App functionality.

   Then **Next** to the end and **Save**. Data that never leaves the phone,
   such as QR codes scanned for check-in, isn't declared.
2. **Sign in details** (called **App access** in older screens). The app is
   useless without a Cal.com login, so Google's reviewer signs in with the
   account listed here. Use the same demo account as the App Store review.
   The credentials live **only here and in App Store Connect**; never commit
   them to the repo. The account must:
   - be a real account on the production **app.cal.com** (US region);
   - have two-factor login **off**;
   - contain some sample data for the new features.

   Check that the password still works. You don't need to change anything if
   it does.
3. **Foreground service permissions** (only when Part 1, step 4 applies). For
   each service type, say what it's for (Cal Video calls, screen sharing) and
   link a short screen recording of the feature in use.
4. Fix anything else the page flags.

---

## Part 6: Promote to Production and send for review

1. Go to **Internal testing** → **Releases** tab. On the release you tested,
   click **Promote release** → **Production**.
2. **Check the app bundle.** It must be the exact version code you tested. If an
   older bundle is listed too, remove it with the **⋮** menu.
3. **Release name:** make it match the bundle, for example **41 (1.1.0)**.
4. **Release notes:** these are **public**, shown under "What's new" on Google
   Play. Write them for users and keep them short. For example:
   *"New: Events. Create, edit and publish events from the app, add cover
   photos, and check guests in by scanning their QR tickets."*
5. Click **Next**. Expect the same review page as in Part 3: only the
   deobfuscation warning, and 0 devices dropped.
6. **Rollout:** choose a percentage, or **full rollout**.
   - A **staged rollout** (for example 20%) sends the update to that share of
     users first. If crashes show up you can stop it, and fewer people are
     affected.
   - A **full rollout** sends it to everyone once you publish.
7. Click **Save**.
8. Open **Publishing overview** in the left sidebar. **Changes not yet sent for
   review** lists the Production release plus any App content changes from
   Part 5. Check that list, then click **Send changes for review** and confirm.
9. Google usually finishes within a few hours to 2 days, and emails you.
   **While you wait**, don't change the reviewer account's password, and don't
   click **Remove changes**: that pulls the submission back and the review
   starts over.

---

## Part 7: Publish

1. Once Google approves, the changes move to **Publishing overview → Changes
   ready to publish**.
2. Click **Publish changes** and confirm. Managed publishing means nothing goes
   live before this click, the same as "Manually release this version" on iOS.
   The page then says **Last published on** today's date.
3. The store listing updates within an hour or so, sometimes a few hours.
   Existing users get the update automatically over the next day. To check,
   open Cal.com Companion on Google Play and look under **About this app**.
4. **Watch Android vitals** (left sidebar, **Monitor and improve** → **Android
   vitals**) for a day or two: crash and ANR rates.
5. **Staged rollout:** if you chose a percentage, raise it in **Production** →
   **Releases** → **Manage rollout** → **Update rollout** once vitals look
   fine. To stop a bad rollout, use **Manage rollout** → **Halt rollout**.
   Phones that already updated keep the new version.

---

## Making uploads automatic

EAS has a Google service account for uploading,
`play-console-service-account@calcom-companion.iam.gserviceaccount.com`, but
it has no Play Console permissions, so `eas submit` fails with
`SERVICE_ACCOUNT_IS_MISSING_PERMISSIONS`. A Play Console admin can fix that
once:

1. Play Console → **Users and permissions** → **Invite new users**.
2. **Email address:** the service account above.
3. **App permissions** → **Add app** → **Cal.com Companion** → **Apply**. Tick
   **Release apps to testing tracks**. Add **Release to production, exclude
   devices, and use Play App Signing** only if production releases should also
   be possible from the terminal.
4. **Apply**, then **Invite user**. The account doesn't need to accept; the
   change can take a few hours to apply.

After that, this replaces the manual upload in Part 3, steps 3–8:

```sh
npx eas-cli@latest submit --platform android --latest
```

It puts the build on Internal testing. Promoting to Production (Part 6) stays
in Play Console.

---

## Testing without an Android phone

Use an Android emulator with the Play Store. It installs the Internal testing
build from the Play Store, just like a phone.

1. Install [Android Studio](https://developer.android.com/studio) and open
   **Device Manager**.
2. Create a device, for example a Pixel, with a system image that shows the
   **Play Store** icon. Plain "Google APIs" images have no Play Store.
3. Start it, open the Play Store and sign in with your tester Google account.
4. Accept the join link in a desktop browser (Part 4, step 1), then install
   from the Play Store in the emulator.

The emulator's camera can use your Mac's webcam, which is enough for a rough QR
check-in test. Push notifications and phone calls are better checked on a real
phone.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| **"Version code X has already been used"** | Play already has a bundle with that code, even if its release was discarded. If you uploaded the same file twice, ignore it. Otherwise build again; EAS raises the code. |
| Review page says the release **no longer supports N devices** | A permission makes Play treat some hardware as required. Add it to `plugins/with-optional-android-features.js`, rebuild, and upload the new bundle. See Part 3, step 7. |
| Warning about a **deobfuscation file** | Ignore it. The app isn't obfuscated. |
| The release page offers **Save** but not **Save and publish** | Managed publishing is on. Open **Publishing overview** and send the changes for review. |
| The phone installs the old version after joining the test | Wait 10–15 minutes, then update in the Play Store. |
| Accepting the join link loops on "Verify it's you" (seen in an emulator's Chrome) | Accept the link in a desktop browser with the same Google account instead. |
| `eas submit` fails with `SERVICE_ACCOUNT_IS_MISSING_PERMISSIONS` | The service account has no Play permissions yet. Upload by hand, or see [Making uploads automatic](#making-uploads-automatic). |
| EAS asks to **generate a new keystore** | Say no and ask an Admin. EAS already holds the upload key. |
| Review rejected for **app access** | The reviewer couldn't sign in. Check the account in **Sign in details**: password, two-factor off, US region. |
| **"Declare your trader status"** banner | Only the Play Console account owner can do this. It doesn't block releases, but Google removes the app if it's not done by the deadline. |
| You want to undo a release that's live | You can't roll back. Halt the rollout if it's staged, then ship a fix with a higher version code. |
