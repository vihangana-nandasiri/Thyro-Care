import { Heart } from "lucide-react";
import { BLUE, TEAL } from "@/constants/colors";

type BrandLogoProps = {
  /** Matches existing w-8 / w-9 / w-12 mark boxes */
  size?: "sm" | "md" | "lg";
  className?: string;
};

const boxSizes = {
  sm: "w-8 h-8 rounded-xl",
  md: "w-9 h-9 rounded-xl",
  lg: "w-12 h-12 rounded-2xl",
} as const;

const iconSizes = {
  sm: "w-4 h-4",
  md: "w-5 h-5",
  lg: "w-6 h-6",
} as const;

/** Gradient heart mark used across landing, auth, sidebar, and chat. */
export function BrandLogo({ size = "sm", className = "" }: BrandLogoProps) {
  return (
    <div
      className={`${boxSizes[size]} flex items-center justify-center flex-shrink-0 ${className}`}
      style={{ background: `linear-gradient(135deg, ${BLUE}, ${TEAL})` }}
    >
      <Heart className={`${iconSizes[size]} text-white`} />
    </div>
  );
}
