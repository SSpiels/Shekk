/**
 * Programme OS gate.
 *
 * `/staff` is not in RequireAccount's OPEN_PREFIXES, so a signed-out visitor
 * never reaches this component at all — the global gate in
 * components/RequireAccount.tsx already redirects to `/auth?next=/staff`
 * (preserving the destination via the same `next` search param every other
 * protected route uses) before this ever mounts. By the time this renders,
 * authChecked && signedIn is guaranteed. What's left to decide here is
 * staff-specific: does this account have a programme_staff row at all.
 *
 * Deliberately not the desktop shell yet — that's Phase 3. This only gates
 * and renders whatever the child route is (a placeholder for now).
 */
import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { ShieldOff } from "lucide-react";
import { Splash } from "@/components/Splash";
import { useStaffSession } from "@/lib/useProgrammeHub";

export const Route = createFileRoute("/staff")({
  head: () => ({
    meta: [
      { title: "Programme OS · Shekk" },
      { name: "description", content: "Operations console for Shekk programme staff." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: StaffGate,
});

function NotStaffScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-muted text-foreground/60">
        <ShieldOff className="size-6" />
      </span>
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          This account isn&rsquo;t set up as programme staff
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
          Programme OS is for staff accounts a programme has added. If you should have access, ask
          your programme owner to invite you — otherwise this isn&rsquo;t the right door for you.
        </p>
      </div>
      <Link
        to="/"
        className="tap mt-2 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
      >
        Back to Shekk
      </Link>
    </div>
  );
}

function StaffGate() {
  const { isStaff, loading } = useStaffSession();

  if (loading) return <Splash message="Checking your programme access…" />;
  if (!isStaff) return <NotStaffScreen />;

  return <Outlet />;
}
