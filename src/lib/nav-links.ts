export type NavLink = {
  href: string;
  label: string;
  descriptor?: string;
};

/** Shared navigation for desktop, mobile, and footer. */
export const navLinks: NavLink[] = [
  { href: "/setups", label: "Browse" },
  {
    href: "/engineer",
    label: "Engineer",
    descriptor: "Hard-earned racing knowledge and calibration data.",
  },
  { href: "/garage", label: "Garage", descriptor: "Log laps and compare setup changes." },
  { href: "/requests", label: "Requests" },
];
