import { BLUE, TEAL } from "@/constants/colors";

/** Tailwind size units used by the existing UI (numeric prop preserved). */
const sizeClassMap: Record<number, string> = {
  8: "w-8 h-8",
  9: "w-9 h-9",
  10: "w-10 h-10",
};

export function Avatar({ name, size = 8, src }: { name: string; size?: number; src?: string }) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  const sizeClass = sizeClassMap[size] ?? sizeClassMap[8];
  return src ? (
    <img src={src} alt={name} className={`${sizeClass} rounded-full object-cover`} />
  ) : (
    <div
      className={`${sizeClass} rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}
      style={{ background: `linear-gradient(135deg, ${BLUE}, ${TEAL})` }}
    >
      {initials}
    </div>
  );
}
