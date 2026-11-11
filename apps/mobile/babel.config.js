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
            // The copied kloq code isn't written for the compiler, which already skips
            // installed packages (vendor/README.md).
            sources: (filename) => !/[/\\]mobile[/\\]vendor[/\\]/.test(filename),
          },
        },
      ],
      "nativewind/babel",
    ],
  };
};
