import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "../auth/store";
import { Icon } from "../ui";

interface PDFPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfUrl: string;
  title?: string;
}

export function PDFPreviewModal({
  isOpen,
  onClose,
  pdfUrl,
  title = "Document Preview",
}: PDFPreviewModalProps) {
  const token = useAuthStore((s) => s.token);
  const [html, setHtml] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!isOpen || !pdfUrl) return;
    setLoading(true);
    setError(null);

    fetch(pdfUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load PDF document");
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
  }, [isOpen, pdfUrl, token]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handlePrint = () => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.focus();
      iframeRef.current.contentWindow.print();
    } else {
      window.print();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-150 font-sans">
      {/* Minimal Top Header */}
      <header className="bg-slate-900/95 border-b border-slate-800 px-6 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-indigo-500" />
          <h2 className="text-sm font-semibold text-slate-200 tracking-wide">{title}</h2>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 px-3.5 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer active:scale-95"
          >
            💾 Save as PDF
          </button>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-md text-xs font-semibold shadow-md shadow-indigo-600/30 transition-all cursor-pointer active:scale-95"
          >
            🖨️ Print
          </button>
          <div className="h-4 w-px bg-slate-800 my-auto" />
          <button
            onClick={onClose}
            aria-label="Close preview"
            className="text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 p-1.5 rounded-md transition-colors cursor-pointer"
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      </header>

      {/* Preview Content Area with Generous Padding */}
      <main
        className="flex-1 p-6 sm:p-10 md:p-12 overflow-y-auto flex justify-center items-start"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center p-16 text-slate-400 gap-3">
            <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-indigo-500" />
            <p className="text-xs font-medium text-slate-300">Loading Document Preview...</p>
          </div>
        ) : error ? (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 text-red-400 max-w-md text-center">
            <p className="font-semibold text-sm mb-1">Could Not Render PDF</p>
            <p className="text-xs text-red-300/80 mb-4">{error}</p>
            <button
              onClick={onClose}
              className="bg-slate-800 hover:bg-slate-700 text-white text-xs px-4 py-1.5 rounded-md"
            >
              Close
            </button>
          </div>
        ) : (
          <div className="w-[210mm] min-h-[297mm] bg-white rounded-xs shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] border border-slate-700/40 overflow-hidden ring-1 ring-slate-800">
            <iframe
              ref={iframeRef}
              srcDoc={html}
              title="PDF Document Preview"
              className="w-full min-h-[297mm] border-none"
              style={{ height: "1050px" }}
            />
          </div>
        )}
      </main>
    </div>
  );
}
