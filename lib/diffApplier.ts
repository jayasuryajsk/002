import * as Diff from 'diff';

/**
 * Applies a diff patch to the original content.
 * @param original The original file content as a string.
 * @param patch The diff patch in unified diff format.
 * @returns The new content after applying the patch.
 * @throws An error if the patch cannot be applied.
 */
export function applyDiff(original: string, patch: string): string {
  const newContent = Diff.applyPatch(original, patch);
  if (newContent === false) {
    throw new Error('Patch could not be applied');
  }
  return newContent;
}
