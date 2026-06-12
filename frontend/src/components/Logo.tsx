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
  const src = variant === "hero" ? "/logo.png" : "/logo.svg";

  return (
    <Image
      src={src}
      alt=""
      width={size}
      height={size}
      priority={priority}
      className={`shrink-0 ${className}`}
      aria-hidden
    />
  );
}
