import pkg from "../package.json" with { type: "json" };
import { RELEASE_HISTORY } from "../src/releases.js";

const pkgVersion = pkg.version;
const latest = RELEASE_HISTORY[0]?.version;

if (!latest) {
  console.error("releases.js: RELEASE_HISTORY is empty.");
  process.exit(1);
}

if (latest !== pkgVersion) {
  console.error(
    `Release version mismatch: package.json is ${pkgVersion}, releases.js latest is ${latest}.`
  );
  process.exit(1);
}

console.log(`Release OK: v${pkgVersion}`);
