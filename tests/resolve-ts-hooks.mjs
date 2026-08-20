/** The resolver half of resolve-ts.mjs. See that file for what this is for. */
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve as resolvePath } from "node:path";

const SRC = resolvePath(process.cwd(), "src");

export async function resolve(specifier, context, nextResolve) {
  // "@/lib/thing" is the app's shorthand for "src/lib/thing".
  if (specifier.startsWith("@/")) {
    specifier = pathToFileURL(resolvePath(SRC, specifier.slice(2))).href;
  }

  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    // Extensionless relative import: try adding .ts, then /index.ts.
    const parent = context.parentURL ? fileURLToPath(context.parentURL) : process.cwd();
    const base = specifier.startsWith("file:")
      ? fileURLToPath(specifier)
      : resolvePath(parent, "..", specifier);
    for (const candidate of [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`]) {
      if (existsSync(candidate)) {
        return nextResolve(pathToFileURL(candidate).href, context);
      }
    }
    throw error;
  }
}
