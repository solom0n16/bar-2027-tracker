// One icon family: 24px grid, round caps and joins, 1.8 stroke unless a glyph
// needs a heavier line to hold at small sizes. Every icon is decorative — the
// control or text beside it carries the name — so all are aria-hidden.

import type { ReactNode } from 'react';

function Svg({
  children,
  className = 'size-4',
  strokeWidth = 1.8,
  fill = 'none',
}: {
  children: ReactNode;
  className?: string;
  strokeWidth?: number;
  fill?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill={fill}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

type P = { className?: string };

export const SearchIcon = ({ className }: P) => (
  <Svg className={className}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M16 16l4.5 4.5" />
  </Svg>
);

export const MinusIcon = ({ className }: P) => (
  <Svg className={className}>
    <path d="M6 12h12" />
  </Svg>
);

export const FlagIcon = ({ filled = false, className }: P & { filled?: boolean }) => (
  <Svg className={className} strokeWidth={1.6} fill={filled ? 'currentColor' : 'none'}>
    <path d="M5.5 21V4.5" />
    <path d="M5.5 5.2h11l-2.4 3.9 2.4 3.9h-11z" />
  </Svg>
);

export const BackIcon = ({ className = 'size-3.5' }: P) => (
  <Svg className={className} strokeWidth={2}>
    <path d="M14 6l-6 6 6 6" />
  </Svg>
);

export const ArrowRightIcon = ({ className = 'size-3.5' }: P) => (
  <Svg className={className} strokeWidth={2}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Svg>
);

export const CloseIcon = ({ className }: P) => (
  <Svg className={className}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
);

export const LockIcon = ({ small = false }: { small?: boolean }) => (
  <Svg className={small ? 'size-2.5' : 'size-3.5'} strokeWidth={1.6}>
    <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
    <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
  </Svg>
);

export const HomeIcon = ({ className = 'size-5' }: P) => (
  <Svg className={className}>
    <rect x="3.5" y="3.5" width="7" height="7" rx="1.8" />
    <rect x="13.5" y="3.5" width="7" height="4.5" rx="1.8" />
    <rect x="13.5" y="11" width="7" height="9.5" rx="1.8" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="1.8" />
  </Svg>
);

export const BookIcon = ({ className = 'size-5' }: P) => (
  <Svg className={className}>
    <path d="M4 5.5A2 2 0 0 1 6 3.5h13v14H6a2 2 0 0 0-2 2z" />
    <path d="M4 19.5a2 2 0 0 0 2 2h13v-4" />
    <path d="M8.5 8h6" />
  </Svg>
);

export const CalendarIcon = ({ className = 'size-5' }: P) => (
  <Svg className={className}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </Svg>
);

export const FlameIcon = ({ className = 'size-5' }: P) => (
  <Svg className={className}>
    <path d="M12 21c-3.6 0-6.5-2.6-6.5-6.2 0-3.9 3.2-5.6 4-9.8 2.4 1.5 4.3 4 4.6 6.7.9-.6 1.6-1.6 1.8-2.9 1.6 1.6 2.6 3.7 2.6 6 0 3.6-2.9 6.2-6.5 6.2z" />
    <path d="M12 21c-1.5 0-2.7-1.1-2.7-2.7 0-1.8 1.5-2.6 2.2-4.3 1.9 1 3.2 2.5 3.2 4.3 0 1.6-1.2 2.7-2.7 2.7z" />
  </Svg>
);

export const ClockIcon = ({ className = 'size-4' }: P) => (
  <Svg className={className}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Svg>
);

export const TargetIcon = ({ className = 'size-5' }: P) => (
  <Svg className={className}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="4.5" />
    <circle cx="12" cy="12" r="0.8" fill="currentColor" />
  </Svg>
);

export const TrophyIcon = ({ className = 'size-5' }: P) => (
  <Svg className={className}>
    <path d="M8 4h8v5a4 4 0 0 1-8 0z" />
    <path d="M8 6H4.5a3 3 0 0 0 3.5 4M16 6h3.5a3 3 0 0 1-3.5 4" />
    <path d="M12 13v4M8.5 20.5h7M10 17h4l.5 3.5h-5z" />
  </Svg>
);

export const CheckIcon = ({ className = 'size-3.5' }: P) => (
  <Svg className={className} strokeWidth={2.4}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Svg>
);

export const AlertIcon = ({ className = 'size-5' }: P) => (
  <Svg className={className}>
    <path d="M12 4 2.8 19.5h18.4z" />
    <path d="M12 10v4.2M12 17.2v.1" />
  </Svg>
);

export const PlayIcon = ({ className = 'size-4' }: P) => (
  <Svg className={className} fill="currentColor" strokeWidth={1.4}>
    <path d="M8 5.5v13l10.5-6.5z" />
  </Svg>
);

/** The brand mark: a daisy head in the plate's own colours. */
export function DaisyMark({ className = 'size-9' }: P) {
  const rays = Array.from({ length: 12 }, (_, i) => i * 30);
  return (
    <svg aria-hidden="true" viewBox="0 0 40 40" className={className}>
      <circle cx="20" cy="20" r="19" fill="var(--c-plate)" />
      {rays.map((deg) => (
        <ellipse
          key={deg}
          cx="20"
          cy="10.5"
          rx="3.1"
          ry="7"
          fill="var(--c-ray)"
          stroke="var(--c-leaf)"
          strokeWidth="0.8"
          transform={`rotate(${deg} 20 20)`}
        />
      ))}
      <circle cx="20" cy="20" r="5.2" fill="var(--c-disc)" stroke="var(--c-disc-edge)" strokeWidth="1.1" />
    </svg>
  );
}
