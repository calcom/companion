# expo-kloq (copied)

The native kloq calendar (SwiftUI on iOS, Jetpack Compose on Android), copied from
[cosscom/coss](https://github.com/cosscom/coss) `packages/expo-kloq` at
`8d4e11f44464b9f8fcaed00e78125d5a94096013` (11 November 2026). `packages/kloq` holds the 35
kloq model files it imports through `kloq/lib/*`, from the same commit.

kloq isn't on npm yet; it will be published as `@kloq/core` and `@kloq/expo`. Until then the app
uses these copies. Don't edit them here: change them in coss and copy them again.

One change is ahead of that commit: the Year view's empty squares get their own keys
(`src/views/year-view.tsx`), from [cosscom/coss#351](https://github.com/cosscom/coss/pull/351).
The next copy from coss brings it in once that PR is merged.

## Swapping to npm

1. Delete `packages/expo-kloq` and `packages/kloq`.
2. In `apps/mobile`: `bun add @kloq/expo`, and change the `expo-kloq` imports to `@kloq/expo`.
3. Remove the `packages/kloq` and `packages/expo-kloq` entries from `biome.json` and
   `apps/mobile/babel.config.js`.

## Copying a newer version

From a coss checkout at the new commit (`$COSS`), in this repo's root:

```sh
rm -rf packages/expo-kloq/src && cp -R "$COSS/packages/expo-kloq/src" packages/expo-kloq/
for f in packages/kloq/src/lib/*.ts; do cp "$COSS/packages/kloq/src/lib/$(basename "$f")" "$f"; done
```

Then update the commit above. If the new version imports a kloq file that isn't in
`packages/kloq/src/lib` yet, the app's type-check fails on that import: copy that file too.

## How the app builds it

- Biome skips both folders.
- Their peer dependencies are marked optional, so Bun links the app's copies instead of
  resolving them again (which reshuffles `bun.lock`).
- Both list `@types/react` as a dev dependency, at the app's version. CI installs each package
  with only what it lists, and without it the app's type-check can't find React's types for
  these files.
- The React Compiler skips both folders (`apps/mobile/babel.config.js`), as it skips installed
  packages: kloq isn't written for it.
- The source imports files with their `.ts` and `.tsx` endings, so `apps/mobile/tsconfig.json`
  sets `allowImportingTsExtensions`.
