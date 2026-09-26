// Files that must never be committed, whatever they contain. The one list for
// scripts/check-secrets.mjs (staged files and CI) and the no-secrets-tracked
// invariant in scripts/check-invariants.mjs; .gitignore ignores the same names.
// Patterns match forward-slash repo-relative paths.

/** [pattern, what the file is] */
const SECRET_FILES = [
  [/(^|\/)\.env(\.(?!example$)[^/]*)?$/, '.env file'],
  [/\.key(\.pub)?$/, 'key file'],
  [/(^|\/)client_secret[^/]*\.json$/i, 'Google client secret file'],
  [/(^|\/)google-oauth[^/]*\.json$/i, 'OAuth credentials file'],
]

/** What kinds of secret file `path` looks like; empty if none. */
export function secretFileKinds(path) {
  return SECRET_FILES.filter(([re]) => re.test(path)).map(([, kind]) => kind)
}
