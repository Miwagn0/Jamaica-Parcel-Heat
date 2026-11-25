import React from 'react';
import { ArrowRight, CheckCircle2, FileText, Map, ShieldCheck } from 'lucide-react';
import type { WorkspaceTab } from '../types/property';

interface HowItWorksViewProps {
  onNavigate: (tab: WorkspaceTab) => void;
}

const STAGES = [
  {
    step: '01',
    title: 'Listing Extraction & Signal Audit',
    body: 'Captures core specs (beds, baths, living sq ft, lot sq ft, construction, utilities, broker chain) and flags undisclosed signals such as NHT Private-Treaty schedules, "provision for" backup power wording, or tight setback lots.',
  },
  {
    step: '02',
    title: 'Market Comp & Land-vs.-Structure Breakdown',
    body: 'Separates raw parish land basis ($/sq ft) from implied building value and benchmarks asking prices against active, sold, and expanded comparables in the same Jamaican estate or parish.',
  },
  {
    step: '03',
    title: 'All-In Basis & Yield Underwriting',
    body: 'Models true Jamaica cash closing costs (0% foreign-buyer surcharge, 50% of flat J$5,000 Stamp Duty, 0.25% NLA title registration, attorney fees + 16.5% GCT, Surveyor ID & valuation) plus immediate CapEx to calculate LTR vs. STR Net Operating Income and Net Cap Rate.',
  },
  {
    step: '04',
    title: 'Legal, Title & Site Make-or-Breaks',
    body: 'Surfaces Jamaica-specific legal realities: unrestricted foreign freehold ownership, NHT Private-Treaty / mortgagee powers-of-sale vacant possession risks, Strata by-law STR verification, and NEPA coastal setbacks.',
  },
  {
    step: '05',
    title: 'Verdict, Offer Band & Qualification Script',
    body: 'Issues a clear Pursue, Negotiate, or Pass verdict anchored to your target cap rate hurdle, computes a defensible USD/JMD counter-offer band, and generates ready-to-send qualification questions for the listing broker.',
  },
];

export function HowItWorksView({ onNavigate }: HowItWorksViewProps) {
  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <div className="border-b border-slate-200 pb-6">
          <p className="font-mono text-xs uppercase tracking-wider text-emerald-700 font-semibold">
            Jamaica ParcelHeat Methodology
          </p>
          <h1 className="mt-1.5 font-display text-3xl font-bold tracking-tight text-slate-950">
            5-Stage Jamaica Property Vetting Framework
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
            Every parcel plotted on the Jamaica heatmap—whether from the curated island-wide catalog, an NHT Private-Treaty schedule, or a live address/URL search—runs automatically through this standardized 5-stage underwriting framework.
          </p>
        </div>

        <div className="mt-8 space-y-4">
          {STAGES.map((stage) => (
            <div
              key={stage.step}
              className="flex gap-4 rounded-xl border border-slate-200 bg-white p-5"
            >
              <span className="font-mono text-lg font-bold text-emerald-700 shrink-0">
                {stage.step}
              </span>
              <div>
                <h2 className="font-display text-base font-bold text-slate-900">
                  {stage.title}
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">
                  {stage.body}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <ShieldCheck className="h-5 w-5 text-emerald-700" />
            <h3 className="mt-2 font-display text-sm font-bold text-slate-900">
              Jamaica Closing Tax Rules
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              No foreign-buyer surcharge. Seller pays 2% Transfer Tax; buyer pays ~4%–5% total (J$2,500 half stamp duty, 0.25% NLA reg, 2.5% attorney + 16.5% GCT, surveyor & valuation).
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <Map className="h-5 w-5 text-slate-800" />
            <h3 className="mt-2 font-display text-sm font-bold text-slate-900">
              Dual-Engine Heatmap
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              Works out-of-the-box with interactive Leaflet + Canvas2D thermal heatmaps and Nominatim geocoding, and upgrades automatically to Google Maps + Deck.gl when an API key is supplied.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <FileText className="h-5 w-5 text-slate-800" />
            <h3 className="mt-2 font-display text-sm font-bold text-slate-900">
              Exportable Dossiers
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              Print to PDF, download formatted Markdown reports, or export the filtered Jamaica ledger to CSV for investment committee review.
            </p>
          </div>
        </div>

        <div className="mt-8 flex items-center gap-3">
          <button
            type="button"
            onClick={() => onNavigate('studio')}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-5 py-2.5 text-xs font-semibold text-white hover:bg-slate-800"
          >
            <CheckCircle2 className="h-4 w-4" />
            Open Search & Heatmap
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
