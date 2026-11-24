# kloq (copied)

kloq's native calendar (SwiftUI on iOS, Jetpack Compose on Android), copied from
[cosscom/coss](https://github.com/cosscom/coss) at `8d4e11f44464b9f8fcaed00e78125d5a94096013`
(11 November 2026):

- `expo-kloq/` is coss's `packages/expo-kloq` (its `src` and `LICENSE`).
- `kloq/` holds the 35 files of coss's `packages/kloq/src/lib` that `expo-kloq` imports, and its
  `LICENSE`. kloq's web calendar isn't included.

kloq isn't on npm yet; it will be published as `@kloq/core` and `@kloq/expo`. Until then the app
uses these copies. Don't edit them here: change them in coss and copy them again.

One change is ahead of that commit: the Year view's empty squares get their own keys
(`expo-kloq/src/views/year-view.tsx`), from
[cosscom/coss#351](https://github.com/cosscom/coss/pull/351). The next copy from coss brings it
in once that PR is merged.

## Swapping to npm

1. Delete `apps/mobile/vendor`.
2. In `apps/mobile`: `bun add @kloq/expo`, and change the `expo-kloq` imports to `@kloq/expo` and
   the `kloq/lib/navigation` import to its `@kloq/core` path.
3. Remove the `expo-kloq` and `kloq/lib/*` paths from `apps/mobile/tsconfig.json`, and the
   `vendor` entries from `biome.json`, `apps/mobile/eslint.config.mjs` and
   `apps/mobile/babel.config.js`.

## Copying a newer version

From a coss checkout at the new commit (`$COSS`), in `apps/mobile`:

```sh
rm -rf vendor/expo-kloq/src && cp -R "$COSS/packages/expo-kloq/src" vendor/expo-kloq/
for f in vendor/kloq/src/lib/*.ts; do cp "$COSS/packages/kloq/src/lib/$(basename "$f")" "$f"; done
```

Then update the commit above. If the new version imports a kloq file that isn't in
`vendor/kloq/src/lib` yet, the app's type-check fails on that import: copy that file too.

## How the app builds it

- `expo-kloq` and `kloq/lib/*` are path aliases in `apps/mobile/tsconfig.json`, which Expo's
  bundler reads too. Inside `apps/mobile`, the copies find `react-native`, `@expo/ui` and the rest
  in the app's own `node_modules`, the same copies the app uses, whatever Bun version installed
  them. They aren't workspace packages, so they add nothing to `bun.lock`.
- Biome, ESLint's React Compiler rule and the React Compiler itself skip `vendor`
  (`biome.json`, `apps/mobile/eslint.config.mjs`, `apps/mobile/babel.config.js`), as they skip
  installed packages: kloq isn't written for the compiler.
- The source imports files with their `.ts` and `.tsx` endings, so `apps/mobile/tsconfig.json`
  sets `allowImportingTsExtensions`.
