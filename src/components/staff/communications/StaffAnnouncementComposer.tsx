/**
 * Desktop announcement composer. Same fields, same server function
 * (staffCreateAnnouncement) and same validation (announcementFields in
 * programme-ops.functions.ts) as the mobile AnnouncementComposer in
 * components/programme/Staff.tsx — a new presentation over identical
 * underlying behaviour. Scheduling, attachments and an email fallback are
 * not supported by the announcement engine, so none of them appear here.
 */
import { useState } from "react";
import { Megaphone } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { everyone, type Audience, type Priority } from "@/lib/programme/logic";
import { useStaffCreateAnnouncement } from "@/lib/useStaffCommunications";
import { StaffAudiencePicker } from "./StaffAudiencePicker";

const inputClass =
  "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";

export function StaffAnnouncementComposer({
  open,
  onClose,
  cohortId,
  groups,
  students,
}: {
  open: boolean;
  onClose: () => void;
  cohortId: string;
  groups: { id: string; name: string }[];
  students: { userId: string; displayName: string; handle: string | null }[];
}) {
  const create = useStaffCreateAnnouncement(cohortId);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState<Priority>("normal");
  const [pinned, setPinned] = useState(false);
  const [requiresAck, setRequiresAck] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [audience, setAudience] = useState<Audience>(everyone);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setTitle("");
    setBody("");
    setPriority("normal");
    setPinned(false);
    setRequiresAck(false);
    setLinkUrl("");
    setAudience(everyone);
    setError(null);
  };

  const handleClose = () => {
    if (create.isPending) return;
    reset();
    onClose();
  };

  const publish = () => {
    setError(null);
    if (!title.trim() || !body.trim()) {
      setError("A title and a message are required.");
      return;
    }
    create.mutate(
      {
        title: title.trim(),
        body: body.trim(),
        priority,
        pinned,
        requiresAck,
        linkUrl: linkUrl.trim() || null,
        // Same rule the mobile composer uses: normal-priority posts don't
        // trigger an in-app notification, important/urgent ones do.
        notify: priority !== "normal",
        audience,
      },
      {
        onSuccess: () => {
          reset();
          onClose();
        },
        onError: () => setError("We couldn't post that. Try again."),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="size-4.5 text-primary" /> New announcement
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-[12.5px] font-semibold text-muted-foreground">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputClass}
              placeholder="e.g. Bus times for Thursday's tiyul"
              maxLength={160}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[12.5px] font-semibold text-muted-foreground">Message</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              className={inputClass}
              maxLength={4000}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[12.5px] font-semibold text-muted-foreground">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                className={inputClass}
              >
                <option value="normal">Normal</option>
                <option value="important">Important — highlighted</option>
                <option value="urgent">Urgent — alerts everyone</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[12.5px] font-semibold text-muted-foreground">
                Link (optional)
              </label>
              <input
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                className={inputClass}
                placeholder="https://"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-[13px] font-medium">
              <input
                type="checkbox"
                checked={pinned}
                onChange={(e) => setPinned(e.target.checked)}
                className="size-3.5"
              />
              Pin to the top
            </label>
            <label className="flex items-center gap-2 text-[13px] font-medium">
              <input
                type="checkbox"
                checked={requiresAck}
                onChange={(e) => setRequiresAck(e.target.checked)}
                className="size-3.5"
              />
              Require acknowledgement
            </label>
          </div>

          <div className="space-y-1.5">
            <label className="text-[12.5px] font-semibold text-muted-foreground">
              Who sees this
            </label>
            <StaffAudiencePicker
              value={audience}
              onChange={setAudience}
              groups={groups}
              students={students}
            />
          </div>

          {error ? <p className="text-[12.5px] font-medium text-destructive">{error}</p> : null}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-xl border border-border px-4 py-2 text-[13px] font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={publish}
              disabled={create.isPending}
              className="rounded-xl bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground disabled:opacity-60"
            >
              {create.isPending ? "Posting…" : "Post announcement"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
