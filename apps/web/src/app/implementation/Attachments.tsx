import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState, type DragEvent, type ReactNode } from "react";
import { Download, Paperclip, Pencil, Trash2, Upload, X } from "lucide-react";

import { useAuthStore } from "../auth/store";
import { API_URL } from "../lib/config";
import { implementationApi, type Attachment } from "./api";

const ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.webp";
const MAX_BYTES = 200 * 1024 * 1024;

/**
 * Sends one file to the gateway, which holds the storage credentials.
 *
 * Plain fetch rather than apiFetch: that helper sets a JSON content type, and a
 * multipart upload needs the browser to write its own boundary.
 */
export async function uploadAttachment(askId: string, file: File): Promise<void> {
  if (file.size > MAX_BYTES) {
    throw new Error(`${file.name} is over the 200 MB limit`);
  }
  const body = new FormData();
  body.append("file", file);

  const token = useAuthStore.getState().token;
  const res = await fetch(`${API_URL}/api/v1/implementation/${askId}/attachments`, {
    method: "POST",
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body,
  });
  if (!res.ok) {
    throw new Error(
      res.status === 413
        ? `${file.name} is too large`
        : res.status === 503
          ? "File storage is not configured on the server"
          : `Could not attach ${file.name}`,
    );
  }
}

/** Drop target and file picker. Shared by the staged and saved lists. */
function DropZone({
  busy,
  onFiles,
  children,
}: {
  busy: boolean;
  onFiles: (files: File[]) => void;
  children?: ReactNode;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const drop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) onFiles(files);
  };

  return (
    <>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={drop}
        onClick={() => input.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            input.current?.click();
          }
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed px-md py-md text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45 ${
          dragging
            ? "border-accent bg-accent-soft"
            : "border-line hover:border-accent hover:bg-surface-muted/60"
        }`}
      >
        {busy ? (
          <span className="text-xs text-fg-muted">Uploading…</span>
        ) : (
          <>
            <Upload className="h-4 w-4 text-fg-subtle" />
            <span className="text-xs text-fg-muted">
              Drop files here, or <span className="text-accent">browse</span>
            </span>
            <span className="text-[10px] text-fg-subtle">
              PDF, Word, Excel or images · up to 200 MB
            </span>
          </>
        )}
      </div>

      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? []);
          if (picked.length > 0) onFiles(picked);
          e.target.value = "";
        }}
      />

      {children}
    </>
  );
}

/**
 * Files chosen while the ask is still being written.
 *
 * There is no ask to hang them off yet, so they are held here and uploaded by
 * the dialog the moment the ask exists. Without this the Attach field in the
 * New-ask dialog would be inert, which is not what the spec draws.
 */
export function StagedAttachments({
  files,
  onChange,
}: {
  files: File[];
  onChange: (files: File[]) => void;
}) {
  return (
    <DropZone busy={false} onFiles={(picked) => onChange([...files, ...picked])}>
      {files.length > 0 && (
        <ul className="mt-xs flex flex-col gap-1">
          {files.map((f, i) => (
            <li
              key={`${f.name}-${i}`}
              className="flex items-center gap-1 rounded-md border border-line px-sm py-1 text-xs"
            >
              <Paperclip className="h-3 w-3 shrink-0 text-fg-subtle" />
              <span className="min-w-0 flex-1 truncate" title={f.name}>
                {f.name}
                <span className="ml-1 text-[10px] text-fg-subtle">
                  {readableSize(f.size)}
                </span>
              </span>
              <span className="shrink-0 text-[10px] text-fg-subtle">
                uploads on save
              </span>
              <IconAction
                label={`Remove ${f.name}`}
                danger
                onClick={() => onChange(files.filter((_, j) => j !== i))}
              >
                <Trash2 className="h-3 w-3" />
              </IconAction>
            </li>
          ))}
        </ul>
      )}
    </DropZone>
  );
}

/** Files on a saved ask: drop more, open, rename or remove. */
export function Attachments({ askId }: { askId: string }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const query = useQuery({
    queryKey: ["askAttachments", askId],
    queryFn: () => implementationApi.attachments(askId),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["askAttachments", askId] });
    void queryClient.invalidateQueries({ queryKey: ["askEvents", askId] });
  };

  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      for (const file of files) await uploadAttachment(askId, file);
    },
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError: (err: unknown) =>
      setError(err instanceof Error ? err.message : "Could not attach that file"),
  });

  const rename = useMutation({
    mutationFn: ({ id, fileName }: { id: string; fileName: string }) =>
      implementationApi.rename(askId, id, fileName),
    onSuccess: () => {
      setRenaming(null);
      invalidate();
    },
    onError: () => setError("Could not rename that file"),
  });

  const detach = useMutation({
    mutationFn: (fileId: string) => implementationApi.detach(askId, fileId),
    onSuccess: invalidate,
    onError: () => setError("Could not remove that file"),
  });

  const open = async (fileId: string) => {
    try {
      const { url } = await implementationApi.attachmentUrl(askId, fileId);
      window.open(url, "_blank", "noopener");
    } catch {
      setError("Could not open that file");
    }
  };

  const files = query.data ?? [];

  return (
    <div className="flex flex-col gap-xs">
      <DropZone busy={upload.isPending} onFiles={(picked) => upload.mutate(picked)} />

      {files.length > 0 && (
        <ul className="flex flex-col gap-1">
          {files.map((f) => (
            <li
              key={f.id}
              className="flex items-center gap-1 rounded-md border border-line px-sm py-1 text-xs"
            >
              <Paperclip className="h-3 w-3 shrink-0 text-fg-subtle" />

              {renaming === f.id ? (
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => setRenaming(null)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && draft.trim()) {
                      rename.mutate({ id: f.id, fileName: draft.trim() });
                    }
                    if (e.key === "Escape") setRenaming(null);
                  }}
                  className="min-w-0 flex-1 rounded border border-accent bg-surface px-1 text-xs text-fg outline-none"
                />
              ) : (
                <span className="min-w-0 flex-1 truncate" title={f.fileName}>
                  {f.fileName}
                  <span className="ml-1 text-[10px] text-fg-subtle">
                    {readableSize(f.sizeBytes)}
                  </span>
                </span>
              )}

              <IconAction label={`Open ${f.fileName}`} onClick={() => open(f.id)}>
                <Download className="h-3 w-3" />
              </IconAction>
              <IconAction
                label={`Rename ${f.fileName}`}
                onClick={() => {
                  setRenaming(f.id);
                  setDraft(f.fileName);
                }}
              >
                <Pencil className="h-3 w-3" />
              </IconAction>
              <IconAction
                label={`Remove ${f.fileName}`}
                danger
                onClick={() => {
                  if (window.confirm(`Remove ${f.fileName}?`)) detach.mutate(f.id);
                }}
              >
                <Trash2 className="h-3 w-3" />
              </IconAction>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p className="flex items-center gap-1 text-xs text-bad-fg">
          {error}
          <button type="button" onClick={() => setError(null)} aria-label="Dismiss">
            <X className="h-3 w-3" />
          </button>
        </p>
      )}
    </div>
  );
}

function IconAction({
  label,
  onClick,
  children,
  danger = false,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`shrink-0 rounded p-1 text-fg-subtle transition-colors ${
        danger ? "hover:text-bad-fg" : "hover:text-accent"
      }`}
    >
      {children}
    </button>
  );
}

function readableSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export type { Attachment };
