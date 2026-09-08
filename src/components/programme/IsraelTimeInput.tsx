import { useId } from "react";
import { israelTimeCandidates, type IsraelTimeResolution } from "@/lib/programme/logic";

/** Same validation and occurrence choice in mobile and desktop editors. */
export function IsraelTimeInput({
  value,
  onChange,
  resolution,
  onResolution,
  label,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  resolution?: IsraelTimeResolution;
  onResolution: (resolution: IsraelTimeResolution | undefined) => void;
  label: string;
  className?: string;
}) {
  const id = useId();
  let candidates: ReturnType<typeof israelTimeCandidates> = [];
  let error: string | null = null;
  if (value) {
    try {
      candidates = israelTimeCandidates(value);
      if (!candidates.length)
        error = "This time does not exist in Israel. Choose a time outside the clock change.";
    } catch (e) {
      error = e instanceof Error ? e.message : "Enter a valid date and time.";
    }
  }
  return (
    <div className="space-y-1.5">
      <input
        aria-label={label}
        aria-describedby={`${id}-help`}
        aria-invalid={Boolean(error)}
        type="datetime-local"
        step="60"
        value={value}
        className={className}
        onChange={(e) => {
          onChange(e.target.value);
          onResolution(undefined);
        }}
      />
      <div id={`${id}-help`} className="text-xs">
        {error ? (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        ) : null}
        {candidates.length > 1 ? (
          <label className="block space-y-1">
            <span>This time occurs twice in Israel. Choose an occurrence.</span>
            <select
              aria-label={`${label} occurrence`}
              value={resolution ?? ""}
              className={className}
              onChange={(e) =>
                onResolution((e.target.value || undefined) as IsraelTimeResolution | undefined)
              }
            >
              <option value="">Choose earlier or later</option>
              <option value="earlier">Earlier ({candidates[0]!.offset})</option>
              <option value="later">Later ({candidates[candidates.length - 1]!.offset})</option>
            </select>
          </label>
        ) : null}
      </div>
    </div>
  );
}
