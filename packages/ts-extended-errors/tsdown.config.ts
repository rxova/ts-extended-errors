import { defineConfig } from "tsdown";
import { baseBuildConfig } from "@rxova/repo-config/tsdown";

// The preset's Node 22 target matches `engines`. The dual format earns its
// keep here: a zero-dependency error utility gets pulled into old CJS services
// as readily as into new ESM ones. `fixedExtension` keeps `.mjs` / `.cjs` and
// `.d.mts` / `.d.cts`, matching the exports map.
export default defineConfig(
  baseBuildConfig({
    format: ["esm", "cjs"],
    fixedExtension: true,
    deps: {
      // @rxova/ts-utils is a dev dependency, inlined so the published package
      // keeps no runtime dependencies. Anything else bundled from node_modules
      // fails the build, and so does an emitted import of any package.
      onlyBundle: ["@rxova/ts-utils"],
      onlyImport: [],
    },
  }),
);
