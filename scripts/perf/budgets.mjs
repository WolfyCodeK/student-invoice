// Performance budgets. Single source for scripts/perf/check-bundle.mjs (CI),
// the release preflight, and the table in docs/performance.md.
// Raise a budget only deliberately, with the reason in the commit message.

/** Gzipped sizes, in KiB, of the built frontend (app/dist). */
export const BUNDLE_BUDGETS = {
  /** JS loaded at start-up (the entry chunk). */
  startupJsGzipKiB: 150,
  /** All JS, including chunks loaded on demand. */
  totalJsGzipKiB: 210,
  /** All CSS. */
  cssGzipKiB: 10,
}

/** The signed MSI installer, in MiB (checked by the release script). */
export const INSTALLER_BUDGET_MIB = 6

/** Targets measured by scripts/perf/measure.ps1 on the owner's PC (not enforced in CI). */
export const RUNTIME_TARGETS = {
  timeToUsableMs: 800,
  idleCpuSecondsPer10s: 0.1,
}
