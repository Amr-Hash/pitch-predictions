/** Fan-zone palette accents for cup groups (Direction C). */
const CUP_GROUP_ACCENTS: Record<string, { bar: string; pill: string }> = {
  A: { bar: "bg-fan-500", pill: "bg-fan-100 text-fan-800" },
  B: { bar: "bg-royal-500", pill: "bg-royal-100 text-royal-800" },
  C: { bar: "bg-pitch-500", pill: "bg-pitch-100 text-pitch-800" },
  D: { bar: "bg-electric-500", pill: "bg-electric-100 text-electric-800" },
  E: { bar: "bg-gold-500", pill: "bg-gold-100 text-gold-900" },
  F: { bar: "bg-fan-600", pill: "bg-fan-100 text-fan-900" },
  G: { bar: "bg-royal-600", pill: "bg-royal-100 text-royal-900" },
  H: { bar: "bg-pitch-600", pill: "bg-pitch-100 text-pitch-900" },
  I: { bar: "bg-electric-600", pill: "bg-electric-100 text-electric-900" },
  J: { bar: "bg-fan-400", pill: "bg-fan-50 text-fan-900" },
  K: { bar: "bg-royal-400", pill: "bg-royal-50 text-royal-900" },
  L: { bar: "bg-pitch-400", pill: "bg-pitch-50 text-pitch-900" },
};

const DEFAULT_ACCENT = { bar: "bg-pitch-500", pill: "bg-night-700 text-white" };

export function cupGroupAccent(letter: string | null | undefined) {
  if (!letter) return DEFAULT_ACCENT;
  return CUP_GROUP_ACCENTS[letter.toUpperCase()] ?? DEFAULT_ACCENT;
}

export const MATCHDAY_SECTION_CLASS: Record<number, string> = {
  1: "section-heading-fan",
  2: "section-heading-royal",
  3: "section-heading-pitch",
};
