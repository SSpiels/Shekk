import { avatarPreset } from "@/lib/avatars";

export function initialsOf(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join("");
}

export function Avatar({
  name,
  src,
  className = "size-10",
  textClassName = "text-sm",
}: {
  name: string;
  src?: string | null;
  className?: string;
  textClassName?: string;
}) {
  const preset = avatarPreset(src);
  if (preset) {
    return (
      <span
        aria-hidden
        className={`${className} ${textClassName} flex shrink-0 items-center justify-center rounded-full leading-none`}
        style={{ backgroundImage: preset.grad }}
      >
        {preset.emoji}
      </span>
    );
  }
  if (src) {
    return (
      <img
        src={src}
        alt={`${name} profile photo`}
        className={`${className} shrink-0 rounded-full object-cover`}
      />
    );
  }
  return (
    <span
      className={`${className} ${textClassName} flex shrink-0 items-center justify-center rounded-full bg-primary-soft font-semibold text-primary`}
    >
      {initialsOf(name) || "S"}
    </span>
  );
}
