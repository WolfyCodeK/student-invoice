// Settings → Appearance: colours, corners, light or dark (docs/ui.md
// "Appearance"). Each choice applies straight away through the store.
import type { ReactNode } from "react";
import { Check, Moon, Sun } from "lucide-react";
import { useAppStore } from "../../stores/app-store";
import { appearanceFrom, type ColourScheme, type Corners, type Mode } from "../../lib/appearance";
import { RadioGroup, type RadioOption } from "./radio-group";

function Tile({ art, name, note }: { art: ReactNode; name: string; note: string }) {
  return (
    <>
      {art}
      <span className="st-choice-text">
        <strong>{name}</strong>
        <small>{note}</small>
      </span>
      <Check className="st-choice-check" aria-hidden="true" />
    </>
  );
}

const SCHEMES: RadioOption<ColourScheme>[] = [
  {
    value: "student-invoice",
    content: (
      <Tile
        art={
          <span className="swatch swatch--si" aria-hidden="true">
            <i />
            <i />
          </span>
        }
        name="Student Invoice"
        note="Register blue"
      />
    ),
  },
  {
    value: "navy-amber",
    content: (
      <Tile
        art={
          <span className="swatch swatch--na" aria-hidden="true">
            <i />
            <i />
          </span>
        }
        name="Navy and amber"
        note="Navy and amber, like the teacher's website"
      />
    ),
  },
];

const CORNERS: RadioOption<Corners>[] = [
  {
    value: "square",
    content: <Tile art={<span className="corner-demo corner-demo--square" aria-hidden="true" />} name="Square" note="Neat, straight edges" />,
  },
  {
    value: "rounded",
    content: <Tile art={<span className="corner-demo corner-demo--rounded" aria-hidden="true" />} name="Rounded" note="Round buttons, softer corners" />,
  },
];

const MODES: RadioOption<Mode>[] = [
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

export function AppearanceGroup() {
  const settings = useAppStore((s) => s.settings);
  const setAppearance = useAppStore((s) => s.setAppearance);
  const current = appearanceFrom(settings);

  return (
    <>
      <div className="srow">
        <div className="slab">
          <strong id="st-colours">Colours</strong>
          <span>Colours and lettering for the whole app</span>
        </div>
        <RadioGroup
          labelledBy="st-colours"
          className="sctl st-choices"
          itemClassName="choice"
          value={current.scheme}
          options={SCHEMES}
          onChange={(scheme) => setAppearance({ scheme })}
        />
      </div>
      <div className="srow">
        <div className="slab">
          <strong id="st-corners">Corners</strong>
          <span>The shape of buttons, boxes and windows</span>
        </div>
        <RadioGroup
          labelledBy="st-corners"
          className="sctl st-choices"
          itemClassName="choice"
          value={current.corners}
          options={CORNERS}
          onChange={(corners) => setAppearance({ corners })}
        />
      </div>
      <div className="srow">
        <div className="slab">
          <strong id="st-mode">Light or dark</strong>
          <span>Dark is easier on the eyes at night</span>
        </div>
        <div className="sctl">
          <RadioGroup labelledBy="st-mode" className="seg" value={current.mode} options={MODES} onChange={(mode) => setAppearance({ mode })} />
        </div>
      </div>
    </>
  );
}
