import React from 'react';
import { Home, ShieldCheck, Zap, Sun } from 'lucide-react';

interface SiteAssessmentProps {
  roofAreaSqft?: number;
  monthlyBillAmount?: number;
  electricityProvider?: string;
  sanctionedLoadKw?: number;
  structureType?: string;
}

export const SiteAssessmentCard: React.FC<SiteAssessmentProps> = ({
  roofAreaSqft = 1200,
  monthlyBillAmount = 18500,
  electricityProvider = "MSEDCL",
  sanctionedLoadKw = 15,
  structureType = "RCC Flat Roof",
}) => {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <Sun className="w-5 h-5 text-amber-500" />
          <h3 className="font-semibold text-slate-900 dark:text-white text-sm">Site & Technical Assessment</h3>
        </div>
        <span className="text-xs px-2.5 py-1 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 rounded-full font-medium">Solar Ready</span>
      </div>

      <div className="grid grid-cols-2 gap-4 text-xs">
        <div>
          <span className="text-slate-400 block mb-0.5">Roof Area</span>
          <span className="font-medium text-slate-800 dark:text-slate-200">{roofAreaSqft} sq.ft</span>
        </div>
        <div>
          <span className="text-slate-400 block mb-0.5">Avg Monthly Bill</span>
          <span className="font-medium text-slate-800 dark:text-slate-200">₹{monthlyBillAmount.toLocaleString('en-IN')}</span>
        </div>
        <div>
          <span className="text-slate-400 block mb-0.5">DISCOM / Utility</span>
          <span className="font-medium text-slate-800 dark:text-slate-200">{electricityProvider}</span>
        </div>
        <div>
          <span className="text-slate-400 block mb-0.5">Sanctioned Load</span>
          <span className="font-medium text-slate-800 dark:text-slate-200">{sanctionedLoadKw} kW</span>
        </div>
        <div className="col-span-2">
          <span className="text-slate-400 block mb-0.5">Structure Type</span>
          <span className="font-medium text-slate-800 dark:text-slate-200">{structureType}</span>
        </div>
      </div>
    </div>
  );
};
