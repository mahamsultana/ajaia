// Small inline icon set (Lucide-style strokes) so we don't add an icon dependency.
const PATHS: Record<string, React.ReactNode> = {
  bold: <path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z" />,
  italic: <path d="M19 4h-9M14 20H5M15 4 9 20" />,
  underline: <path d="M6 4v6a6 6 0 0 0 12 0V4M4 20h16" />,
  bullets: (
    <>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <circle cx="4.5" cy="6" r="1" fill="currentColor" />
      <circle cx="4.5" cy="12" r="1" fill="currentColor" />
      <circle cx="4.5" cy="18" r="1" fill="currentColor" />
    </>
  ),
  numbers: <path d="M10 6h10M10 12h10M10 18h10M4 4h1v4M4 8h2M4 14.5a1.2 1.2 0 0 1 2 .8L4 18h2" />,
  quote: <path d="M4 17c0-5 1.5-8 5-10M13 17c0-5 1.5-8 5-10M4 17h4v-4H4zM13 17h4v-4h-4z" />,
  undo: <path d="M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />,
  redo: <path d="m15 14 5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />,
  trash: <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v5M14 11v5" />,
  upload: <path d="M12 16V4M7 9l5-5 5 5M4 16v4h16v-4" />,
  plus: <path d="M12 5v14M5 12h14" />,
  back: <path d="M19 12H5M11 18l-6-6 6-6" />,
  share: <path d="M16 6a3 3 0 1 0 0-.01M8 12a3 3 0 1 0 0-.01M16 18a3 3 0 1 0 0-.01M10.6 13.5l2.8 1.6M13.4 8.9l-2.8 1.6" />,
  download: <path d="M12 4v12M7 11l5 5 5-5M4 20h16" />,
  pencil: <path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />,
  lock: <path d="M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3" />,
  users: <path d="M9 11a3.5 3.5 0 1 0 0-.01M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14c2 .8 3 2.8 3 6" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  logout: <path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" />,
};

export type IconName = keyof typeof PATHS;

export default function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
