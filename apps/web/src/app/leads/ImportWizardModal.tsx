import React, { useState } from 'react';
import { UploadCloud, CheckCircle2, AlertCircle, FileText } from 'lucide-react';

interface ImportWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ImportWizardModal: React.FC<ImportWizardModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ imported: number; failed: number } | null>(null);

  if (!isOpen) return null;

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      // Simulate backend streaming import API response
      await new Promise(r => setTimeout(r, 1200));
      setResult({ imported: 48, failed: 2 });
      onSuccess();
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">CSV Bulk Lead Import</h2>
        <p className="text-sm text-slate-500 mb-6">Upload a CSV file containing leads (first_name, last_name, company, email, phone).</p>

        {!result ? (
          <div>
            <label className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-indigo-300 dark:border-slate-700 rounded-xl hover:bg-indigo-50/50 dark:hover:bg-slate-800/50 cursor-pointer transition">
              <UploadCloud className="w-10 h-10 text-indigo-600 mb-2" />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {file ? file.name : "Click or drag CSV file to upload"}
              </span>
              <input type="file" accept=".csv" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </label>

            <div className="mt-6 flex justify-end gap-3">
              <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 dark:text-slate-300">Cancel</button>
              <button
                onClick={handleUpload}
                disabled={!file || uploading}
                className="px-5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm disabled:opacity-50"
              >
                {uploading ? "Importing..." : "Start Import"}
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-4">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Import Processed</h3>
            <p className="text-sm text-slate-500 mt-1">Successfully imported <strong>{result.imported}</strong> leads with <strong>{result.failed}</strong> failures.</p>
            <button onClick={onClose} className="mt-6 px-6 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-medium rounded-lg">Done</button>
          </div>
        )}
      </div>
    </div>
  );
};
