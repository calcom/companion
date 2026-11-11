module.exports = (api) => {
  api.cache(true);
  return {
    presets: [
      [
        "babel-preset-expo",
        {
          jsxImportSource: "nativewind",
          "react-compiler": {
            panicThreshold: "all_errors",
            // The copied kloq packages aren't written for the compiler, which already skips
            // installed packages (packages/expo-kloq/README.md).
            sources: (filename) => !/[/\\]packages[/\\](expo-kloq|kloq)[/\\]/.test(filename),
          },
        },
      ],
      "nativewind/babel",
    ],
  };
};
