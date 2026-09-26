// Small helpers shared by the repo scripts. Node built-ins only.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
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

export function readRepoFile(path, root = repoRoot()) {
  return readFileSync(join(root, path), 'utf8').replace(/\r\n/g, '\n')
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
