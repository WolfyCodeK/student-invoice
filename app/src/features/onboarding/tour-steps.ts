// The guided tour's steps, in the order a teacher works at half-term (docs/ui.md).
// Each step highlights the element marked `data-tour="<target>"`. Steps whose
// element is missing or hidden (for example no families yet) are skipped.

export type TourTarget =
  | "term"
  | "register"
  | "marks"
  | "totals"
  | "pupil"
  | "family-actions"
  | "draft-all"
  | "titlebar-actions";

export interface TourStep {
  /** The `data-tour` attribute value of the element to highlight. */
  target: TourTarget;
  title: string;
  /** One or two plain sentences on how to use it. */
  body: string;
}

export const TOUR_STEPS: TourStep[] = [
  {
    target: "term",
    title: "This half-term",
    body: "The app works out which half-term it is and its dates. There's nothing to set.",
  },
  {
    target: "register",
    title: "Your families",
    body: "Each row is a family you teach. Click a row to see its invoice.",
  },
  {
    target: "marks",
    title: "Lessons",
    body: "Each mark is a lesson this half-term. If a lesson didn't happen, click its mark to untick it, and it comes off the bill. Click again to put it back.",
  },
  {
    target: "totals",
    title: "The total",
    body: "Lessons times the cost per lesson. It updates as soon as you untick a lesson.",
  },
  {
    target: "pupil",
    title: "The invoice email",
    body: "This is the email for the family you picked. Copy it, or save it as a draft in Gmail.",
  },
  {
    target: "family-actions",
    title: "Adding and changing families",
    body: "Add a new family, or change a family's details and cost.",
  },
  {
    target: "draft-all",
    title: "Draft all",
    body: "Connect Gmail once. At half-term, Draft all saves every invoice as a Gmail draft. Then open Gmail, check them and press Send.",
  },
  {
    target: "titlebar-actions",
    title: "Help and settings",
    body: "Settings has your colours, light or dark, email wording and backups. The question mark shows this tour again.",
  },
];
