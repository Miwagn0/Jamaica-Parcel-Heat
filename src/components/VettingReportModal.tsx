import React, { useState } from 'react';
import {
  Check,
  Copy,
  Download,
  FileText,
  Printer,
  X,
} from 'lucide-react';
import type { VettingAnalysis } from '../types/property';
import {
  formatMoney,
  generateMarkdownVettingReport,
} from '../utils/valuation';

interface VettingReportModalProps {
  analysis: VettingAnalysis;
  onClose: () => void;
}

export function VettingReportModal({
  analysis,
  onClose,
}: VettingReportModalProps) {
  const [copied, setCopied] = useState(false);
  const { property: p, params } = analysis;
  const fx = params.fxRate;

  const handleDownloadMarkdown = () => {
    const md = generateMarkdownVettingReport(analysis);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const slug = p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    a.download = `jamaica-vetting-report-${slug}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyMarkdown = async () => {
    const md = generateMarkdownVettingReport(analysis);
    await navigator.clipboard.writeText(md);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const verdictBadgeClass =
    analysis.verdict === 'Pursue'
      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
      : analysis.verdict === 'Negotiate'
        ? 'bg-amber-50 text-amber-800 border-amber-200'
        : 'bg-red-50 text-red-800 border-red-200';

  return (
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs print:static print:bg-white print:p-0"
      role="dialog"
      aria-modal="true"
      aria-label={`5-Stage Vetting Report for ${p.name}`}
    >
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl print:max-h-none print:border-0 print:shadow-none">
        {/* Modal Toolbar (hidden in print) */}
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-slate-50 px-6 py-3.5 print:hidden">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="h-4 w-4 shrink-0 text-slate-600" />
            <span className="truncate font-display text-sm font-semibold text-slate-900">
              5-Stage Property Vetting Report — {p.name}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void handleCopyMarkdown()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-slate-900 hover:text-slate-950"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copied ? 'Copied' : 'Copy Markdown'}
            </button>

            <button
              type="button"
              onClick={handleDownloadMarkdown}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-slate-900 hover:text-slate-950"
            >
              <Download className="h-3.5 w-3.5" />
              Download .md
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
            >
              <Printer className="h-3.5 w-3.5" />
              Print / Save PDF
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close report"
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-900"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Printable Report Body */}
        <div className="flex-1 overflow-y-auto px-8 py-8 text-slate-900 print:overflow-visible print:px-0 print:py-0">
          {/* Executive Header */}
          <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-start">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-wider text-slate-500">
                Jamaica ParcelHeat · 5-Stage Property Vetting Dossier
              </p>
              <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-950">
                {p.name}
              </h1>
              <p className="mt-1 text-sm text-slate-600">{p.address}</p>
              <p className="mt-1 font-mono text-xs text-slate-500">
                {p.mlsNumber ? `${p.mlsNumber} · ` : ''}
                {p.parish}, Jamaica · GPS {p.lat.toFixed(5)}, {p.lng.toFixed(5)} · FX J${fx}/USD
              </p>
            </div>

            <div className="shrink-0 text-left sm:text-right">
              <span
                className={`inline-block rounded-md border px-3 py-1 font-display text-xs font-bold uppercase tracking-wide ${verdictBadgeClass}`}
              >
                Verdict: {analysis.verdict}
              </span>
              <p className="mt-2 font-mono text-xl font-bold text-slate-950 tabular-nums">
                {formatMoney(p.value, 'USD', fx)} USD
              </p>
              <p className="font-mono text-xs text-slate-500 tabular-nums">
                {formatMoney(p.value, 'JMD', fx)} JMD
              </p>
            </div>
          </div>

          {/* KPI Strip */}
          <div className="mt-6 grid grid-cols-2 gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-4">
            <div>
              <p className="text-[11px] text-slate-500">All-In Cash Basis</p>
              <p className="mt-0.5 font-mono text-base font-bold text-slate-900 tabular-nums">
                {formatMoney(analysis.allInBasisUsd, 'USD', fx)}
              </p>
              <p className="font-mono text-[11px] text-slate-500 tabular-nums">
                {formatMoney(analysis.allInBasisUsd, 'JMD', fx)}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-slate-500">
                Net Cap Rate ({params.strategy})
              </p>
              <p className="mt-0.5 font-mono text-base font-bold text-slate-900 tabular-nums">
                {analysis.activeStrategyCapRatePct.toFixed(2)}%
              </p>
              <p className="font-mono text-[11px] text-slate-500 tabular-nums">
                Hurdle: {params.targetHurdleCapRate}% (
                {analysis.hurdleGapPct >= 0 ? '+' : ''}
                {analysis.hurdleGapPct.toFixed(1)}%)
              </p>
            </div>
            <div>
              <p className="text-[11px] text-slate-500">Target Offer Band</p>
              <p className="mt-0.5 font-mono text-base font-bold text-slate-900 tabular-nums">
                {formatMoney(analysis.targetOfferLowUsd, 'USD', fx, true)} –{' '}
                {formatMoney(analysis.targetOfferHighUsd, 'USD', fx, true)}
              </p>
              <p className="font-mono text-[11px] text-slate-500 tabular-nums">
                {formatMoney(analysis.targetOfferLowUsd, 'JMD', fx, true)} –{' '}
                {formatMoney(analysis.targetOfferHighUsd, 'JMD', fx, true)}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-slate-500">Ask vs. Comp Median</p>
              <p className="mt-0.5 font-mono text-base font-bold text-slate-900 tabular-nums">
                {analysis.askVsCompPct >= 0 ? '+' : ''}
                {analysis.askVsCompPct}%
              </p>
              <p className="font-mono text-[11px] text-slate-500 tabular-nums">
                Comp Med: {formatMoney(analysis.compMedianPriceUsd, 'USD', fx, true)}
              </p>
            </div>
          </div>

          {/* Stage 1 */}
          <section className="mt-8">
            <h2 className="font-display text-base font-bold text-slate-950 border-b border-slate-200 pb-2">
              Stage 1: Listing Extraction & Signal Audit
            </h2>
            <div className="mt-3 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
              <div className="space-y-1.5">
                <p>
                  <span className="font-semibold text-slate-700">Specs:</span>{' '}
                  {p.beds} Bed / {p.baths} Bath · {p.propertyType} ·{' '}
                  {p.sqft.toLocaleString()} sq ft living · {p.lotSqft.toLocaleString()} sq ft (
                  {(p.lotSqft / 43560).toFixed(3)} ac) lot
                </p>
                <p>
                  <span className="font-semibold text-slate-700">Status & Tenure:</span>{' '}
                  {p.dealStatus} · {p.tenure}
                </p>
                <p>
                  <span className="font-semibold text-slate-700">Construction:</span>{' '}
                  {p.construction}
                </p>
              </div>
              <div className="space-y-1.5">
                <p>
                  <span className="font-semibold text-slate-700">Broker / Agency:</span>{' '}
                  {p.broker}, {p.agency} {p.agentPhone ? `(${p.agentPhone})` : ''}
                </p>
                <p>
                  <span className="font-semibold text-slate-700">Utilities:</span>{' '}
                  {p.utilities.join(', ')}
                </p>
                <p>
                  <span className="font-semibold text-slate-700">Days on Market:</span>{' '}
                  {p.daysOnMarket} days (Listed {p.listedDate})
                </p>
              </div>
            </div>

            {p.signalFlags.length > 0 && (
              <div className="mt-4 space-y-2">
                {p.signalFlags.map((flag, i) => (
                  <div
                    key={i}
                    className={`rounded-lg border p-3 text-xs ${
                      flag.level === 'red'
                        ? 'border-red-200 bg-red-50/70 text-red-900'
                        : flag.level === 'amber'
                          ? 'border-amber-200 bg-amber-50/70 text-amber-900'
                          : 'border-emerald-200 bg-emerald-50/70 text-emerald-900'
                    }`}
                  >
                    <p className="font-semibold">{flag.label}</p>
                    <p className="mt-0.5 leading-relaxed opacity-90">{flag.detail}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Stage 2 */}
          <section className="mt-8">
            <h2 className="font-display text-base font-bold text-slate-950 border-b border-slate-200 pb-2">
              Stage 2: Market Comp & Land-vs.-Structure Breakdown
            </h2>
            <div className="mt-3 grid grid-cols-3 gap-4 text-xs">
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-slate-500">Estimated Land Value</p>
                <p className="mt-1 font-mono text-sm font-semibold text-slate-900">
                  {formatMoney(analysis.estimatedLandValueUsd, 'USD', fx)}
                </p>
                <p className="text-[11px] text-slate-500">
                  @${p.landValuePerSqftUsd}/sf × {p.lotSqft.toLocaleString()} sf
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-slate-500">Implied Structure Value</p>
                <p className="mt-1 font-mono text-sm font-semibold text-slate-900">
                  {formatMoney(analysis.impliedStructureValueUsd, 'USD', fx)}
                </p>
                <p className="text-[11px] text-slate-500">
                  {analysis.impliedStructurePerSqftUsd > 0
                    ? `$${analysis.impliedStructurePerSqftUsd}/sf building basis`
                    : 'Raw land'}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-slate-500">Subject vs. Comp $/Sq Ft</p>
                <p className="mt-1 font-mono text-sm font-semibold text-slate-900">
                  ${analysis.pricePerSqftUsd}/sf vs ${analysis.compMedianPsfUsd}/sf
                </p>
                <p className="text-[11px] text-slate-500">
                  {analysis.askVsCompPct >= 0 ? '+' : ''}
                  {analysis.askVsCompPct}% vs comp median price
                </p>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-3 py-2.5 font-semibold">Comparable</th>
                    <th className="px-3 py-2.5 font-semibold">Specs</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Price (USD / JMD)</th>
                    <th className="px-3 py-2.5 font-semibold">Implication</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {analysis.comps.map((c) => (
                    <tr key={c.id}>
                      <td className="px-3 py-2.5 font-medium text-slate-900">
                        {c.name}
                        <span className="block text-[11px] font-normal text-slate-500">
                          {c.status}
                          {c.daysOnMarket ? ` · ${c.daysOnMarket} DOM` : ''}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">
                        {c.beds}bd / {c.baths}ba ·{' '}
                        {c.sqft > 0
                          ? `${c.sqft.toLocaleString()} sf`
                          : `${c.lotSqft.toLocaleString()} sf lot`}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums whitespace-nowrap">
                        <span className="font-semibold text-slate-900">
                          {formatMoney(c.priceUsd, 'USD', fx)}
                        </span>
                        <span className="block text-[11px] text-slate-500">
                          {formatMoney(c.priceUsd, 'JMD', fx)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-600 leading-relaxed">
                        {c.implication}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Stage 3 */}
          <section className="mt-8">
            <h2 className="font-display text-base font-bold text-slate-950 border-b border-slate-200 pb-2">
              Stage 3: All-In Basis & Yield Underwriting
            </h2>
            <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 text-xs">
              <div className="rounded-lg border border-slate-200 p-4">
                <h3 className="font-display text-xs font-bold uppercase tracking-wide text-slate-600">
                  Jamaica Cash Acquisition Basis
                </h3>
                <dl className="mt-3 space-y-2">
                  <div className="flex justify-between">
                    <dt className="text-slate-600">Asking Price</dt>
                    <dd className="font-mono font-semibold text-slate-900 tabular-nums">
                      {formatMoney(p.value, 'USD', fx)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-600">Stamp Duty (50% of J$5,000)</dt>
                    <dd className="font-mono text-slate-700 tabular-nums">
                      {formatMoney(analysis.closingBreakdown.stampDutyHalfUsd, 'USD', fx)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-600">NLA Title Registration (0.25%)</dt>
                    <dd className="font-mono text-slate-700 tabular-nums">
                      {formatMoney(analysis.closingBreakdown.nlaRegistrationUsd, 'USD', fx)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-600">Attorney Fees + 16.5% GCT</dt>
                    <dd className="font-mono text-slate-700 tabular-nums">
                      {formatMoney(analysis.closingBreakdown.attorneyAndGctUsd, 'USD', fx)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-600">Surveyor ID & Valuation</dt>
                    <dd className="font-mono text-slate-700 tabular-nums">
                      {formatMoney(analysis.closingBreakdown.surveyAndValuationUsd, 'USD', fx)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-600">Immediate CapEx / Rehab</dt>
                    <dd className="font-mono text-slate-700 tabular-nums">
                      {formatMoney(analysis.capexUsd, 'USD', fx)}
                    </dd>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 pt-2 font-semibold text-slate-950">
                    <dt>Total All-In Cash Basis</dt>
                    <dd className="font-mono tabular-nums">
                      {formatMoney(analysis.allInBasisUsd, 'USD', fx)} (
                      {formatMoney(analysis.allInBasisUsd, 'JMD', fx)})
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-lg border border-slate-200 p-4">
                <h3 className="font-display text-xs font-bold uppercase tracking-wide text-slate-600">
                  Income & Net Cap Rate Comparison
                </h3>
                <div className="mt-3 space-y-3">
                  <div className="rounded-md bg-slate-50 p-3">
                    <div className="flex justify-between font-semibold text-slate-900">
                      <span>Long-Term Rental (LTR)</span>
                      <span className="font-mono">{analysis.ltrCapRatePct.toFixed(2)}% Cap</span>
                    </div>
                    <p className="mt-1 text-slate-600">
                      Gross: J${p.estimatedLtrMonthlyJmd.toLocaleString()}/mo (
                      {formatMoney(analysis.ltrGrossAnnualUsd, 'USD', fx)}/yr) ·{' '}
                      {params.ltrOperatingDragPct}% op drag →{' '}
                      <strong className="text-slate-900">
                        {formatMoney(analysis.ltrNoiUsd, 'USD', fx)}/yr NOI
                      </strong>
                    </p>
                  </div>

                  <div className="rounded-md bg-slate-50 p-3">
                    <div className="flex justify-between font-semibold text-slate-900">
                      <span>Short-Term Rental (STR / Airbnb)</span>
                      <span className="font-mono">{analysis.strCapRatePct.toFixed(2)}% Cap</span>
                    </div>
                    <p className="mt-1 text-slate-600">
                      Gross: ${p.estimatedStrNightlyUsd}/nt @ {p.strOccupancyPct}% occ (
                      {formatMoney(analysis.strGrossAnnualUsd, 'USD', fx)}/yr) ·{' '}
                      {params.strOperatingDragPct}% op drag →{' '}
                      <strong className="text-slate-900">
                        {formatMoney(analysis.strNoiUsd, 'USD', fx)}/yr NOI
                      </strong>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Stage 4 */}
          <section className="mt-8">
            <h2 className="font-display text-base font-bold text-slate-950 border-b border-slate-200 pb-2">
              Stage 4: Legal, Title & Site Make-or-Breaks ({params.buyerProfile})
            </h2>
            <div className="mt-3 space-y-2.5 text-xs">
              {analysis.legalChecks.map((chk, i) => (
                <div key={i} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-slate-900">{chk.title}</p>
                    <span
                      className={`rounded px-2 py-0.5 font-mono text-[10px] font-semibold uppercase ${
                        chk.severity === 'critical'
                          ? 'bg-red-100 text-red-800'
                          : chk.severity === 'caution'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {chk.severity}
                    </span>
                  </div>
                  <p className="mt-1 leading-relaxed text-slate-600">{chk.detail}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Stage 5 */}
          <section className="mt-8">
            <h2 className="font-display text-base font-bold text-slate-950 border-b border-slate-200 pb-2">
              Stage 5: Verdict & Agent Qualification Script
            </h2>
            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs">
              <p className="font-display text-sm font-bold text-slate-950">
                {analysis.verdictHeadline}
              </p>
              <p className="mt-1.5 leading-relaxed text-slate-700">
                {analysis.verdictRationale}
              </p>
              <p className="mt-3 font-mono text-xs font-semibold text-slate-900">
                Recommended Target Offer Band:{' '}
                {formatMoney(analysis.targetOfferLowUsd, 'USD', fx)} –{' '}
                {formatMoney(analysis.targetOfferHighUsd, 'USD', fx)} USD (
                {formatMoney(analysis.targetOfferLowUsd, 'JMD', fx)} –{' '}
                {formatMoney(analysis.targetOfferHighUsd, 'JMD', fx)} JMD)
              </p>
            </div>

            <div className="mt-4">
              <p className="text-xs font-semibold text-slate-800">
                Qualification Questions for {p.broker} ({p.agency}
                {p.agentPhone ? ` · ${p.agentPhone}` : ''}):
              </p>
              <ol className="mt-2 list-decimal space-y-2 pl-5 text-xs leading-relaxed text-slate-700">
                {analysis.qualificationQuestions.map((q, idx) => (
                  <li key={idx}>“{q}”</li>
                ))}
              </ol>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
