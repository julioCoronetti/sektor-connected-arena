module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    // react-native-worklets/plugin DEVE ser o último plugin (Reanimated 4+).
    plugins: ["react-native-worklets/plugin"],
  };
};
