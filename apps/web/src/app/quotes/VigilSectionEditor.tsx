import { memo } from "react";

import { Button, Card, Icon } from "../ui";
import type {
  BulletsSection,
  FieldsSection,
  SplitSection,
  TableSection,
  VigilSection,
} from "./vigil";

/**
 * The editor for one proposal section.
 *
 * Dispatches on the section's shape rather than its identity, so the sixteen
 * sections of the VIGIL document need six editors between them and a new section
 * needs none at all. Every list here grows and shrinks: the boilerplate is a
 * starting point, and an SLA row that could not be deleted would be retyped into
 * Word instead.
 */
export const VigilSectionEditor = memo(function VigilSectionEditor({
  section,
  onChange,
  onRemove,
}: {
  section: VigilSection;
  onChange: (next: VigilSection) => void;
  onRemove: () => void;
}) {
  return (
    <Card>
      <div className="mb-md flex items-start justify-between gap-md">
        <input
          className={TITLE}
          value={section.title}
          aria-label="Section title"
          onChange={(e) => onChange({ ...section, title: e.target.value })}
        />
        <Button
          size="sm"
          variant="ghost"
          onClick={onRemove}
          title="Remove this section from the proposal"
        >
          <span className="text-bad-fg">Remove</span>
        </Button>
      </div>

      {section.kind === "text" && (
        <textarea
          rows={4}
          className={INPUT}
          value={section.body}
          onChange={(e) => onChange({ ...section, body: e.target.value })}
        />
      )}

      {section.kind === "note" && (
        <div className="rounded-md border-l-4 border-accent bg-accent-soft/40 p-sm">
          <textarea
            rows={3}
            className={`${INPUT} bg-surface`}
            value={section.body}
            onChange={(e) => onChange({ ...section, body: e.target.value })}
          />
          <p className="mt-xs text-[11px] text-fg-subtle">
            Printed as a boxed standard clause.
          </p>
        </div>
      )}

      {section.kind === "fields" && (
        <FieldsEditor section={section} onChange={onChange} />
      )}
      {section.kind === "bullets" && (
        <BulletsEditor section={section} onChange={onChange} />
      )}
      {section.kind === "table" && (
        <TableEditor section={section} onChange={onChange} />
      )}
      {section.kind === "split" && (
        <SplitEditor section={section} onChange={onChange} />
      )}
    </Card>
  );
});

function FieldsEditor({
  section,
  onChange,
}: {
  section: FieldsSection;
  onChange: (next: VigilSection) => void;
}) {
  const set = (rows: FieldsSection["rows"]) => onChange({ ...section, rows });

  return (
    <div className="flex flex-col gap-xs">
      {section.rows.map((row, i) => (
        <div key={i} className="flex items-center gap-xs">
          <input
            className={`${INPUT} w-2/5`}
            value={row.label}
            aria-label={`Label ${i + 1}`}
            onChange={(e) =>
              set(replace(section.rows, i, { ...row, label: e.target.value }))
            }
          />
          <input
            className={INPUT}
            value={row.value}
            aria-label={`Value for ${row.label || `row ${i + 1}`}`}
            onChange={(e) =>
              set(replace(section.rows, i, { ...row, value: e.target.value }))
            }
          />
          <RemoveRow onClick={() => set(removeAt(section.rows, i))} />
        </div>
      ))}
      <AddRow onClick={() => set([...section.rows, { label: "", value: "" }])} />
    </div>
  );
}

function BulletsEditor({
  section,
  onChange,
}: {
  section: BulletsSection;
  onChange: (next: VigilSection) => void;
}) {
  const set = (items: string[]) => onChange({ ...section, items });

  return (
    <div className="flex flex-col gap-xs">
      {section.items.map((item, i) => (
        <div key={i} className="flex items-center gap-xs">
          <Icon name="check" size={13} className="shrink-0 text-ok-fg" />
          <input
            className={INPUT}
            value={item}
            aria-label={`Item ${i + 1}`}
            onChange={(e) => set(replace(section.items, i, e.target.value))}
          />
          <RemoveRow onClick={() => set(removeAt(section.items, i))} />
        </div>
      ))}
      <AddRow onClick={() => set([...section.items, ""])} />
    </div>
  );
}

