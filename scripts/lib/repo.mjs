// Small helpers shared by the repo scripts. Node built-ins only.
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/** Absolute path of the git working tree root. */
export function repoRoot() {
  return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()
}

/** Run git in the repo root and return stdout lines. */
export function gitLines(args, root = repoRoot()) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    .split('\n')
    .map((l) => l.replace(/\r$/, ''))
    .filter(Boolean)
}

/**
 * Paths listed by a git command run with `-z`. Unlike `gitLines`, names with
 * non-ASCII or special characters come back exactly, not quoted.
 */
export function gitPaths(args, root = repoRoot()) {
  return execFileSync('git', [...args, '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    .split('\0')
    .filter(Boolean)
}

/**
 * Raw contents of git objects, read by one `git cat-file --batch` process
 * rather than one `git show` per object. `names` are object names such as
 * `HEAD:path` (committed) or `:path` (staged). Returns a Map from name to
 * Buffer; names git cannot resolve (e.g. a file not committed yet) are left out.
 */
export function gitObjects(names, root = repoRoot()) {
  const found = new Map()
  if (!names.length) return found
  const out = execFileSync('git', ['cat-file', '--batch', '--buffer'], {
    cwd: root,
    input: names.map((n) => `${n}\n`).join(''),
    maxBuffer: Infinity,
  })
  let pos = 0
  for (const name of names) {
    const eol = out.indexOf(0x0a, pos)
    // "<oid> <type> <size>", or "<name> missing" / "<name> ambiguous".
    const size = out.toString('utf8', pos, eol).match(/^[0-9a-f]{40,64} \S+ (\d+)$/)?.[1]
    pos = eol + 1
    if (size === undefined) continue
    found.set(name, out.subarray(pos, pos + Number(size)))
    pos += Number(size) + 1 // contents, then a newline
  }
  return found
}

export function readRepoFile(path, root = repoRoot()) {
  return readFileSync(join(root, path), 'utf8').replace(/\r\n/g, '\n')
}

/**
 * Repo-relative paths (forward slashes) of the files under `dir`, recursively,
 * whose names end with `suffix`. Empty if `dir` doesn't exist.
 */
export function listFiles(dir, suffix, root = repoRoot()) {
  if (!existsSync(join(root, dir))) return []
  return readdirSync(join(root, dir), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? listFiles(`${dir}/${e.name}`, suffix, root) : e.name.endsWith(suffix) ? [`${dir}/${e.name}`] : [],
  )
}

/**
 * Convert a glob (supports **, *, ?, {a,b}) into a RegExp matched against
 * forward-slash repo-relative paths.
 */
export function globToRegExp(glob) {
  let re = ''
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]
    if (c === '*') {
      if (glob[i + 1] === '*') {
        const slash = glob[i + 2] === '/'
        re += slash ? '(?:.*/)?' : '.*'
        i += slash ? 2 : 1
      } else {
        re += '[^/]*'
      }
    } else if (c === '?') re += '[^/]'
    else if (c === '{') {
      const end = glob.indexOf('}', i)
      re += '(?:' + glob.slice(i + 1, end).split(',').map(escape).join('|') + ')'
      i = end
    } else re += escape(c)
  }
  return new RegExp('^' + re + '$')
}

const escape = (s) => s.replace(/[.+^$()|[\]\\]/g, '\\$&')

export function matchesAny(path, globs) {
  return globs.some((g) => globToRegExp(g).test(path))
}
