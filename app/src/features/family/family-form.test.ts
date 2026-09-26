import { describe, expect, it } from "vitest";
import type { InvoiceTemplate } from "../../types";
import { calculateTermData } from "../../utils/terms";
import { generateInvoice } from "../../utils/invoice-generator";
import {
  costProblem,
  costText,
  familySchema,
  formValuesFrom,
  instrumentOptions,
  INSTRUMENTS,
  previewFor,
  toFields,
  type FamilyFormValues,
} from "./family-form";

// Fictional family (PRODUCT.md: no real student data).
const saved: InvoiceTemplate = {
  id: "fam-1",
  recipient: "Sarah",
  students: "Amara and Tobi",
  instrument: "piano",
  day: "Monday",
  cost: 22.5,
  skippedLessonDates: ["2026-09-14"],
  createdAt: new Date(2026, 0, 1),
  updatedAt: new Date(2026, 0, 1),
};

const valid: FamilyFormValues = { recipient: "Sarah", students: "Amara and Tobi", instrument: "piano", day: "Monday", cost: "22.50" };

// 1st half autumn term 2026: 1 Sep to 25 Oct, 8 lessons.
const autumn1 = calculateTermData(new Date(2026, 8, 15));

const errorsFor = (values: FamilyFormValues) => {
  const result = familySchema.safeParse(values);
  return result.success ? {} : Object.fromEntries(result.error.issues.map((i) => [i.path[0], i.message]));
};

describe("formValuesFrom", () => {
  it("starts a new family blank", () => {
    expect(formValuesFrom(null)).toEqual({ recipient: "", students: "", instrument: "", day: "", cost: "" });
  });

  it("starts from the saved values", () => {
    expect(formValuesFrom(saved)).toEqual(valid);
  });

  it("asks for the day again when the saved one isn't a weekday", () => {
    expect(formValuesFrom({ ...saved, day: "monday" }).day).toBe("");
  });
});

describe("costText", () => {
  it("shows pence when that saves back unchanged", () => {
    expect(costText(22.5)).toBe("22.50");
    expect(costText(25)).toBe("25.00");
    expect(costText(19.99)).toBe("19.99");
  });

  it("never rounds a saved cost", () => {
    expect(costText(22.555)).toBe("22.555");
    expect(parseFloat(costText(22.555))).toBe(22.555);
  });
});

describe("validation (v1.0.1's rules)", () => {
  it("accepts a complete family", () => {
    expect(errorsFor(valid)).toEqual({});
  });

  it("requires every field", () => {
    const errors = errorsFor({ recipient: "", students: "", instrument: "", day: "", cost: "" });
    expect(Object.keys(errors).sort()).toEqual(["cost", "day", "instrument", "recipient", "students"]);
  });

  it("treats spaces alone as empty", () => {
    expect(Object.keys(errorsFor({ ...valid, recipient: "  ", students: " " })).sort()).toEqual(["recipient", "students"]);
  });

  it("requires a day of the week", () => {
    expect(errorsFor({ ...valid, day: "monday" })).toHaveProperty("day");
  });

  it("accepts an instrument that isn't on the list (e.g. imported)", () => {
    expect(errorsFor({ ...valid, instrument: "violin" })).toEqual({});
  });

  it.each(["22.50", "22", "0.5", " 22.5 ", "1e2"])("accepts the cost %j", (cost) => {
    expect(costProblem(cost)).toBeNull();
  });

  it.each(["", "  ", "0", "0.00", "-5", "abc", "£22", "22,50", "0x10", "Infinity"])("rejects the cost %j", (cost) => {
    expect(costProblem(cost)).not.toBeNull();
    expect(errorsFor({ ...valid, cost })).toHaveProperty("cost");
  });

  it("says what to do about a cost", () => {
    expect(costProblem("")).toMatch(/Enter the cost/);
    expect(costProblem("£22")).toMatch(/just the number/);
    expect(costProblem("0")).toMatch(/more than £0/);
  });
});

