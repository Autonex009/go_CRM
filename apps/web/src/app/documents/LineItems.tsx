import { memo } from "react";

import { formatMoneyExact } from "../lib/money";
import { IconButton } from "../ui";
import type { DocumentItemInput } from "./types";
import { lineTotal } from "./totals";

interface LineItemsProps {
  items: DocumentItemInput[];
  currency: string;
  readOnly: boolean;
  onChange: (index: number, patch: Partial<DocumentItemInput>) => void;
  onRemove: (index: number) => void;
}

/**
 * The line-item grid.
 *
 * A table on desktop and stacked cards below `md` — a five-column money table at
 * phone width is unusable, and horizontal scrolling for *input* fields is worse
 * than reflowing them.
 */
export const LineItems = memo(function LineItems({
  items,
  currency,
  readOnly,
  onChange,
  onRemove,
}: LineItemsProps) {
  return (
    <div className="flex flex-col">
      {/* Header only makes sense once the columns line up. */}
      <div className="hidden gap-sm border-b border-line pb-sm text-xs font-medium uppercase tracking-wide text-fg-muted md:grid md:grid-cols-[1fr_80px_110px_80px_80px_110px_32px]">
        <span>Description</span>
        <span className="text-right">Qty</span>
        <span className="text-right">Unit price</span>
        <span className="text-right">Disc %</span>
        <span className="text-right">Tax %</span>
        <span className="text-right">Line total</span>
        <span />
      </div>

      {items.map((item, index) => (
        <div
          key={index}
          className="grid gap-sm border-b border-line py-sm md:grid-cols-[1fr_80px_110px_80px_80px_110px_32px] md:items-center"
        >
          <Cell label="Description">
            <input
              value={item.description}
              readOnly={readOnly}
              onChange={(e) => onChange(index, { description: e.target.value })}
              placeholder="What are you selling?"
              className={inputClass}
            />
          </Cell>

          <Cell label="Qty" align="right">
            <NumberInput
              value={item.quantity}
              readOnly={readOnly}
              onChange={(quantity) => onChange(index, { quantity })}
            />
          </Cell>

          <Cell label="Unit price" align="right">
            <NumberInput
              value={item.unitPrice}
              readOnly={readOnly}
              onChange={(unitPrice) => onChange(index, { unitPrice })}
            />
          </Cell>

          <Cell label="Discount %" align="right">
            <NumberInput
              value={item.discountPercent}
              max={100}
              readOnly={readOnly}
              onChange={(discountPercent) => onChange(index, { discountPercent })}
            />
          </Cell>

          <Cell label="Tax %" align="right">
            <NumberInput
              value={item.taxPercent}
              max={100}
              readOnly={readOnly}
              onChange={(taxPercent) => onChange(index, { taxPercent })}
            />
          </Cell>

          <Cell label="Line total" align="right">
            <span className="block py-sm text-right text-sm font-medium tabular-nums text-fg md:py-0">
              {formatMoneyExact(lineTotal(item), currency)}
            </span>
          </Cell>

          <div className="flex justify-end">
            {!readOnly && (
              <IconButton
                name="close"
                label={`Remove line ${index + 1}`}
                onClick={() => onRemove(index)}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
});

const inputClass =
  "w-full rounded-md border border-line bg-surface px-sm py-xs text-sm text-fg transition-colors placeholder:text-fg-subtle focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25 read-only:bg-surface-muted read-only:text-fg-muted";

/** Stacked layout gets a visible label; the grid layout gets the column header. */
function Cell({
  label,
  align = "left",
  children,
}: {
  label: string;
  align?: "left" | "right";
  children: React.ReactNode;
}) {
  return (
    <label className="flex items-center justify-between gap-sm md:block">
      <span className="text-xs text-fg-muted md:hidden">{label}</span>
      <span className={`min-w-0 flex-1 md:block ${align === "right" ? "text-right" : ""}`}>
        {children}
      </span>
    </label>
  );
}

/**
 * Number input that keeps an empty field usable.
 *
 * A raw `valueAsNumber` binding turns a cleared box into NaN and then into "0"
 * on the next render, so you can't delete the leading digit to retype a figure.
 * Empty is reported as 0 to the model but left visually empty.
 */
function NumberInput({
  value,
  onChange,
  readOnly,
  max,
}: {
  value: number;
  onChange: (value: number) => void;
  readOnly: boolean;
  max?: number;
}) {
  return (
    <input
      type="number"
      inputMode="decimal"
      min={0}
      max={max}
      step="any"
      readOnly={readOnly}
      value={value === 0 ? "" : value}
      placeholder="0"
      onChange={(e) => {
        const next = e.target.value === "" ? 0 : Number(e.target.value);
        onChange(Number.isNaN(next) ? 0 : next);
      }}
      className={`${inputClass} text-right`}
    />
  );
}
