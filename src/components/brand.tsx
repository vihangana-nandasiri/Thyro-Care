import { HeartPulse } from "lucide-react";
import Link from "next/link";

export function Brand() {
  return (
    <Link href="/" className="brand">
      <span className="brand-mark">
        <HeartPulse size={23} strokeWidth={1.6} />
      </span>
      <span>
        thyro<span className="brand-light">care</span>
        <small>HERE FOR YOUR NEXT CHAPTER</small>
      </span>
    </Link>
  );
}
