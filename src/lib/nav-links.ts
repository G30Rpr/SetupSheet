export type NavLink = {
  href: string;
  label: string;
  /** One-line descriptor, shown where there's room for it (e.g. the footer). */
  descriptor?: string;
};

/**
 * Primary navigation: Browse, Engineer, Requests (P3). Garage and Leaderboard
 * are intentionally not here — Garage lives in the account menu/upload areas,
 * Leaderboard is footer-only and hidden until enough people contribute.
 * The Upload route stays reachable via the header's Upload Setup button.
 */
export const navLinks: NavLink[] = [
  { href: "/setups", label: "Browse" },
  {
    href: "/engineer",
    label: "Engineer",
    descriptor: "Hard-earned racing knowledge and calibration data.",
  },
  { href: "/requests", label: "Requests" },
];
