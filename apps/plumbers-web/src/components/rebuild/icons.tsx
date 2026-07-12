/**
 * Inline SVG icon set for the rebuild design system (02 §1.5).
 * Functional icons only — stroke 1.75, currentColor. The banned set
 * (trophies, medals, shields, seals, badges) is deliberately absent.
 */

interface IconProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

function svgProps({ size = 16, className, style }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    className,
    style,
    "aria-hidden": true as const,
  };
}

export function PhoneIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path
        d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PinIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" fill="none" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="12" cy="10" r="3" fill="none" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.75" />
      <path d="M12 7v5l3 2" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

export function StarIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path
        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
        fill="currentColor"
      />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M8.5 12.2l2.4 2.4 4.6-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function TriangleIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path
        d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M12 9v4M12 17h.01" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

export function OctagonIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path
        d="M7.86 2h8.28L22 7.86v8.28L16.14 22H7.86L2 16.14V7.86L7.86 2z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

export function ChevronIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function BookIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path
        d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V4a2 2 0 0 0-2-2H6.5A2.5 2.5 0 0 0 4 4.5v15z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="1.75" />
      <path d="M21 21l-4.5-4.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

export function CrosshairIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.75" />
      <path d="M12 1.5v5M12 17.5v5M1.5 12h5M17.5 12h5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <circle cx="12" cy="12" r="2.5" fill="currentColor" />
    </svg>
  );
}
