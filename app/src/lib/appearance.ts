// Appearance: three independent switches (docs/ui.md "Appearance").
// Applied as attributes on <html>, which styles/tokens.css reads. index.html
// applies the saved values before first paint, so there is no flash.
import type { AppSettings } from '../types'

export type ColourScheme = 'student-invoice' | 'navy-amber'
export type Corners = 'square' | 'rounded'
export type Mode = 'light' | 'dark'

export interface Appearance {
  scheme: ColourScheme
  corners: Corners
  mode: Mode
}

/** localStorage key for light/dark, shared with v1.0.1 (invariant `theme-key`). */
export const THEME_STORAGE_KEY = 'student-invoice-theme'

const SCHEMES: readonly ColourScheme[] = ['student-invoice', 'navy-amber']
const CORNERS: readonly Corners[] = ['square', 'rounded']

function storedMode(): Mode | null {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY)
    return v === 'light' || v === 'dark' ? v : null
  } catch {
    return null
  }
}

/** The appearance to show, from settings (unknown values fall back to the defaults). */
export function appearanceFrom(settings: Pick<AppSettings, 'theme' | 'colourScheme' | 'corners'>): Appearance {
  return {
    scheme: SCHEMES.includes(settings.colourScheme as ColourScheme) ? (settings.colourScheme as ColourScheme) : 'student-invoice',
    corners: CORNERS.includes(settings.corners as Corners) ? (settings.corners as Corners) : 'square',
    // The theme key wins over settings.theme, as in v1.0.1.
    mode: storedMode() ?? (settings.theme === 'dark' ? 'dark' : 'light'),
  }
}

export function applyAppearance(a: Appearance): void {
  const root = document.documentElement
  root.dataset.scheme = a.scheme
  root.dataset.corners = a.corners
  root.dataset.mode = a.mode
}

export function saveMode(mode: Mode): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode)
  } catch {
    // Storage unavailable: the choice still applies for this session.
  }
}
