# Cal.com custom keyboard

The Cal.com keyboard lets you insert a booking link and one or more available
times into any app's text field. Open the Companion app to sync your links and
available times before switching to the keyboard.

## iOS installation

1. Open **Settings → General → Keyboard → Keyboards**.
2. Tap **Add New Keyboard** and choose **Cal.com**.
3. In any text field, use the globe key to switch to Cal.com.

Allow Full Access is not required. The keyboard does not fetch network data.

## Android installation

1. Open **Settings → System → Languages & input → On-screen keyboard**.
2. Tap **Manage keyboards** and enable **Cal.com**.
3. In any text field, switch to Cal.com with the keyboard-switch key.

## Data syncing

The Companion app owns authentication, time-zone formatting, and availability
requests. Open the app to refresh the keyboard data. The keyboard itself never
fetches network data.

## Development and builds

Custom keyboard extensions are not available in Expo Go. Generate native
projects and install a development build:

```sh
cd apps/mobile
npx expo prebuild
eas build --profile development --platform ios
eas build --profile development --platform android
```

The iOS keyboard extension and Android IME are included by the native
configuration during prebuild.
