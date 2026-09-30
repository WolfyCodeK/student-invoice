// Settings → How lessons are charged: the three charging options, all off to
// begin with (docs/billing.md; docs/proposals/2026-09-v1.1.2-feedback.md,
// items 8 to 10). Each applies to the register and every invoice straight
// away; half-terms that have ended keep what they charged.
import { Switch } from "../../components/ui/switch";
import { useAppStore } from "../../stores/app-store";
import type { ChargingOptions } from "../../types";

interface Option {
  key: keyof ChargingOptions;
  title: string;
  about: string;
}

const OPTIONS: Option[] = [
  {
    key: "insideHalfTermOnly",
    title: "Only charge lessons inside the half-term",
    about:
      "Off: each family is charged for as many weeks as the half-term spans, so a lesson in the week after it ends can be charged. On: only lessons from the half-term's first day to its last day.",
  },
  {
    key: "skipBankHolidays",
    title: "Don't charge lessons on bank holidays",
    about:
      "Lessons on an England and Wales bank holiday are shown unticked, marked as a bank holiday. If one went ahead, tick it on the register to charge it.",
  },
  {
    key: "nextHalfTermInHolidays",
    title: "In the holidays, show the next half-term",
    about: "Off: outside term time there's nothing to invoice until the half-term starts. On: the register shows the next half-term, ready to invoice.",
  },
];

export function ChargingGroup() {
  const charging = useAppStore((s) => s.settings.charging);
  const updateSettings = useAppStore((s) => s.updateSettings);

  const set = (key: keyof ChargingOptions, on: boolean) => {
    const { [key]: _old, ...rest } = charging ?? {};
    const next: ChargingOptions = on ? { ...rest, [key]: true } : rest;
    updateSettings({ charging: Object.keys(next).length > 0 ? next : undefined });
  };

  return (
    <>
      <p className="st-lead">
        These change what's charged, on the register and in every invoice. They're all off to begin with, which charges exactly as earlier versions
        did. Half-terms that have ended keep what they charged.
      </p>
      {OPTIONS.map(({ key, title, about }) => (
        <div key={key} className="srow srow--top">
          <div className="slab">
            <label htmlFor={`charging-${key}`}>
              <strong>{title}</strong>
            </label>
            <span>{charging?.[key] ? "On" : "Off"}</span>
          </div>
          <div className="sctl st-perf">
            <Switch id={`charging-${key}`} checked={charging?.[key] === true} onCheckedChange={(on) => set(key, on)} aria-describedby={`charging-${key}-about`} />
            <p id={`charging-${key}-about`} className="st-perf-note">
              {about}
            </p>
          </div>
        </div>
      ))}
    </>
  );
}