function TableEditor({
  section,
  onChange,
}: {
  section: TableSection;
  onChange: (next: VigilSection) => void;
}) {
  const setRows = (rows: string[][]) => onChange({ ...section, rows });

  return (
    <div className="flex flex-col gap-xs">
      <div className="flex items-center gap-xs">
        {section.columns.map((col, c) => (
          <input
            key={c}
            className={`${INPUT} bg-surface-muted text-[11px] font-semibold uppercase tracking-wide`}
            value={col}
            aria-label={`Column ${c + 1} heading`}
            onChange={(e) =>
              onChange({
                ...section,
                columns: replace(section.columns, c, e.target.value),
              })
            }
          />
        ))}
        <span className="w-7 shrink-0" />
      </div>

      {section.rows.map((row, r) => (
        <div key={r} className="flex items-start gap-xs">
          {section.columns.map((_, c) => (
            <textarea
              key={c}
              rows={1}
              className={INPUT}
              value={row[c] ?? ""}
              aria-label={`Row ${r + 1}, column ${c + 1}`}
              onChange={(e) =>
                setRows(replace(section.rows, r, replace(pad(row, section.columns.length), c, e.target.value)))
              }
            />
          ))}
          <RemoveRow onClick={() => setRows(removeAt(section.rows, r))} />
        </div>
      ))}
      <AddRow
        onClick={() => setRows([...section.rows, section.columns.map(() => "")])}
      />
    </div>
  );
}

function SplitEditor({
  section,
  onChange,
}: {
  section: SplitSection;
  onChange: (next: VigilSection) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-md md:grid-cols-2">
      {(["left", "right"] as const).map((side) => {
        const titleKey = side === "left" ? "leftTitle" : "rightTitle";
        const list = section[side];

        return (
          <div key={side} className="flex flex-col gap-xs">
            <input
              className={`${INPUT} font-semibold ${
                side === "left" ? "text-ok-fg" : "text-bad-fg"
              }`}
              value={section[titleKey]}
              aria-label={`${side} column heading`}
              onChange={(e) =>
                onChange({ ...section, [titleKey]: e.target.value })
              }
            />
            {list.map((item, i) => (
              <div key={i} className="flex items-center gap-xs">
                <span
                  className={`shrink-0 text-xs ${
                    side === "left" ? "text-ok-fg" : "text-bad-fg"
                  }`}
                >
                  {side === "left" ? "✓" : "✗"}
                </span>
                <input
                  className={INPUT}
                  value={item}
                  aria-label={`${side} item ${i + 1}`}
                  onChange={(e) =>
                    onChange({ ...section, [side]: replace(list, i, e.target.value) })
                  }
                />
                <RemoveRow
                  onClick={() =>
                    onChange({ ...section, [side]: removeAt(list, i) })
                  }
                />
              </div>
            ))}
            <AddRow onClick={() => onChange({ ...section, [side]: [...list, ""] })} />
          </div>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function AddRow({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="self-start rounded-md px-xs py-xs text-xs font-medium text-accent hover:bg-accent-soft/50"
    >
      + Add row
    </button>
  );
}

function RemoveRow({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Remove row"
      title="Remove row"
      className="w-7 shrink-0 rounded-md py-xs text-fg-subtle hover:bg-surface-muted hover:text-bad-fg"
    >
      <Icon name="close" size={13} />
    </button>
  );
}

const INPUT =
  "w-full min-w-0 rounded-md border border-line bg-surface px-sm py-xs text-xs text-fg " +
  "focus:border-accent focus:outline-none";

const TITLE =
  "min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-xs py-xs " +
  "text-sm font-semibold text-fg hover:border-line focus:border-accent focus:outline-none";

/** Immutable single-element replace — every editor above needs it. */
function replace<T>(list: T[], index: number, value: T): T[] {
  const next = list.slice();
  next[index] = value;
  return next;
}

function removeAt<T>(list: T[], index: number): T[] {
  return list.filter((_, i) => i !== index);
}

/** Widens a short row after a column is added, so the index is always in range. */
function pad(row: string[], length: number): string[] {
  const next = row.slice();
  while (next.length < length) next.push("");
  return next;
}
