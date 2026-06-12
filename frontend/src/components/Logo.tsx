import Image from "next/image";

type LogoProps = {
  size?: number;
  variant?: "mark" | "hero";
  className?: string;
  priority?: boolean;
};

export function Logo({
  size = 36,
  variant = "mark",
  className = "",
  priority = false,
}: LogoProps) {
  return (
    <Image
      src="/logo.svg"
      alt=""
      width={size}
      height={size}
      priority={priority}
      className={`shrink-0 ${variant === "hero" ? "drop-shadow-xl" : ""} ${className}`.trim()}
      aria-hidden
    />
  );
}
