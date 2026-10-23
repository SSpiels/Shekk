/**
 * The switcher inside Programme OS: shows the active programme and lets staff move
 * to another workspace they belong to, or back to their personal Shekk, without
 * signing out. Used as a card in the desktop sidebar and as a compact pill on small
 * screens. Every option is a workspace the server already confirmed the member has.
 */

import { Check, ChevronsUpDown, House, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useWorkspace } from "@/lib/useWorkspace";

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

export function WorkspaceMenu({ variant }: { variant: "card" | "pill" | "rail" }) {
  const { workspaces, activeProgrammeId, openWorkspace, openPersonal, switching } = useWorkspace();
  const active = workspaces.find((w) => w.programmeId === activeProgrammeId) ?? null;
  if (!active) return null;

  const cohortLine = active.cohort
    ? `${active.cohort.name}${active.cohort.year ? ` · ${active.cohort.year}` : ""}`
    : "No cohort yet";

  const trigger =
    variant === "rail" ? (
      <button
        type="button"
        aria-label={`Switch workspace — ${active.programmeName}`}
        title={active.programmeName}
        className="grad-balance relative flex size-11 items-center justify-center overflow-hidden rounded-xl text-ink-foreground shadow-card outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <span className="card-sheen pointer-events-none absolute inset-0" aria-hidden />
        {switching ? (
          <Loader2 className="relative size-4 animate-spin" />
        ) : (
          <span className="relative font-display text-sm font-bold">{initialsOf(active.programmeName)}</span>
        )}
      </button>
    ) : variant === "card" ? (
      <button
        type="button"
        aria-label="Switch workspace"
        className="grad-balance relative w-full overflow-hidden rounded-2xl px-4 py-3.5 text-left text-ink-foreground shadow-card outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <span className="card-sheen pointer-events-none absolute inset-0" aria-hidden />
        <span className="relative flex items-center gap-2">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13.5px] font-bold leading-tight">{active.programmeName}</span>
            <span className="mt-0.5 block truncate text-[11.5px] opacity-75">{cohortLine}</span>
          </span>
          {switching ? (
            <Loader2 className="size-4 shrink-0 animate-spin opacity-80" />
          ) : (
            <ChevronsUpDown className="size-4 shrink-0 opacity-80" />
          )}
        </span>
      </button>
    ) : (
      <button
        type="button"
        aria-label="Switch workspace"
        className="flex shrink-0 items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-[12.5px] font-bold text-ink-foreground"
      >
        <span className="max-w-[9.5rem] truncate">{active.programmeName}</span>
        <ChevronsUpDown className="size-3.5 opacity-80" />
      </button>
    );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side={variant === "rail" ? "right" : "bottom"}
        className="w-[min(16rem,calc(100vw-1.5rem))]"
      >
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Programme workspaces
        </DropdownMenuLabel>
        {workspaces.map((w) => (
          <DropdownMenuItem
            key={w.programmeId}
            onSelect={() => {
              if (w.programmeId !== activeProgrammeId) void openWorkspace(w.programmeId);
            }}
            className="flex items-center gap-2"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{w.programmeName}</span>
              <span className="block truncate text-xs capitalize text-muted-foreground">
                {w.role}
                {w.cohort ? ` · ${w.cohort.name}` : ""}
              </span>
            </span>
            {w.programmeId === activeProgrammeId ? <Check className="size-4 shrink-0 text-primary" /> : null}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void openPersonal()} className="flex items-center gap-2">
          <House className="size-4 shrink-0 text-muted-foreground" />
          <span className="text-sm font-semibold">Personal Shekk</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
