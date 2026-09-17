import { promises as fs } from "node:fs";
import path from "node:path";
import { ValidationError } from "../models/errors.js";

/** Component-aware containment: a sibling with the same prefix is not inside. */
export function isInsideRoot(root: string, candidate: string): boolean {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

export function resolveInsideRoot(photoRoot: string, folder: string): string {
  const target = path.resolve(photoRoot, folder);
  if (path.isAbsolute(folder) || !isInsideRoot(photoRoot, target)) {
    throw new ValidationError("Cartella di scansione non valida", { fields: ["folder"] });
  }
  return target;
}

/** Validate before acquiring the scan lock; never expose filesystem error messages. */
export async function validateScanDirectory(photoRoot: string, folder: string): Promise<string> {
  const target = resolveInsideRoot(photoRoot, folder);
  const root = path.resolve(photoRoot);
  try {
    const realRoot = await fs.realpath(root);
    const realTarget = await fs.realpath(target);
    if (!isInsideRoot(realRoot, realTarget) || !(await fs.stat(target)).isDirectory()) {
      throw new Error("Invalid directory");
    }
    // The configured root may itself be an operator-selected mount alias.
    // Below it, never follow directory symlinks, including in the requested folder.
    let current = root;
    for (const component of path.relative(root, target).split(path.sep).filter(Boolean)) {
      current = path.join(current, component);
      if ((await fs.lstat(current)).isSymbolicLink()) throw new Error("Directory symlink");
    }
  } catch {
    throw new ValidationError("Cartella di scansione non valida o non disponibile", {
      fields: ["folder"],
    });
  }
  return target;
}
