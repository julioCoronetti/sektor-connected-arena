const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");

const config = getDefaultConfig(__dirname);

// Exclui lambdas/, infra/ e docs/ da raiz do repositório do watch do Metro.
// Esses diretórios foram movidos para fora de app/ e não fazem parte do bundle.
config.resolver = config.resolver ?? {};
config.resolver.blockList = [
  new RegExp(`^${escapeRegex(path.join(repoRoot, "lambdas"))}.*`),
  new RegExp(`^${escapeRegex(path.join(repoRoot, "infra"))}.*`),
  new RegExp(`^${escapeRegex(path.join(repoRoot, "docs"))}.*`),
];

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = withNativeWind(config, { input: "./src/global.css" });
