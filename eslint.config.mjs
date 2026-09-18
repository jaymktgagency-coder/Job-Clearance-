import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Server action signatures take a previous-state argument they often
      // don't need. Naming it with a leading underscore says "deliberate".
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Browser test scripts, not application code.
    "tests/**",
    // Design skills installed by `npx skills add`. Vendored reference
    // material for the coding agent — never bundled, never shipped, and not
    // ours to lint. Without this, 15 errors from their .cjs helpers drown
    // out any real problem in src/.
    ".agents/**",
    ".claude/**",
  ]),
]);

export default eslintConfig;
