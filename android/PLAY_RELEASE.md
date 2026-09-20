# Google Play release

The Android app uses package ID `nl.coffeeshopbond.leden`, version name `1.0`,
and version code `1`.

## Build requirements

- JDK 21
- Android SDK 36
- Android Build Tools 35.0.0 or newer

## Signing

Create `android/keystore.properties` locally. It is intentionally ignored by
Git and has this format:

```properties
storeFile=/absolute/path/to/ledenbcd-upload.jks
storePassword=...
keyAlias=ledenbcd-upload
keyPassword=...
```

Never commit the keystore or its passwords. Google Play App Signing should be
enabled when the app is created; this local key is the upload key.

The build can alternatively receive the same values through the environment
variables `BCD_ANDROID_KEYSTORE_PATH`, `BCD_ANDROID_KEYSTORE_PASSWORD`,
`BCD_ANDROID_KEY_ALIAS`, and `BCD_ANDROID_KEY_PASSWORD`. The production upload
key is stored outside the repository and its password is kept in the macOS
Keychain under `BCD Leden-app Android Upload Key`.

## Release bundle

From the `android` directory, run:

```sh
./gradlew bundleRelease
```

The signed bundle is generated at
`app/build/outputs/bundle/release/app-release.aab`.

Android push notifications also require the Firebase configuration file
`android/app/google-services.json` for package ID
`nl.coffeeshopbond.leden` before the production release is built. This file is
kept locally and is intentionally excluded from Git because the repository is
public.
