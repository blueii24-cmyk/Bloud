import { useId } from "react";
import { cn } from "../../utils/cn";
import type { ArtSpec } from "../../types";

interface ArtworkProps {
  art: ArtSpec;
  className?: string;
  /** "video" crops to 16:9 */
  ratio?: "square" | "video";
  circle?: boolean;
  label?: string;
}

/**
 * Original generative cover art. Renders `art.imageUrl` when present, so real
 * covers can be dropped in without touching call sites.
 */
export function Artwork({ art, className, ratio = "square", circle, label }: ArtworkProps) {
  const uid = useId().replace(/:/g, "");
  const [a, b, c] = art.palette;
  const s = art.seed % 7;
  const g = `g${uid}`;
  const sheen = `s${uid}`;

  return (
    <div
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn(
        "relative block shrink-0 select-none overflow-hidden bg-surface",
        ratio === "square" ? "aspect-square" : "aspect-video",
        circle ? "rounded-full" : "rounded-art",
        className,
      )}
    >
      {art.imageUrl ? (
        <img src={art.imageUrl} alt="" className="size-full object-cover" draggable={false} />
      ) : (
        <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full">
          <defs>
            <linearGradient id={g} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={b} />
              <stop offset="1" stopColor={a} />
            </linearGradient>
            <linearGradient id={sheen} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#fff" stopOpacity="0.14" />
              <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
              <stop offset="1" stopColor="#000" stopOpacity="0.22" />
            </linearGradient>
          </defs>
          <Pattern pattern={art.pattern} a={a} b={b} c={c} s={s} grad={g} />
          <rect width="100" height="100" fill={`url(#${sheen})`} />
        </svg>
      )}
    </div>
  );
}

function Pattern({ pattern, a, b, c, s, grad }: { pattern: ArtSpec["pattern"]; a: string; b: string; c: string; s: number; grad: string }) {
  switch (pattern) {
    case "sun":
      return (
        <>
          <rect width="100" height="100" fill={`url(#${grad})`} />
          <circle cx={50 + (s - 3)} cy="46" r="24" fill={c} />
          {[58, 64, 70, 76].map((y, i) => (
            <rect key={y} x="0" y={y} width="100" height={1.5 + i * 0.9} fill={b} opacity="0.85" />
          ))}
          <rect x="0" y="82" width="100" height="18" fill={b} />
        </>
      );
    case "rings":
      return (
        <>
          <rect width="100" height="100" fill={b} />
          {[44, 36, 28, 20, 12].map((r, i) => (
            <circle key={r} cx={44 + s * 2} cy={56 - s} r={r} fill="none" stroke={i % 2 ? c : a} strokeWidth="4" opacity={0.95 - i * 0.12} />
          ))}
          <circle cx={44 + s * 2} cy={56 - s} r="5" fill={c} />
        </>
      );
    case "stripes":
      return (
        <>
          <rect width="100" height="100" fill={b} />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <rect key={i} x={-30 + i * 24 + s * 2} y="-10" width="12" height="130" fill={i % 2 ? c : a} transform="rotate(24 50 50)" opacity={i % 2 ? 0.9 : 1} />
          ))}
          <circle cx="50" cy="50" r="17" fill={b} />
          <circle cx="50" cy="50" r="9" fill={a} />
        </>
      );
    case "waves":
      return (
        <>
          <rect width="100" height="100" fill={`url(#${grad})`} />
          {[0, 1, 2, 3].map((i) => (
            <path
              key={i}
              d={`M0 ${40 + i * 15} Q25 ${28 + i * 15 - s} 50 ${40 + i * 15} T100 ${40 + i * 15} V100 H0 Z`}
              fill={[c, a, c, b][i]}
              opacity={[0.35, 0.55, 0.7, 1][i]}
            />
          ))}
        </>
      );
    case "grid":
      return (
        <>
          <rect width="100" height="100" fill={b} />
          <circle cx="50" cy="50" r="26" fill={a} />
          <rect x="0" y="50" width="100" height="50" fill={b} />
          {[0, 1, 2, 3, 4].map((i) => (
            <line key={`h${i}`} x1="0" x2="100" y1={56 + i * i * 2.6} y2={56 + i * i * 2.6} stroke={c} strokeWidth="0.9" opacity="0.8" />
          ))}
          {Array.from({ length: 9 }, (_, i) => (
            <line key={`v${i}`} x1="50" y1="52" x2={50 + (i - 4) * 28} y2="100" stroke={c} strokeWidth="0.9" opacity="0.7" />
          ))}
        </>
      );
    case "split":
      return (
        <>
          <rect width="100" height="100" fill={a} />
          <rect x={46 + s} width="60" height="100" fill={b} />
          <circle cx={46 + s} cy="50" r="26" fill={c} />
          <circle cx={46 + s} cy="50" r="10" fill={b} />
        </>
      );
    case "orbit":
      return (
        <>
          <rect width="100" height="100" fill={b} />
          <circle cx="50" cy="50" r="34" fill={a} opacity="0.35" />
          <circle cx="50" cy="50" r="20" fill={a} />
          <ellipse cx="50" cy="50" rx="42" ry="14" fill="none" stroke={c} strokeWidth="2" transform={`rotate(${-20 - s * 4} 50 50)`} />
          <circle cx={78 + s} cy={36 - s} r="5" fill={c} />
        </>
      );
    case "dunes":
    default:
      return (
        <>
          <rect width="100" height="100" fill={c} />
          <circle cx={30 + s * 5} cy="30" r="12" fill={a} opacity="0.9" />
          <path d={`M0 ${62} Q30 ${40 + s} 55 58 T100 50 V100 H0 Z`} fill={a} opacity="0.55" />
          <path d="M0 78 Q35 58 65 74 T100 68 V100 H0 Z" fill={b} opacity="0.8" />
          <path d="M0 92 Q40 76 100 88 V100 H0 Z" fill={b} />
        </>
      );
  }
}
