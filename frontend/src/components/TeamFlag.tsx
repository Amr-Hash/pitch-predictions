type TeamFlagSize = "xs" | "sm" | "md" | "lg";

const BOX: Record<TeamFlagSize, string> = {
  xs: "h-4 w-6",
  sm: "h-5 w-7",
  md: "h-10 w-14",
  lg: "h-12 w-16",
};

interface Props {
  src?: string | null;
  size?: TeamFlagSize;
  className?: string;
}

/** Renders a team flag without cropping (object-contain inside a fixed box). */
export function TeamFlag({ src, size = "md", className = "" }: Props) {
  if (!src) return null;

  return (
    <div
      className={`${BOX[size]} shrink-0 overflow-hidden rounded bg-white/90 shadow-sm ring-1 ring-black/5 ${className}`}
    >
      <img src={src} alt="" className="h-full w-full object-contain p-px" />
    </div>
  );
}