describe("toFields", () => {
  it("saves only the five fields, with the cost read by parseFloat", () => {
    expect(toFields(valid)).toEqual({ recipient: "Sarah", students: "Amara and Tobi", instrument: "piano", day: "Monday", cost: 22.5 });
  });
});

describe("instrumentOptions", () => {
  it("lists the instruments lowercase, shown capitalised", () => {
    const options = instrumentOptions("");
    expect(options.map((o) => o.value)).toEqual([...INSTRUMENTS]);
    expect(options.find((o) => o.value === "bass guitar")?.label).toBe("Bass guitar");
  });

  it("keeps a saved instrument that isn't on the list", () => {
    const options = instrumentOptions("violin");
    expect(options).toHaveLength(INSTRUMENTS.length + 1);
    expect(options[options.length - 1]).toEqual({ value: "violin", label: "Violin" });
    expect(instrumentOptions("piano")).toHaveLength(INSTRUMENTS.length);
  });

  it("tells a saved spelling apart from the list's", () => {
    expect(instrumentOptions("Piano").slice(-1)[0]).toEqual({ value: "Piano", label: "Piano (as saved)" });
  });
});

describe("previewFor", () => {
  it("has nothing to show outside term time", () => {
    expect(previewFor(valid, null, null)).toEqual({ kind: "no-term" });
  });

  it("waits until the details are complete and valid", () => {
    expect(previewFor({ ...valid, cost: "" }, autumn1, null)).toEqual({ kind: "incomplete" });
    expect(previewFor({ ...valid, day: "" }, autumn1, null)).toEqual({ kind: "incomplete" });
  });

  it("shows a new family's half-term invoice", () => {
    const preview = previewFor(valid, autumn1, null);
    if (preview.kind !== "ready") throw new Error("expected a preview");
    expect(preview.lessonCount).toBe(8);
    expect(preview.cost).toBe(22.5);
    expect(preview.totalCost).toBe(180);
    expect(preview.subject).toBe("Invoice for Piano Lessons 1st half autumn term 2026");
    expect(preview.lessons.map((l) => l.key)).toEqual([
      "2026-09-07",
      "2026-09-14",
      "2026-09-21",
      "2026-09-28",
      "2026-10-05",
      "2026-10-12",
      "2026-10-19",
      "2026-10-26",
    ]);
    // Monday 26 October is after the half-term's last day (billing issue B1).
    expect(preview.lessons.filter((l) => l.afterTerm).map((l) => l.key)).toEqual(["2026-10-26"]);
  });

  it("keeps the family's unticked lessons, as saving would", () => {
    const preview = previewFor(valid, autumn1, saved);
    if (preview.kind !== "ready") throw new Error("expected a preview");
    expect(preview.lessonCount).toBe(7);
    expect(preview.totalCost).toBe(157.5);
    expect(preview.lessons.find((l) => l.key === "2026-09-14")?.charged).toBe(false);
    // Exactly what the billing code gives for the template that would be saved.
    const invoice = generateInvoice({ ...saved, ...toFields(valid) }, autumn1!);
    expect([preview.lessonCount, preview.totalCost, preview.subject]).toEqual([invoice.lessonCount, invoice.totalCost, invoice.subject]);
  });

  it("ignores unticks that no longer match a lesson after the day changes", () => {
    const preview = previewFor({ ...valid, day: "Tuesday" }, autumn1, saved);
    if (preview.kind !== "ready") throw new Error("expected a preview");
    expect(preview.lessonCount).toBe(8);
    expect(preview.lessons.every((l) => l.charged)).toBe(true);
  });

  it("uses the typed cost", () => {
    const preview = previewFor({ ...valid, cost: "25" }, autumn1, saved);
    if (preview.kind !== "ready") throw new Error("expected a preview");
    expect(preview.totalCost).toBe(175);
  });
});
