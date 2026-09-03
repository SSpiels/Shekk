/**
 * Compact fallback for tablet-portrait and phone widths — not a second copy
 * of the mobile student app's MobileNav/PhoneFrame, just a horizontal strip
 * so Programme OS degrades gracefully rather than being unusable below the
 * sidebar's lg breakpoint. Desktop is still the intended product.
 */
import { Link, useRouterState } from "@tanstack/react-router";
import { STAFF_NAV, STAFF_SETTINGS_NAV, activeStaffNavId } from "@/lib/staff-nav";

export function StaffMobileNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active = activeStaffNavId(pathname);
  const items = [...STAFF_NAV, STAFF_SETTINGS_NAV];

  return (
    <nav className="scrollbar-none flex gap-1.5 overflow-x-auto border-b border-border bg-card px-3 py-2 lg:hidden">
      {items.map((item) => (
        <Link
          key={item.id}
          to={item.to}
          className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[12.5px] font-bold ${
            active === item.id
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
