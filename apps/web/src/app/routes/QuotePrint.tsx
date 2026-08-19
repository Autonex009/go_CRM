import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { quotesApi } from "../quotes/api";
import { buttonClass } from "../ui";

function formatCurrency(val: number): string {
  if (val === 0) return "0.00";
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(val);
}

export default function QuotePrint() {
  const { id } = useParams<{ id: string }>();

  const query = useQuery({
    queryKey: ["quote", id],
    queryFn: () => quotesApi.get(id!),
    enabled: Boolean(id),
  });

  const quote = query.data;

  useEffect(() => {
    if (quote) {
      const timer = setTimeout(() => {
        window.print();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [quote]);

  if (query.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 text-white font-sans">
        <p className="text-lg">Loading PO print preview...</p>
      </div>
    );
  }

  if (query.isError || !quote) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-900 text-white font-sans gap-4">
        <p className="text-xl text-red-400">Failed to load quote / PO</p>
        <Link to="/quotes" className={buttonClass({ variant: "ghost" })}>
          Back to Quotes
        </Link>
      </div>
    );
  }

  const items = quote.items ?? [];
  const poDate = quote.createdAt
    ? new Date(quote.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : "-";
  const validUntil = quote.validUntil
    ? new Date(quote.validUntil).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : "As specified";

  return (
    <div className="min-h-screen bg-slate-900 py-6 print:bg-white print:py-0 text-black font-sans">
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 5mm;
          }
          html, body {
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print {
            display: none !important;
          }
          #po-print-area {
            box-shadow: none !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            padding: 0 !important;
          }
        }
      `}</style>

      {/* Top Action Toolbar */}
      <div className="no-print mx-auto mb-4 flex w-full max-w-[210mm] items-center justify-between px-2 font-sans">
        <Link to={`/quotes/${id}`} className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded text-sm font-medium flex items-center gap-2">
          ← Back to Quote
        </Link>
        <button
          onClick={() => window.print()}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded text-sm font-semibold flex items-center gap-2 shadow-md"
        >
          🖨️ Print / Save as PDF
        </button>
      </div>

      {/* PO Print Card */}
      <div
        id="po-print-area"
        className="mx-auto w-[210mm] min-h-[297mm] print:min-h-0 print:h-auto bg-white p-6 text-black shadow-2xl print:w-full print:p-2 print:shadow-none leading-tight text-[10.5px] border border-slate-200 print:border-none"
      >
        {/* Header */}
        <div className="border-b border-black pb-2 mb-3">
          <div className="flex items-center justify-between mb-1">
            <div>
              <p className="text-xl font-black tracking-widest text-slate-900">AUTONEX</p>
            </div>
            <div className="text-right text-[10px] leading-tight text-gray-700">
              <p className="font-bold text-gray-900">AUTONEX AI 360 PRIVATE LIMITED</p>
              <p>CIN: U62099MH2025PTC453218 | GSTIN: 27ABDCA3903H1ZX</p>
            </div>
          </div>
          <p className="text-[9.5px] text-gray-600 text-center border-t border-gray-200 pt-1">
            908, Lodha Supremus, Saki Vihar Road, Powai - 400072, Maharashtra, India
          </p>
        </div>

        {/* Title */}
        <div className="text-center my-2">
          <h1 className="text-base font-bold tracking-wider text-black uppercase">
            PURCHASE ORDER (PO)
          </h1>
        </div>

        {/* Info Grid */}
        <table className="w-full border-collapse border border-black text-[10px] mb-3">
          <tbody>
            <tr>
              <td className="border border-black bg-gray-100 py-1 px-2 font-semibold w-1/6">Vendor Name</td>
              <td className="border border-black py-1 px-2 w-2/6">{quote.accountName || "Vendor Account"}</td>
              <td className="border border-black bg-gray-100 py-1 px-2 font-semibold w-1/6">PO No.</td>
              <td className="border border-black py-1 px-2 font-mono font-bold w-2/6">{quote.number}</td>
            </tr>
            <tr>
              <td className="border border-black bg-gray-100 py-1 px-2 font-semibold">Contact Person</td>
              <td className="border border-black py-1 px-2">{quote.contactName || "—"}</td>
              <td className="border border-black bg-gray-100 py-1 px-2 font-semibold">PO Date</td>
              <td className="border border-black py-1 px-2">{poDate}</td>
            </tr>
            <tr>
              <td className="border border-black bg-gray-100 py-1 px-2 font-semibold">Vendor Address</td>
              <td className="border border-black py-1 px-2">Mumbai, Maharashtra</td>
              <td className="border border-black bg-gray-100 py-1 px-2 font-semibold">Valid Until</td>
              <td className="border border-black py-1 px-2">{validUntil}</td>
            </tr>
            <tr>
              <td className="border border-black bg-gray-100 py-1 px-2 font-semibold">Vendor GSTIN</td>
              <td className="border border-black py-1 px-2 font-mono">27AAACC1234D1Z5</td>
              <td className="border border-black bg-gray-100 py-1 px-2 font-semibold">Payment Terms</td>
              <td className="border border-black py-1 px-2">50% advance, balance 15 days</td>
            </tr>
            <tr>
              <td className="border border-black bg-gray-100 py-1 px-2 font-semibold">Prepared By</td>
              <td className="border border-black py-1 px-2">{quote.ownerName || "Rohan Mehta"}</td>
              <td className="border border-black bg-gray-100 py-1 px-2 font-semibold">Place of Delivery</td>
              <td className="border border-black py-1 px-2">As specified in agreement</td>
            </tr>
          </tbody>
        </table>

        {/* 5-Column Table */}
        <table className="w-full border-collapse border border-black text-[10px] mb-3">
          <thead>
            <tr className="bg-gray-200 font-bold">
              <th className="border border-black py-1 px-2 text-center w-[8%]">Sr. No.</th>
              <th className="border border-black py-1 px-2 text-left w-[47%]">Description</th>
              <th className="border border-black py-1 px-2 text-center w-[10%]">Qty</th>
              <th className="border border-black py-1 px-2 text-right w-[17.5%]">Unit Price (₹)</th>
              <th className="border border-black py-1 px-2 text-right w-[17.5%]">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={item.id || idx} className="align-top">
                <td className="border border-black py-1 px-2 text-center font-medium">{idx + 1}</td>
                <td className="border border-black py-1 px-2 leading-tight text-[9.5px]">{item.description}</td>
                <td className="border border-black py-1 px-2 text-center font-medium">{item.quantity}</td>
                <td className="border border-black py-1 px-2 text-right font-mono">{formatCurrency(item.unitPrice)}</td>
                <td className="border border-black py-1 px-2 text-right font-mono">{formatCurrency(item.lineTotal)}</td>
              </tr>
            ))}

            {/* Subtotal */}
            <tr>
              <td colSpan={4} className="border border-black py-1 px-2 text-right font-semibold bg-gray-50">Sub Total</td>
              <td className="border border-black py-1 px-2 text-right font-mono font-semibold">{formatCurrency(quote.subtotal)}</td>
            </tr>

            {/* GST */}
            <tr>
              <td colSpan={4} className="border border-black py-1 px-2 text-right font-semibold bg-gray-50">GST (18%)</td>
              <td className="border border-black py-1 px-2 text-right font-mono font-semibold">{formatCurrency(quote.taxTotal)}</td>
            </tr>

            {/* Grand Total */}
            <tr className="bg-gray-100 font-bold">
              <td colSpan={4} className="border border-black py-1 px-2 text-right text-[11px]">Grand Total</td>
              <td className="border border-black py-1 px-2 text-right font-mono text-[11px]">{formatCurrency(quote.total)}</td>
            </tr>
          </tbody>
        </table>

        {/* Notes */}
        {quote.notes && (
          <div className="mb-3 border border-gray-300 p-2 rounded text-[9.5px] bg-gray-50">
            <p className="font-bold mb-1 text-[10px]">Notes & Scope Details:</p>
            <p className="text-gray-800 leading-tight">{quote.notes}</p>
          </div>
        )}

        {/* Signatory */}
        <div className="mt-4 pt-3 border-t border-black text-[10px] flex justify-between items-end">
          <div className="w-1/2 space-y-1">
            <p className="font-bold text-gray-900">Execution / Acceptance:</p>
            <p>By: <span className="border-b border-black inline-block w-40 ml-1">Nikhil Gawade</span></p>
            <p>Title: <span className="border-b border-black inline-block w-40 ml-1">Founder & CEO</span></p>
            <p className="text-[9px] text-gray-500 pt-0.5">AUTONEX AI 360 PRIVATE LIMITED</p>
          </div>

          <div className="w-1/2 text-right space-y-1">
            <p className="font-bold uppercase text-gray-900">Authorized Signatory</p>
            <p className="font-semibold text-gray-800">AUTONEX AI 360 PRIVATE LIMITED</p>
            <div className="pt-6">
              <p className="font-bold">NIKHIL SUNIL GAWADE</p>
              <p className="text-gray-600">Director</p>
              <p className="text-gray-500 text-[9px]">DIN: 11217265</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 pt-2 border-t border-gray-300 text-[9px] text-gray-500 flex justify-between items-center">
          <span>AUTONEX AI 360 PRIVATE LIMITED</span>
          <span className="font-semibold">| Confidential</span>
        </div>
      </div>
    </div>
  );
}
