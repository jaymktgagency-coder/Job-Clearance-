/**
 * resolve-ts.mjs — lets a plain `node` run import the app's TypeScript files.
 *
 * Plain English: inside the app, files import each other without writing the
 * ".ts" on the end, because Next.js fills that in. Node on its own doesn't, so
 * `import "./client"` fails when a test reaches into src/. This teaches Node
 * the same trick, and the "@/" shorthand the app uses, so the AI tests can
 * exercise the real files rather than a copy of them.
 */

import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./resolve-ts-hooks.mjs", pathToFileURL("./tests/"));
