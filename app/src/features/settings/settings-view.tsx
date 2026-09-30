// The Settings screen (docs/ui.md "Settings"): a blue band, a list of
// sections on the left and one scrolling page of groups. Everything applies
// straight away, except the email wording and the term dates, which have their own Save buttons.
import { useEffect, useRef, useState, type ComponentType, type MouseEvent } from "react";
import { ArrowLeft, CalendarDays, Database, FileText, Gauge, Info, Mail, Palette, PoundSterling, type LucideProps } from "lucide-react";
import { useAppActions } from "../app-context";
import { prefersReducedMotion } from "../../lib/appearance";
import { activeSectionIndex } from "./settings-logic";
import { AppearanceGroup } from "./appearance-group";
import { GmailGroup } from "./gmail-group";
import { WordingGroup } from "./wording-group";
import { TermsGroup } from "./terms-group";
import { ChargingGroup } from "./charging-group";
import { DataGroup } from "./data-group";
import { PerformanceGroup } from "./performance-group";
import { AboutGroup } from "./about-group";
import "./settings.css";

type SettingsSection = "appearance" | "gmail" | "wording" | "terms" | "charging" | "data" | "performance" | "about";

interface Section {
  id: SettingsSection;
  label: string;
  Icon: ComponentType<LucideProps>;
  Body: ComponentType;
}

const SECTIONS: Section[] = [
  { id: "appearance", label: "Appearance", Icon: Palette, Body: AppearanceGroup },
  { id: "gmail", label: "Gmail", Icon: Mail, Body: GmailGroup },
  { id: "wording", label: "Email wording", Icon: FileText, Body: WordingGroup },
  { id: "terms", label: "Term dates", Icon: CalendarDays, Body: TermsGroup },
  { id: "charging", label: "How lessons are charged", Icon: PoundSterling, Body: ChargingGroup },
  { id: "data", label: "Your data", Icon: Database, Body: DataGroup },
  { id: "performance", label: "Performance", Icon: Gauge, Body: PerformanceGroup },
  { id: "about", label: "About & help", Icon: Info, Body: AboutGroup },
];

/** Space kept above a group scrolled to the top (the page's own top padding). */
const TOP_GAP = 28;

export function SettingsView() {
  const { back, appVersion } = useAppActions();
  const page = useRef<HTMLDivElement>(null);
  const groups = useRef(new Map<SettingsSection, HTMLElement>());
  const headings = useRef(new Map<SettingsSection, HTMLHeadingElement>());
  const [active, setActive] = useState<SettingsSection>("appearance");
  // While a section chosen in the list is scrolled to, it stays marked.
  const chosen = useRef<{ id: SettingsSection; top: number } | null>(null);
  const settle = useRef<number | undefined>(undefined);

  const topOf = (id: SettingsSection) => {
    const el = groups.current.get(id);
    const box = page.current;
    if (!el || !box) return 0;
    return el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop;
  };

  const spy = () => {
    const box = page.current;
    if (!box) return;
    const tops = SECTIONS.map((s) => topOf(s.id));
    const i = activeSectionIndex(tops, box.scrollTop, box.clientHeight, box.scrollHeight);
    if (i >= 0) setActive(SECTIONS[i].id);
  };

  const release = () => {
    window.clearTimeout(settle.current);
    settle.current = window.setTimeout(() => {
      const target = chosen.current;
      chosen.current = null;
      // Scrolled somewhere else meanwhile (or the page moved): follow the page.
      if (target && page.current && Math.abs(page.current.scrollTop - target.top) > 4) spy();
    }, 160);
  };

  /** Scrolls a group to the top; the caller marks it in the list. */
  const scrollTo = (id: SettingsSection) => {
    const box = page.current;
    if (!box) return;
    const wanted = id === SECTIONS[0].id ? 0 : Math.max(0, topOf(id) - TOP_GAP);
    const top = Math.min(wanted, box.scrollHeight - box.clientHeight);
    chosen.current = { id, top };
    box.scrollTo({ top, behavior: prefersReducedMotion() ? "auto" : "smooth" });
    release();
  };

  useEffect(() => () => window.clearTimeout(settle.current), []);

  // Room after the last group, so every group, even a short one near the end,
  // can scroll up to the top. Without it the page runs out of scroll first:
  // the list jumped from Email wording straight to About & help, and choosing
  // a late group couldn't bring it to the top.
  const tail = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = page.current;
    const pad = tail.current;
    if (!box || !pad) return;
    const fit = () => {
      const last = groups.current.get(SECTIONS[SECTIONS.length - 1].id);
      if (!last) return;
      // Exactly enough for the last group to reach the top: less the page's
      // bottom padding and the gap before this spacer, which already add room.
      const style = getComputedStyle(box);
      const extra = parseFloat(style.paddingBottom) + parseFloat(style.rowGap || "0");
      pad.style.height = `${Math.max(0, box.clientHeight - TOP_GAP - last.offsetHeight - extra)}px`;
    };
    const watch = new ResizeObserver(fit);
    watch.observe(box);
    for (const el of groups.current.values()) watch.observe(el);
    fit();
    return () => watch.disconnect();
  }, []);

  const onScroll = () => {
    if (chosen.current) release();
    else spy();
  };

  const onNav = (id: SettingsSection, e: MouseEvent<HTMLButtonElement>) => {
    setActive(id);
    scrollTo(id);
    // From the keyboard, carry on from the group's heading.
    if (e.detail === 0) headings.current.get(id)?.focus({ preventScroll: true });
  };

  return (
    <>
      <header className="band">
        <div>
          <h1>Settings</h1>
          <p className="band-meta">Changes are saved straight away.</p>
        </div>
        <div className="band-side">
          <button type="button" className="bbtn bbtn--ghost" onClick={back}>
            <ArrowLeft aria-hidden="true" />
            Back to the register
          </button>
        </div>
      </header>

      <div className="page-work st-page">
        <nav className="nav scroll st-nav" aria-label="Settings sections">
          {SECTIONS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              aria-current={active === id ? "true" : undefined}
              aria-controls={id}
              data-tip={label}
              onClick={(e) => onNav(id, e)}
            >
              <Icon aria-hidden="true" />
              <span className="st-nav-label">{label}</span>
            </button>
          ))}
          {appVersion && <p className="nav-foot">Student Invoice {appVersion}</p>}
        </nav>

        <div className="set scroll st-set" ref={page} onScroll={onScroll}>
          {SECTIONS.map(({ id, label, Body }) => (
            <section
              key={id}
              id={id}
              className="grp"
              aria-labelledby={`${id}-title`}
              ref={(el) => {
                if (el) groups.current.set(id, el);
                else groups.current.delete(id);
              }}
            >
              <h2
                id={`${id}-title`}
                tabIndex={-1}
                ref={(el) => {
                  if (el) headings.current.set(id, el);
                  else headings.current.delete(id);
                }}
              >
                {label}
              </h2>
              <Body />
            </section>
          ))}
          <div ref={tail} aria-hidden="true" style={{ flex: "none" }} />
        </div>
      </div>
    </>
  );
}
