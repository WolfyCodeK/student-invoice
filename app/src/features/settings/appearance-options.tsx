// The three appearance choices (docs/ui.md "Appearance"), shared by Settings →
// Appearance and the "Choose how it looks" panel shown after the v1.1.0 update
// (features/onboarding/appearance-picker.tsx). Each choice applies and saves
// straight away through the store. The tiles' styles are in styles/base.css
// (.choice, next to the .seg switch); each place lays them out itself.
import type { ReactNode } from "react";
import { Check, Moon, Sun } from "lucide-react";
import { useAppStore } from "../../stores/app-store";
import { appearanceFrom, type Appearance, type ColourScheme, type Corners, type Mode } from "../../lib/appearance";
import type { RadioOption } from "./radio-group";

/** A tile's inside: a small picture, the name and a note, and a tick when chosen. */
const tile = (art: ReactNode, name: string, note: string) => (
  <>
    {art}
    <span className="st-choice-text">
      <strong>{name}</strong>
      <small>{note}</small>
    </span>
    <Check className="st-choice-check" aria-hidden="true" />
  </>
);

const swatch = (variant: "si" | "na") => (
  <span className={`swatch swatch--${variant}`} aria-hidden="true">
    <i />
    <i />
  </span>
);

export const SCHEME_OPTIONS: RadioOption<ColourScheme>[] = [
  { value: "student-invoice", content: tile(swatch("si"), "Student Invoice", "Register blue") },
  { value: "navy-amber", content: tile(swatch("na"), "Navy and amber", "With softer lettering") },
];

export const CORNER_OPTIONS: RadioOption<Corners>[] = [
  {
    value: "square",
    content: tile(<span className="corner-demo corner-demo--square" aria-hidden="true" />, "Square", "Neat, straight edges"),
  },
  {
    value: "rounded",
    content: tile(<span className="corner-demo corner-demo--rounded" aria-hidden="true" />, "Rounded", "Round buttons, softer corners"),
  },
];

export const MODE_OPTIONS: RadioOption<Mode>[] = [
  {
    value: "light",
    content: (
      <>
        <Sun aria-hidden="true" />
        Light
      </>
    ),
  },
  {
    value: "dark",
    content: (
      <>
        <Moon aria-hidden="true" />
        Dark
      </>
    ),
  },
];

/** The appearance on screen, and the store's setter, which applies and saves a change at once. */
export function useAppearance(): [Appearance, (update: Partial<Appearance>) => void] {
  const settings = useAppStore((s) => s.settings);
  const setAppearance = useAppStore((s) => s.setAppearance);
  return [appearanceFrom(settings), setAppearance];
}
