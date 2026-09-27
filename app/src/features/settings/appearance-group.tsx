// Settings → Appearance: colours, corners, light or dark (docs/ui.md
// "Appearance"). The choices are in appearance-options.tsx, shared with the
// panel shown after the v1.1.0 update; each applies straight away.
import { RadioGroup } from "./radio-group";
import { CORNER_OPTIONS, MODE_OPTIONS, SCHEME_OPTIONS, useAppearance } from "./appearance-options";

export function AppearanceGroup() {
  const [current, setAppearance] = useAppearance();

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
          options={SCHEME_OPTIONS}
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
          options={CORNER_OPTIONS}
          onChange={(corners) => setAppearance({ corners })}
        />
      </div>
      <div className="srow">
        <div className="slab">
          <strong id="st-mode">Light or dark</strong>
          <span>Dark is easier on the eyes at night</span>
        </div>
        <div className="sctl">
          <RadioGroup labelledBy="st-mode" className="seg" value={current.mode} options={MODE_OPTIONS} onChange={(mode) => setAppearance({ mode })} />
        </div>
      </div>
    </>
  );
}
