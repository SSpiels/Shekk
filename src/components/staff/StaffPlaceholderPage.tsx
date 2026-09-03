/**
 * Phase 3 intentionally stops here: this demonstrates page hierarchy/layout
 * for every V1 destination without building any of their real functionality.
 */
import type { LucideIcon } from "lucide-react";

export function StaffPlaceholderPage({
  icon: Icon,
  description,
}: {
  icon: LucideIcon;
  description: string;
}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border px-6 py-16 text-center">
      <span className="flex size-11 items-center justify-center rounded-2xl bg-muted text-foreground/60">
        <Icon className="size-5" />
      </span>
      <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}
