# Releasing the Android app to Google Play

This guide takes you from "I have never shipped an Android app" to "the new
version is live on Google Play". It covers the Cal.com Companion Android app in
`apps/mobile`. For iOS, see [releasing-ios.md](./releasing-ios.md).

You'll do about an hour of hands-on work, then wait a few hours to 2 days for
Google's review.

## How the pieces fit together

| Name | What it is | What you use it for |
|------|------------|---------------------|
| **Expo / EAS** ([expo.dev](https://expo.dev)) | Expo's cloud service. EAS Build compiles the app on Expo's servers and signs it with Cal.com's upload key; EAS Submit uploads it to Google Play. | Building the app file (`.aab`) and uploading it. The Autosana workflow does both for you; the terminal is the fallback. |
| **Google Play Console** ([play.google.com/console](https://play.google.com/console)) | Google's website for managing the app on Google Play. | Uploading builds, testing, store paperwork, sending for review, publishing. |
| **Internal testing** | A test track in Play Console, the Android counterpart of TestFlight. Testers install the build from the Play Store app. | Installing a build on an Android phone before anyone else gets it. |
| **Production** | The track real users get. | Releasing the version you tested. |

The flow:

1. **Check** an up-to-date `main` with the Autosana end-to-end tests.
2. **Build** the app on EAS from that same commit, once the tests pass.
3. **Upload** the `.aab` to the Internal testing track. Nothing is public yet.

   One run of the Autosana workflow with **publish** ticked does steps 1–3.
4. **Test** that exact build on an Android phone through the Play Store.
5. **Promote** that same build to Production and send it for Google's review.
6. **Publish** it once Google approves it.

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
| End-to-end tests | **Autosana** workflow in GitHub Actions; the tests are in `.autosana/` |

Test, build and upload to Internal testing in one run:

```sh
gh workflow run autosana.yml --ref main -f platforms=android -f publish=true
```

Fallback if the publish job can't run, from `apps/mobile` on a clean,
up-to-date `main`, after an Autosana run without **publish** has passed:

```sh
gh workflow run autosana.yml --ref main -f platforms=android
npx eas-cli@latest build --platform android --profile production
npx eas-cli@latest submit --platform android --latest
```

If `eas submit` fails too, upload the `.aab` in Play Console by hand
([Part 3 fallback](#fallback-upload-by-hand)).

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
4. **Write access to the `calcom/companion` GitHub repo**, so you can run the
   Autosana workflow.
5. **Tools on your Mac:** this repo cloned, plus Node.js, so `npx` works. You
   only need them for the fallbacks in Parts 2 and 3.
6. **An Android phone** with the Play Store, signed in with a Google account
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
     optional. If the release uses new hardware, add it there. Part 6, step 5
     shows how to check.
   - **Foreground services:** if the release adds a new foreground service
     type (1.2.0 adds a phone-call service for Cal Video), Play asks for a
     one-time declaration with a short video under App content. See Part 5.

---

## Part 2: Test, build and upload

1. **Run the Autosana workflow on `main` with publish ticked.** On GitHub, open
   **Actions → Autosana → Run workflow**, leave the branch on `main`, set
   **Platforms** to `android` (or `both` if iOS ships too), tick **publish**
   and click **Run workflow**. Or from a terminal:

   ```sh
   gh workflow run autosana.yml --ref main -f platforms=android -f publish=true
   ```

   The run does three things, one after the other:
   - **Build** an emulator copy (`.apk`) of the commit on EAS.
   - **Test** it: it uploads the copy to [Autosana](https://autosana.ai) and runs
     the end-to-end tests in `.autosana/` that are labelled `regression` on a
     cloud Android emulator. The job log links to each test's run on Autosana,
     with a recording.
   - **Publish**, only if every test job in the run passed: it builds the same
     commit with the `production` profile (the version code goes up by one)
     and uploads the `.aab` to the **Internal testing** track. Only the
     platforms tested in this run are published. Nothing goes to Production.

   The whole run takes about an hour. If a test fails, nothing is published:
   fix the bug on a branch, merge it, and run the workflow again on the new
   commit.

   With **publish** ticked, the run first checks, in seconds, that it was
   started on `main` and that **Labels** include `regression` (the default),
   so it never publishes after only the smoke tests. If either check fails,
   it stops before any build or test. When iOS is in the run too, it also
   checks the iOS version (see the iOS guide).

   To ship an earlier commit (for example the commit iOS shipped), push a tag
   at it and run the workflow on that tag **without** publish, because publish
   only runs from `main`. Once the tests pass, build and upload that commit
   with the [fallback](#fallback-build-from-your-terminal).
2. **Check the publish job's summary.** Open the run on GitHub and scroll to
   **Publish android** in the summary. It links to the EAS build and the
   upload, and shows the version, version code and commit. If the job failed,
   the summary and the job's error say why. See
   [Troubleshooting](#troubleshooting).

### Fallback: build from your terminal

Use this only when the publish job can't do it. Run the Autosana workflow
without **publish** first and wait for it to pass.

1. **Start from a clean, up-to-date `main`:**

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
   `main` has moved on since, run the workflow again.

   To ship exactly the code of an earlier release (for example the commit iOS
   shipped), build from a separate clean checkout of that commit:

   ```sh
   git worktree add ../companion-release <commit>
   cd ../companion-release && bun install && cd apps/mobile
   ```

2. **Log in to Expo** (once per machine):

   ```sh
   npx eas-cli@latest login
   npx eas-cli@latest whoami
   ```

3. **Build.** This runs on Expo's servers and takes about 20–30 minutes.

   ```sh
   npx eas-cli@latest build --platform android --profile production
   ```

   If it asks to **generate a new Android keystore**, say **no and ask an
   Admin**. EAS already holds Cal.com's upload key, and Play rejects builds
   signed with a different one.

   You can close the terminal once the build starts. Follow it on
   [expo.dev → Builds](https://expo.dev/accounts/calcoms-organization/projects/calcom-companion/builds)
   or with `npx eas-cli@latest build:list --platform android --build-profile production --limit 3`.
   The profile filter leaves out the Autosana workflow's test builds of
   the same commit. Check that the build shows your version, a new version code
   and the commit you expect.
4. **Upload to Internal testing** once the build shows **Finished**:

   ```sh
   npx eas-cli@latest submit --platform android --latest
   ```

   `--latest` picks the newest finished Android build of the project. If
   someone else built after you, use `--id <build id>` from `build:list`
   instead. If this fails as well, download the `.aab` (next step) and upload
   it by hand ([Part 3 fallback](#fallback-upload-by-hand)).
5. **Download the `.aab`** (only for the upload by hand): click **Download** on
   the build's page on expo.dev. The file is about 85 MB.

   Or from the terminal, using the build ID from `build:list`:

   ```sh
   npx eas-cli@latest build:view <build id> --json   # check status, appVersion, appBuildVersion, gitCommitHash
   curl -L -o ~/Downloads/companion-android.aab \
     "$(npx eas-cli@latest build:view <build id> --json | jq -r '.artifacts.applicationArchiveUrl')"
   ```

---

## Part 3: Check Internal testing

All in Play Console → **Cal.com Companion** → **Test and release** →
**Testing** → **Internal testing**.

1. **Add testers** (once): open the **Testers** tab and click **Create email
   list**. Name it (for example "Cal team"), add the Google accounts of the
   people testing, and click **Save changes**. Back on the Testers tab, make
   sure the list is ticked, then click **Save**.
2. Under **How testers join your test**, find **Join on the web** and click
   **Copy link**. You'll open it on the phone in Part 4.
3. **Check the release.** Open the **Releases** tab. The publish job's upload
   is the newest release, named `<version code> (<version>)`, for example
   **47 (1.2.0)**, with the version code from the job summary. Internal
   testing usually goes live within minutes, without a full review. If
   **Publishing overview** in the left sidebar lists it under changes not yet
   sent for review or ready to publish, send or publish it there.

The automatic upload skips Play's review page with the supported-devices
check. You'll see that page when you promote the release (Part 6, step 5).

### Fallback: upload by hand

Only when the publish job and `eas submit` both failed. Use the `.aab` from the
[Part 2 fallback](#fallback-build-from-your-terminal), step 5.

1. Open the **Releases** tab and click **Create new release**.
2. Under **App bundles**, click **Upload** and pick the `.aab`. Wait for it to
   process. The release name fills in as `<version code> (<version>)`, for
   example **41 (1.1.0)**.
3. **Release notes:** replace the text between the `<en-US>` tags with a short
   line. Testers see it in the Play Store.
4. Click **Next**. The page lists errors and warnings, and the supported
   devices. Check them as in Part 6, step 5.
5. Click **Save and publish**, then confirm. If it only offers **Save**, that's
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
   `version`), and repeat Parts 2 and 3. The publish job creates a new
   Internal testing release. Testers get it as a normal update.

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
5. Click **Next**. The page lists errors and warnings:
   - **"This App Bundle contains Java/Kotlin code, which might be obfuscated"**
     (no deobfuscation file): ignore it. The app isn't obfuscated, and every
     release has shown it.
   - **Errors** block you. See [Troubleshooting](#troubleshooting).

   **Check the devices.** Under **Changes to your supported devices**, every
   row must show **0** devices no longer supported. If it shows a number, the
   build declares some hardware as required (see Part 1, step 4). Don't ship
   it like that: those devices would be stuck on the old version. Clicking the
   arrow on the bundle's **Required features** shows which ones.
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

This is done. EAS uploads with the Google service account
`play-console-service-account@calcom-companion.iam.gserviceaccount.com`. Since
26 November 2026 it has **Release apps to testing tracks** for Cal.com
Companion in Play Console, but no production permission. The publish job (Part
2) and `eas submit` therefore upload to Internal testing (`track: internal` in
the `production` submit profile of `apps/mobile/eas.json`), and promoting to
Production (Part 6) stays in Play Console.

For reference, this is how a Play Console admin grants the permission, for
example if the account is ever removed:

1. Play Console → **Users and permissions** → **Invite new users**.
2. **Email address:** the service account above.
3. **App permissions** → **Add app** → **Cal.com Companion** → **Apply**. Tick
   **Release apps to testing tracks**. Add **Release to production, exclude
   devices, and use Play App Signing** only if production releases should also
   be possible from the terminal.
4. **Apply**, then **Invite user**. The account doesn't need to accept; the
   change can take a few hours to apply.

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
| Review page says the release **no longer supports N devices** | A permission makes Play treat some hardware as required. Add it to `plugins/with-optional-android-features.js`, rebuild, and upload the new bundle. See Part 6, step 5. |
| Warning about a **deobfuscation file** | Ignore it. The app isn't obfuscated. |
| The release page offers **Save** but not **Save and publish** | Managed publishing is on. Open **Publishing overview** and send the changes for review. |
| The phone installs the old version after joining the test | Wait 10–15 minutes, then update in the Play Store. |
| Accepting the join link loops on "Verify it's you" (seen in an emulator's Chrome) | Accept the link in a desktop browser with the same Google account instead. |
| The run stops at **Check publish settings** | Its error says which check failed (Part 2, step 1). **Not main:** start the run again with **Use workflow from** set to `main`. **No `regression` label:** add it to **Labels**. |
| The publish job didn't run | It runs only when **publish** was ticked and every test job in the run passed. A failed, cancelled or skipped test job means nothing is published. Fix the cause and run the workflow again. |
| The build finished but the upload failed | You don't need a new build. Fix the cause and upload that build from your terminal: `npx eas-cli@latest submit --platform android --id <build id>`, with the build ID from the job summary. Or upload it by hand ([Part 3 fallback](#fallback-upload-by-hand)). Google Play doesn't check the version name, so the version in `app.json` is never the cause on Android. |
| The upload fails with `SERVICE_ACCOUNT_IS_MISSING_PERMISSIONS` | The service account lost its Play permission. Ask a Play admin to check it ([Making uploads automatic](#making-uploads-automatic)). Meanwhile, upload by hand. |
| EAS asks to **generate a new keystore** | Say no and ask an Admin. EAS already holds the upload key. |
| Review rejected for **app access** | The reviewer couldn't sign in. Check the account in **Sign in details**: password, two-factor off, US region. |
| **"Declare your trader status"** banner | Only the Play Console account owner can do this. It doesn't block releases, but Google removes the app if it's not done by the deadline. |
| You want to undo a release that's live | You can't roll back. Halt the rollout if it's staged, then ship a fix with a higher version code. |
