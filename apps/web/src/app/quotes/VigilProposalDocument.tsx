import { formatMoneyExact } from "../lib/money";
import type { Quote } from "./api";
import { AUTONEX, type VigilProposal, type VigilSection } from "./vigil";

/**
 * The printable VIGIL techno-commercial proposal.
 *
 * Plain black-on-white with its own print rules, not the app's theme: this is a
 * document that leaves the building as a PDF, and a dark-mode header or a
 * surface token would follow it there. The layout mirrors
 * docs/Autonex_VIGIL_Technocommercial.pdf section for section.
 *
 * The commercials are rendered from the quote's own line items, never from the
 * stored proposal — one set of numbers, so the document and the quote total can
 * never disagree.
 */
export function VigilProposalDocument({
  quote,
  proposal,
}: {
  quote: Quote;
  proposal: VigilProposal;
}) {
  const { header } = proposal;
  const items = quote.items ?? [];
  const currency = quote.currency || "INR";

  return (
    <article className="vigil-doc mx-auto max-w-[210mm] bg-white p-[12mm] text-[11px] leading-relaxed text-black">
      <style>{PRINT_CSS}</style>

      <Letterhead />

      <h1 className="mt-6 text-center text-2xl font-bold tracking-tight text-[#1b2a5c]">
        TECHNO-COMMERCIAL PROPOSAL
      </h1>
      <p className="mt-1 text-center text-sm font-semibold text-[#2f57a6]">
        V.I.G.I.L — AI-Powered Industrial Vision Monitoring Platform
      </p>
      <div className="mt-3 border-t-2 border-[#1b2a5c]" />

      <SpecTable
        rows={[
          ["Prepared for", header.customerName],
          ["Site", header.siteName],
          ["Prepared by", header.preparedBy],
          ["Quotation no.", header.quotationNumber],
          ["Date", header.proposalDate],
          [
            "Validity",
            header.validityDays
              ? `${header.validityDays} days from date of issue`
              : "",
          ],
          [
            "Cameras in scope",
            header.cameraCount ? `${header.cameraCount} cameras` : "",
          ],
          ["Version", header.version],
        ]}
        className="mt-6"
      />

      {/* Commercials — read from the quote, not from the proposal document. */}
      <SectionHeading index={1} title="Commercials / Pricing" />
      {proposal.commercialsNote && (
        <p className="mb-2 text-[11px]">{proposal.commercialsNote}</p>
      )}

      <table className="w-full border-collapse text-[10.5px]">
        <thead>
          <tr className="bg-[#1b2a5c] text-white">
            <th className={TH}>Sr.</th>
            <th className={`${TH} text-left`}>Type of cost / services included</th>
            <th className={TH}>Qty</th>
            <th className={TH}>Rate per cam</th>
            <th className={TH}>Disc.</th>
            <th className={TH}>Tax</th>
            <th className={TH}>Total</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td className={TD} colSpan={7}>
                No commercial lines yet.
              </td>
            </tr>
          ) : (
            items.map((item, i) => (
              <tr key={item.id || i} className="break-inside-avoid">
                <td className={`${TD} text-center`}>{i + 1}</td>
                <td className={TD}>{item.description}</td>
                <td className={`${TD} text-center tabular-nums`}>
                  {item.quantity}
                </td>
                <td className={`${TD} text-right tabular-nums`}>
                  {formatMoneyExact(item.unitPrice, currency)}
                </td>
                <td className={`${TD} text-center tabular-nums`}>
                  {item.discountPercent ? `${item.discountPercent}%` : "—"}
                </td>
                <td className={`${TD} text-center tabular-nums`}>
                  {item.taxPercent ? `${item.taxPercent}%` : "—"}
                </td>
                <td className={`${TD} text-right font-semibold tabular-nums`}>
                  {formatMoneyExact(item.lineTotal, currency)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div className="mt-3 flex justify-end">
        <table className="w-[62%] border-collapse text-[11px]">
          <tbody>
            <Total label="Subtotal" value={quote.subtotal} currency={currency} />
            {quote.taxTotal > 0 && (
              <Total label="GST" value={quote.taxTotal} currency={currency} />
            )}
            <tr className="bg-[#1b2a5c] text-white">
              <td className="px-2 py-1.5 font-bold">Total payable</td>
              <td className="px-2 py-1.5 text-right font-bold tabular-nums">
                {formatMoneyExact(quote.total, currency)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {proposal.sections.map((section, i) => (
        <section key={section.id} className="break-inside-avoid">
          <SectionHeading index={i + 2} title={section.title} />
          <SectionBody section={section} />
        </section>
      ))}

      <footer className="mt-10 border-t border-neutral-300 pt-2 text-center text-[9px] text-neutral-500">
        Confidential | Autonex AI 360 Private Limited
      </footer>
    </article>
  );
}

function Letterhead() {
  return (
    <header className="text-center">
      <div className="mx-auto inline-block rounded bg-[#1b2a5c] px-6 py-3 text-lg font-black tracking-[0.2em] text-white">
        AUTONEX
      </div>
      <p className="mt-2 text-[10px] font-bold text-[#1b2a5c]">
        {AUTONEX.legalName} | CIN: {AUTONEX.cin}
      </p>
      <p className="text-[10px] text-neutral-600">
        <span className="font-semibold">ADDRESS:</span> {AUTONEX.address}
      </p>
    </header>
  );
}

function SectionHeading({ index, title }: { index: number; title: string }) {
  return (
    <div className="mt-6 flex items-center gap-2 border-l-4 border-[#1b2a5c] bg-[#eef2fb] px-3 py-1.5">
      <span className="text-sm font-bold text-[#2f57a6]">
        {String(index).padStart(2, "0")}
      </span>
      <h2 className="text-sm font-bold text-[#1b2a5c]">{title}</h2>
    </div>
  );
}

function SectionBody({ section }: { section: VigilSection }) {
  switch (section.kind) {
    case "text":
      return <p className="mt-2 whitespace-pre-wrap">{section.body}</p>;

    case "note":
      return (
        <div className="mt-2 border-l-4 border-[#2f57a6] bg-[#f5f7fd] px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#2f57a6]">
            {section.title}
          </p>
          <p className="mt-0.5">{section.body}</p>
        </div>
      );

    case "fields":
      return <SpecTable className="mt-2" rows={section.rows.map((r) => [r.label, r.value])} />;

    case "bullets":
      return (
        <ul className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
          {section.items.map((item, i) => (
            <li key={i} className="flex gap-1.5">
              <span className="shrink-0 text-[#2f57a6]">✓</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      );

    case "table":
      return (
        <table className="mt-2 w-full border-collapse text-[10.5px]">
          <thead>
            <tr className="bg-[#1b2a5c] text-white">
              {section.columns.map((col, i) => (
                <th key={i} className={`${TH} text-left`}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {section.rows.map((row, r) => (
              <tr key={r} className="break-inside-avoid">
                {section.columns.map((_, c) => (
                  <td key={c} className={TD}>
                    {row[c] ?? ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );

    case "split":
      return (
        <table className="mt-2 w-full border-collapse text-[10.5px]">
          <thead>
            <tr>
              <th className={`${TH} bg-[#2f6b47] text-left text-white`}>
                {section.leftTitle}
              </th>
              <th className={`${TH} bg-[#8a3131] text-left text-white`}>
                {section.rightTitle}
              </th>
            </tr>
          </thead>
          <tbody>
            {Array.from({
              length: Math.max(section.left.length, section.right.length),
            }).map((_, i) => (
              <tr key={i} className="break-inside-avoid">
                <td className={TD}>
                  {section.left[i] && (
                    <>
                      <span className="text-[#2f6b47]">✓</span> {section.left[i]}
                    </>
                  )}
                </td>
                <td className={TD}>
                  {section.right[i] && (
                    <>
                      <span className="text-[#8a3131]">✗</span>{" "}
                      {section.right[i]}
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      );
  }
}

function SpecTable({
  rows,
  className = "",
}: {
  rows: [string, string][];
  className?: string;
}) {
  return (
    <table className={`w-full border-collapse text-[11px] ${className}`}>
      <tbody>
        {rows.map(([label, value], i) => (
          <tr key={i} className="break-inside-avoid">
            <td className={`${TD} w-[38%] bg-[#f7f9fd] text-[#2f57a6]`}>
              {label}
            </td>
            <td className={TD}>{value || "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Total({
  label,
  value,
  currency,
}: {
  label: string;
  value: number;
  currency: string;
}) {
  return (
    <tr>
      <td className="border border-neutral-300 px-2 py-1">{label}</td>
      <td className="border border-neutral-300 px-2 py-1 text-right tabular-nums">
        {formatMoneyExact(value, currency)}
      </td>
    </tr>
  );
}

const TH = "border border-[#1b2a5c] px-2 py-1.5 font-semibold";
const TD = "border border-neutral-300 px-2 py-1 align-top";

/**
 * Print rules for the document.
 *
 * `break-inside: avoid` on rows and sections is what stops a four-line SLA
 * commitment being split across a page boundary, which is the difference between
 * a proposal that looks typeset and one that looks exported.
 */
const PRINT_CSS = `
  @media print {
    @page { size: A4 portrait; margin: 10mm; }
    html, body { background: #fff !important; }
    .vigil-doc { margin: 0; padding: 0; max-width: none; box-shadow: none; }
    .no-print { display: none !important; }
    tr, section, li { break-inside: avoid; page-break-inside: avoid; }
    h1, h2 { break-after: avoid; page-break-after: avoid; }
  }
`;
