import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuthStore } from "../auth/store";
import { API_URL } from "../lib/config";
import { buttonClass } from "../ui";

export default function InvoicePreview() {
  const { id } = useParams<{ id: string }>();
  const token = useAuthStore((s) => s.token);
  const [html, setHtml] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    fetch(`${API_URL}/api/v1/invoices/${id}/pdf`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load invoice preview document");
        return res.text();
      })
      .then((data) => {
        setHtml(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Could not load preview");
        setLoading(false);
      });
  }, [id, token]);

  const handlePrint = () => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.focus();
      iframeRef.current.contentWindow.print();
    } else {
      window.print();
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navbar Header */}
      <header className="no-print bg-slate-900/90 backdrop-blur border-b border-slate-800 px-6 py-3.5 flex items-center justify-between sticky top-0 z-50 shadow-lg">
        <div className="flex items-center gap-4">
          <Link
            to={`/invoices/${id}`}
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-300 hover:text-white transition-colors bg-slate-800 hover:bg-slate-700 px-3.5 py-1.5 rounded-md border border-slate-700/80"
          >
            ← Back to Invoice
          </Link>
          <div className="h-4 w-px bg-slate-700/80" />
          <h1 className="text-sm font-semibold text-slate-200 tracking-wide">
            Invoice PDF Preview
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-4 py-1.5 rounded-md text-xs font-semibold transition-all shadow-sm active:scale-95 cursor-pointer"
          >
            💾 Save as PDF
          </button>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-1.5 rounded-md text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all active:scale-95 cursor-pointer"
          >
            🖨️ Print
          </button>
        </div>
      </header>

      {/* Main Preview Container with Generous Padding */}
      <main className="flex-1 p-6 sm:p-10 md:p-14 flex justify-center items-start overflow-y-auto bg-slate-950/90 backdrop-blur-md">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-16 text-slate-400 gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
            <p className="text-sm font-medium text-slate-300">Generating PDF Preview...</p>
          </div>
        ) : error ? (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 text-red-400 max-w-md text-center">
            <p className="font-semibold text-base mb-2">Error Loading Document</p>
            <p className="text-sm text-red-300/80 mb-4">{error}</p>
            <Link to={`/invoices/${id}`} className={buttonClass({ variant: "secondary" })}>
              Return to Invoice
            </Link>
          </div>
        ) : (
          <div className="w-[210mm] min-h-[297mm] bg-white rounded-sm shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] border border-slate-700/40 overflow-hidden ring-1 ring-slate-800">
            <iframe
              ref={iframeRef}
              srcDoc={html}
              title="Invoice PDF Preview"
              className="w-full min-h-[297mm] border-none"
              style={{ height: "1050px" }}
            />
          </div>
        )}
      </main>
    </div>
  );
}
