interface LogoProps {
  gradientId: string;
}

export function Logo({ gradientId }: LogoProps) {
  return (
    <svg
      className="w-8 h-8 shrink-0"
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="VALYNT logo"
    >
      <title>VALYNT Logo</title>
      <defs>
        <linearGradient
          id={gradientId}
          x1="0"
          y1="0"
          x2="40"
          y2="40"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#18C3A5" />
          <stop offset="100%" stopColor="#5A5D67" />
        </linearGradient>
      </defs>
      <path
        d="M20 6L8 34M20 6L32 34M20 6V34"
        stroke={`url(#${gradientId})`}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
