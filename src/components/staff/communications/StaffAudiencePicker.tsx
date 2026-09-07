/**
 * Desktop audience picker for the announcement composer. Same Audience shape
 * and the same three kinds (everyone/groups/individuals) as the mobile
 * AudiencePicker in components/programme/Bits.tsx — a new presentation over
 * identical underlying behaviour, not a second audience model.
 */
import { useState } from "react";
import { Search } from "lucide-react";
import { audienceLabel, type Audience, type AudienceKind } from "@/lib/programme/logic";

const KIND_LABEL: Record<AudienceKind, string> = {
  everyone: "Everyone",
  groups: "Specific groups",
  individuals: "Specific students",
};

export function StaffAudiencePicker({
  value,
  onChange,
  groups,
  students,
}: {
  value: Audience;
  onChange: (next: Audience) => void;
  groups: { id: string; name: string }[];
  students: { userId: string; displayName: string; handle: string | null }[];
}) {
  const [studentQuery, setStudentQuery] = useState("");
  const set = (patch: Partial<Audience>) => onChange({ ...value, ...patch });

  const filteredStudents = studentQuery.trim()
    ? students.filter((st) =>
        `${st.displayName} ${st.handle ?? ""}`
          .toLowerCase()
          .includes(studentQuery.trim().toLowerCase()),
      )
    : students;

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-3 gap-2">
        {(Object.keys(KIND_LABEL) as AudienceKind[]).map((kind) => (
          <button
            key={kind}
            type="button"
            onClick={() => set({ kind })}
            className={`rounded-xl border px-3 py-2 text-[12.5px] font-semibold transition-colors ${
              value.kind === kind
                ? "border-primary bg-primary-soft text-primary"
                : "border-border bg-background text-muted-foreground hover:bg-muted"
            }`}
          >
            {KIND_LABEL[kind]}
          </button>
        ))}
      </div>

      {value.kind === "groups" ? (
        groups.length === 0 ? (
          <p className="text-[12px] text-muted-foreground">
            No groups in this cohort yet — set one up on the Students page first.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {groups.map((g) => {
              const on = value.groupIds.includes(g.id);
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() =>
                    set({
                      groupIds: on
                        ? value.groupIds.filter((x) => x !== g.id)
                        : [...value.groupIds, g.id],
                    })
                  }
                  className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold ${
                    on
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background"
                  }`}
                >
                  {g.name}
                </button>
              );
            })}
          </div>
        )
      ) : null}

      {value.kind === "individuals" ? (
        <div className="space-y-1.5">
          <label className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              value={studentQuery}
              onChange={(e) => setStudentQuery(e.target.value)}
              placeholder="Search students…"
              className="w-full min-w-0 bg-transparent outline-none placeholder:text-muted-foreground"
            />
          </label>
          <div className="max-h-44 overflow-y-auto rounded-xl border border-border">
            {filteredStudents.length === 0 ? (
              <p className="px-3 py-2.5 text-[12px] text-muted-foreground">No students match.</p>
            ) : (
              filteredStudents.map((st) => {
                const on = value.userIds.includes(st.userId);
                return (
                  <label
                    key={st.userId}
                    className="flex cursor-pointer items-center gap-2.5 border-b border-border px-3 py-2 text-[13px] last:border-0 hover:bg-muted/40"
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() =>
                        set({
                          userIds: on
                            ? value.userIds.filter((x) => x !== st.userId)
                            : [...value.userIds, st.userId],
                        })
                      }
                      className="size-3.5"
                    />
                    <span className="min-w-0 truncate font-medium">{st.displayName}</span>
                    {st.handle ? (
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        @{st.handle}
                      </span>
                    ) : null}
                  </label>
                );
              })
            )}
          </div>
        </div>
      ) : null}

      <p className="text-[11.5px] text-muted-foreground">
        Reaches:{" "}
        <span className="font-semibold text-foreground">{audienceLabel(value, groups)}</span>
      </p>
    </div>
  );
}
