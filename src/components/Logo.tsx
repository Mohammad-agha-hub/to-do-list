export function Logo({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <defs>
        <linearGradient id="momentum-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7cc4fa" />
          <stop offset="1" stopColor="#2b8ceb" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="14" fill="url(#momentum-g)" />
      <path d="M13 31 L21 22 L27 27 L36 16" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="36" cy="16" r="3.2" fill="#fff" />
    </svg>
  );
}
