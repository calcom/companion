# Releasing the iOS app to the App Store

This guide takes you from "I have never shipped an app" to "the new version is
live on the App Store". It covers the Cal.com Companion iOS app in
`apps/mobile`. Android is not covered.

You'll do about an hour of hands-on work, then wait 1–2 days for Apple's review.

## How the pieces fit together

| Name | What it is | What you use it for |
|------|------------|---------------------|
| **Expo / EAS** ([expo.dev](https://expo.dev)) | Expo's cloud service. EAS Build compiles the app on Expo's servers; EAS Submit uploads it to Apple. | Building the app and uploading it, from your terminal. |
| **App Store Connect** ([appstoreconnect.apple.com](https://appstoreconnect.apple.com)) | Apple's website for managing the app on the App Store. | Creating the version, testing in TestFlight, filling in review details, submitting, releasing. |
| **TestFlight** | Apple's beta testing service: a tab in App Store Connect plus an iPhone app. | Installing a build on your iPhone before anyone else gets it. |
| **Apple Developer** ([developer.apple.com](https://developer.apple.com)) | The developer account: membership, team ID, certificates. | Rarely. EAS manages the certificates for you. |

The flow:

1. **Build** the app on EAS from an up-to-date `main`.
2. **Upload** it to App Store Connect. Nothing is public yet.
3. **Test** that exact build on your iPhone through TestFlight.
4. **Submit** that same build for Apple's review.
5. **Release** it to everyone once Apple approves it.

## Quick reference

| Thing | Value |
|-------|-------|
| Apple team | Cal.com, Inc. (Team ID `ADWKXDJV75`) |
| Bundle ID | `com.cal.companion` |
| App Store Connect app | https://appstoreconnect.apple.com/apps/6757157271 |
| Expo organization / project | `calcoms-organization` / `calcom-companion` ([builds](https://expo.dev/accounts/calcoms-organization/projects/calcom-companion/builds)) |
| Version number | `version` in `apps/mobile/app.json` |
| Build settings | `production` profile in `apps/mobile/eas.json` (pinned Xcode image, build number set automatically) |
| TestFlight group for the team | **Team (Expo)** |

Commands, run from `apps/mobile` on a clean, up-to-date `main`:

```sh
npx eas-cli@latest build --platform ios --profile production
npx eas-cli@latest submit --platform ios --latest
```

---

## Part 0: Get access (once per person)

You need all of these before your first release.

1. **An Apple ID with two-factor authentication on.** Apple requires it for
   developer accounts. Use your work email if you can.
2. **A seat on the Cal.com, Inc. Apple team.** Ask an existing Admin to invite
   you in App Store Connect → **Users and Access**. Your role must be one of:
   - **Admin** (simplest), or
   - **App Manager** with **Access to Certificates, Identifiers & Profiles**
     ticked.

   The **Developer** role is not enough: it can't submit for review, and EAS
   needs certificate access during the build.

   Accept the email invite, then sign in at
   [appstoreconnect.apple.com](https://appstoreconnect.apple.com). If it asks
   which team, choose **Cal.com, Inc.**. You should see **Apps → Cal.com**.
3. **A seat in the Expo organization.** Create an account on
   [expo.dev](https://expo.dev), then ask an Owner or Admin of
   `calcoms-organization` to invite you with the **Developer** role or higher.
   Accept the invite. The project is `calcom-companion`.
4. **Tools on your Mac:** this repo cloned, plus Node.js, so `npx` works. You
   don't need to install the EAS CLI; `npx eas-cli@latest` downloads it each
   time.
5. **An iPhone** with the **TestFlight** app installed from the App Store.

---

## Part 1: Before you build

1. **Bump the version.** In `apps/mobile/app.json`, set `expo.version` to the
   new version, for example `1.1.0` → `1.1.1` for fixes or `1.2.0` for new
   features. It must be higher than the version live on the App Store. Merge
   that change to `main` with a normal PR.

   Don't touch the build number. EAS stores it on its servers and raises it by
   one on every production build (`appVersionSource: remote`,
   `autoIncrement: true` in `eas.json`).
2. **Make sure the backend is live.** Apple's reviewer uses the real
   app.cal.com. Anything the new features need on the Cal.com side must already
   be in production: API changes, file storage, feature flags, and new OAuth
   scopes on **every** production OAuth client (US and EU). If it isn't, the
   reviewer hits errors and rejects the build.
3. **Check the build's environment variables.** Builds use the variables stored
   on expo.dev in the **production** environment. Your local `.env` files are
   never uploaded (`apps/mobile/.easignore` excludes them).

   ```sh
   cd apps/mobile
   npx eas-cli@latest env:list --environment production
   ```

   The iOS app needs at least `EXPO_PUBLIC_CALCOM_OAUTH_CLIENT_ID`,
   `EXPO_PUBLIC_CALCOM_OAUTH_CLIENT_ID_EU` and
   `EXPO_PUBLIC_CALCOM_OAUTH_REDIRECT_URI`.
4. **Note anything Apple will ask about.** Did the release add a new permission
   prompt (camera, photos, microphone…)? Does it start sending a new kind of
   user data to the server, for example uploaded photos? If so, you'll update
   the App Privacy label in Part 5, step 5.

---

## Part 2: Build and upload

Use a normal Terminal window. Apple's login and two-factor prompts are
interactive.

1. **Start from a clean, up-to-date `main`:**

   ```sh
   cd ~/path/to/companion/apps/mobile
   git switch main
   git pull
   git status
   ```

   `git status` must say `nothing to commit, working tree clean`. EAS uploads
   the files in your folder, **including uncommitted changes**, so a local test
   tweak would ship to the App Store.
2. **Log in to Expo** (once per machine):

   ```sh
   npx eas-cli@latest login
   npx eas-cli@latest whoami
   ```

3. **Build.** This runs on Expo's servers and takes about 20–40 minutes.

   ```sh
   npx eas-cli@latest build --platform ios --profile production
   ```

   Answers to its questions:
   - **"Do you want to log in to your Apple account?"** Yes. Use your Apple ID.
   - **Two-factor code:** a sign-in prompt appears on a device that uses the
     same Apple ID. Tap **Allow** to see the 6-digit code and type it in the
     terminal. No prompt? Get a code from Settings → your name →
     **Sign-In & Security** → **Get Verification Code**. Or press Ctrl+C,
     rerun the command, and choose **SMS** when it asks how to get the code.
   - **Reuse an existing certificate, provisioning profile or push key?** Yes.
   - **Revoke anything?** **No. Stop and ask an Admin.** Revoking the push key
     breaks push notifications for everyone on the live app.

   You can close the terminal once the build starts. Follow it on
   [expo.dev → Builds](https://expo.dev/accounts/calcoms-organization/projects/calcom-companion/builds)
   or with `npx eas-cli@latest build:list --platform ios --limit 3`. Check
   that the build shows your version, a new build number and the commit you
   expect.
4. **Upload to App Store Connect** once the build shows **Finished**:

   ```sh
   npx eas-cli@latest submit --platform ios --latest
   ```

   `--latest` picks the newest finished iOS build of the project. If someone
   else built after you, use `--id <build id>` from `build:list` instead. If it
   asks you to log in to Apple, or to create or reuse an App Store Connect API
   key, say yes.

   This only uploads the build. Nothing goes to Apple's review yet.
5. **Wait for Apple to process it** (usually 10–30 minutes; Apple emails you).
   The build then shows in App Store Connect → **TestFlight**, under your
   version number.

---

## Part 3: Create the version in App Store Connect

You can do this while the build runs.

1. Open App Store Connect → **Apps → Cal.com** → **Distribution** tab.
2. In the left sidebar, click the blue **+** next to **iOS App**. Type the
   version exactly as in `app.json` (for example `1.1.1`) and click **Create**.
   A new entry, *Prepare for Submission*, appears. The live version is not
   affected.
3. Fill in **What's New in This Version** and click **Save**. It's required for
   updates, and it's **public**: users see it in the App Store's Version History
   and Updates list. Write it for users, keep it short, and leave out internal
   details. You can't change it after you submit.

Everything else on the page, such as description, keywords, screenshots and
support URL, is copied from the previous version. You don't need to change it.
Screenshots are optional and are only worth updating if you want the store page
to show new features. They can only change with a new version, and only before
you submit.

**Add for Review** stays grey until a build is attached (Part 5). That's
expected.

---

## Part 4: Test on your iPhone with TestFlight

1. **Make sure you're a tester.** App Store Connect → **TestFlight** → **Team
   (Expo)** in the sidebar → **Testers**. If you're not listed, click **+** and
   add yourself. Only App Store Connect users can be internal testers.
2. **Accept the invite on your iPhone.** Apple emails you ("…is now available to
   test"). Open that email **on the iPhone** and tap **View in TestFlight**,
   then **Accept** → **Install**.
   - If TestFlight shows a **Redeem** screen, it hasn't found an invite. Open
     the email on the phone instead. Or open the link on a Mac, where the page
     shows an 8-character code you can type into Redeem.
   - No email? Check spam, then resend the invite from the group's tester list.
3. **Later builds:** once you've accepted, new builds appear in the TestFlight
   app. Tap **Update**. Open Cal.com in TestFlight to see which build you have,
   for example **1.1.1 (42)**.
4. **Test the release** with real production accounts:
   - Sign in with the **US** and the **EU** region on the login screen.
   - Try every new feature, especially anything that uploads data or asks for a
     permission.
   - Ignore the install and session counts in App Store Connect. They lag by
     hours.
5. **Found a bug?** Fix it on a branch, merge to `main` (keep the same
   `version`), and repeat Part 2. The new build appears under the same version
   with the next build number.

**Letting a teammate test:** invite them in **Users and Access** (any role),
then add them to **Team (Expo)**. They follow step 2. Feedback they send from
the TestFlight app shows up in App Store Connect → **TestFlight** → **Feedback**
→ **Screenshots** (or **Crashes**).

---

## Part 5: Fill in the submission

All on the version's page: **Distribution** → your version (*Prepare for
Submission*).

1. **Build:** scroll to **Build** and click **Add Build**. Pick the exact build
   you tested, then click **Done**. To swap out a build that's already
   attached, hover over it and click the remove icon. If your build isn't in
   the list, refresh the page; it may have only just finished processing.
2. **App Review Information** (near the bottom):
   - **Sign-In Information:** "Sign-in required" ticked, with the demo
     account's user name and password. The app is useless without a Cal.com
     login, so Apple's reviewer signs in with this account. The credentials live
     **only here**, copied from the previous version; never commit them to the
     repo. The account must:
     - be a real account on the production **app.cal.com** (US region);
     - have two-factor login **off**, since the reviewer can't get your codes;
     - contain sample data for the new features (sign in as it on app.cal.com
       or in the TestFlight build and create some);
     - keep the same password and data until the version is approved.
   - **Notes:** keep the existing sign-in instructions and add one line saying
     where the new features are. For example: *"New in 1.1.0: Events are in the
     Events tab, where you can create, edit and publish events."*
   - **Contact Information:** who Apple calls or emails with questions. Put the
     person doing the release.
3. **Version Release:** choose **Manually release this version**. After
   approval the version waits until you click **Release This Version**, so it
   never goes live at an awkward time. If you also turn on **Phased Release**,
   automatic updates roll out over 7 days, and you can pause them if a bug shows
   up.
4. Click **Save** (top right).
5. **App Privacy** (left sidebar, only if the release collects new data). Click
   **Edit** next to Data Types and tick the new type. For example, 1.1.0 added
   **Photos or Videos** for event cover and speaker photos. Don't untick
   anything else. Then answer its questions:
   - **Purpose:** usually **App Functionality** only.
   - **Linked to the user's identity:** **Yes** if it's stored in their Cal.com
     account.
   - **Used for tracking** (ads or data brokers): **No**.

   Label changes publish **immediately** and aren't tied to a version, so do
   this on the day you submit. App Store Connect publishes it as soon as you
   finish the questions (the page then says "Published a few seconds ago");
   there's no separate Publish button.

---

## Part 6: Submit for review

1. On the version page, click **Add for Review** (top right), then **Submit to
   App Review**. If it refuses, see [Troubleshooting](#troubleshooting).
2. The status goes **Waiting for Review → In Review**. Apple usually finishes
   within 1–2 days.
3. **While you wait,** don't change the demo account's password or delete its
   data.
4. **If Apple has a question or rejects the build,** you get an email, and the
   message appears under **App Review** (left sidebar, under General). Reply
   there. If it needs a code change, follow
   [Replacing the build](#replacing-the-build-after-you-submitted).

---

## Part 7: Release

1. Once approved, the status becomes **Pending Developer Release**.
2. Go to **Distribution** → your version and click **Release This Version**
   (top right), then confirm. Don't click the **cancel this release** link in
   the blue banner; it withdraws the approval.
3. The status changes to **Processing for Distribution**, then **Ready for
   Distribution**. That means it's released.
4. It can take up to 24 hours to reach every country's App Store. To check, open
   Cal.com in the App Store on an iPhone and look under **Version History**.
   Existing users get it as a normal update.

---

## Replacing the build after you submitted

Use this if you find a bug or merge a fix after submitting, even after Apple has
approved the build, as long as you haven't released it yet.

1. **Keep the same version number.** Don't change `app.json`. Forum reports say
   changing the version number after pulling a version back can lock it so it
   accepts no builds.
2. **Build, upload and test the new build first** (Parts 2 and 4). The old build
   keeps its place in the queue, or stays approved, until you pull it in the
   next step.
3. **Pull the version back.** At the top of the version page, a blue banner
   includes a link:
   - **"remove this version from review"** while it's *Waiting for Review* or
     *In Review*
   - **"cancel this release"** while it's *Pending Developer Release*

   Click it and confirm. The status becomes **Developer Rejected** and the page
   is editable again. Another way to get there: **App Review** in the sidebar →
   **Submissions** → the submission → **Cancel Submission**.
4. **Swap the build:** in **Build**, remove the old one, click **Add Build**,
   pick the new one (refresh if it's missing), click **Done**, then **Save**.
5. **Submit again:** **Add for Review** → **Submit to App Review**. The review
   starts over. What's New, notes, demo login, privacy and age rating all carry
   over.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| **Add for Review** is grey | No build is attached yet. See Part 5, step 1. |
| Your build isn't in **Add Build** | Refresh the page. Check that it finished processing in the TestFlight tab, and that the upload (Part 2, step 4) actually ran. The version in `app.json` must match the App Store Connect version exactly. |
| TestFlight shows **Redeem** | You haven't accepted an invite. Open the invite email on the iPhone. See Part 4, step 2. |
| "Unable to Add for Review" about **age ratings** | Apple sometimes adds required age-rating questions, and every update must answer them. Click **Go to App Information** → **Age Rating** → **Edit**. For this app every answer is **No** / **None**: no user-to-user chat, no social feed, no unrestricted web browsing, no ads. That gives **4+**. On the last step, leave the override as **Not Applicable**, as in previous versions. Save, then submit again. |
| No two-factor code during `eas build` | See Part 2, step 3: get a code from Settings → **Sign-In & Security**, or rerun and pick SMS. |
| EAS asks to **revoke** a certificate or push key | Say no and ask an Admin. Revoking the push key breaks notifications in the live app. |
| Build installed, but App Store Connect shows 0 installs | Normal. The counts lag by hours. TestFlight on the phone shows which build you have. |
| No emails from Apple about review status | App Store Connect → your name (top right) → **Edit Profile** → **Notifications** → turn on **App Status Reports**, then **Save**. |
| You want to undo a release that's live | You can't roll back. Ship a fix as a new version: bump `version`, then repeat this guide. |
