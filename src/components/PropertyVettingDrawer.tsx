import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileText,
  MapPin,
  Pencil,
  Phone,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react';
import type {
  CurrencyCode,
  InvestmentStrategy,
  PropertyRecord,
  UnderwritingParams,
  VettingAnalysis,
} from '../types/property';
import { formatMoney, runVettingAnalysis } from '../utils/valuation';

interface PropertyVettingDrawerProps {
  property: PropertyRecord;
  allProperties: PropertyRecord[];
  currency: CurrencyCode;
  underwritingParams: UnderwritingParams;
  onUnderwritingChange: (next: UnderwritingParams) => void;
  onUpdateProperty: (
    id: string,
    updates: Partial<
      Pick<
        PropertyRecord,
        | 'value'
        | 'sqft'
        | 'lotSqft'
        | 'estimatedCapexUsd'
        | 'estimatedLtrMonthlyJmd'
        | 'estimatedStrNightlyUsd'
      >
    >
  ) => void;
  onDeleteProperty: (id: string) => void;
  onOpenReport: (analysis: VettingAnalysis) => void;
  onClose: () => void;
}

type DrawerTab = 'overview' | 'comps' | 'underwriting' | 'legal';

export function PropertyVettingDrawer({
  property,
  allProperties,
  currency,
  underwritingParams,
  onUnderwritingChange,
  onUpdateProperty,
  onDeleteProperty,
  onOpenReport,
  onClose,
}: PropertyVettingDrawerProps) {
  const [activeTab, setActiveTab] = useState<DrawerTab>('overview');
  const [isEditingSpecs, setIsEditingSpecs] = useState(false);
  const [editPriceUsd, setEditPriceUsd] = useState(String(property.value));
  const [editSqft, setEditSqft] = useState(String(property.sqft));
  const [editCapex, setEditCapex] = useState(String(property.estimatedCapexUsd));
  const [copiedScript, setCopiedScript] = useState(false);

  const analysis = useMemo(
    () => runVettingAnalysis(property, allProperties, underwritingParams),
    [property, allProperties, underwritingParams]
  );

  const fx = underwritingParams.fxRate;

  const startEdit = () => {
    setEditPriceUsd(String(property.value));
    setEditSqft(String(property.sqft));
    setEditCapex(String(property.estimatedCapexUsd));
    setIsEditingSpecs(true);
  };

  const commitEdit = () => {
    const val = Number(editPriceUsd);
    const sq = Number(editSqft);
    const cx = Number(editCapex);
    onUpdateProperty(property.id, {
      value: Number.isFinite(val) && val > 0 ? Math.round(val) : property.value,
      sqft: Number.isFinite(sq) && sq >= 0 ? Math.round(sq) : property.sqft,
      estimatedCapexUsd:
        Number.isFinite(cx) && cx >= 0 ? Math.round(cx) : property.estimatedCapexUsd,
    });
    setIsEditingSpecs(false);
  };

  const handleCopyScript = async () => {
    const text = [
      `Hi ${property.broker}, I'm reviewing ${property.name} (${property.address}) and had a few quick questions:`,
      ...analysis.qualificationQuestions.map((q, i) => `${i + 1}. ${q}`),
    ].join('\n');
    await navigator.clipboard.writeText(text);
    setCopiedScript(true);
    window.setTimeout(() => setCopiedScript(false), 2000);
  };

  const verdictStyle =
    analysis.verdict === 'Pursue'
      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
      : analysis.verdict === 'Negotiate'
        ? 'bg-amber-50 text-amber-800 border-amber-200'
        : 'bg-red-50 text-red-800 border-red-200';

  const landSharePct =
    property.value > 0
      ? Math.min(100, Math.round((analysis.estimatedLandValueUsd / property.value) * 100))
      : 50;

  return (
    <aside className="flex h-full w-full flex-col border-l border-slate-200 bg-white shadow-xl lg:w-[460px] lg:shrink-0 z-[550]">
      {/* Top Sticky Header */}
      <div className="shrink-0 border-b border-slate-200 bg-white px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={`rounded border px-2 py-0.5 font-display text-[11px] font-bold uppercase tracking-wide ${verdictStyle}`}
              >
                {analysis.verdict}
              </span>
              {property.dealStatus === 'NHT Private Treaty' && (
                <span className="rounded bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-800">
                  NHT Private Treaty
                </span>
              )}
              {property.mlsNumber && (
                <span className="font-mono text-[11px] text-slate-500">
                  {property.mlsNumber}
                </span>
              )}
            </div>
            <h2 className="mt-1.5 font-display text-base font-bold leading-snug text-slate-950">
              {property.name}
            </h2>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{property.address}</span>
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close property details"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-800 shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Dual-Currency Asking Price + Primary Generate Report CTA */}
        <div className="mt-3.5 flex items-end justify-between gap-3">
          <div>
            <p className="font-mono text-xl font-bold text-slate-950 tabular-nums">
              {formatMoney(property.value, currency, fx)}
              <span className="ml-1.5 text-xs font-medium text-slate-500">
                {currency}
              </span>
            </p>
            <p className="font-mono text-xs text-slate-500 tabular-nums">
              {currency === 'USD'
                ? `${formatMoney(property.value, 'JMD', fx)} JMD`
                : `${formatMoney(property.value, 'USD', fx)} USD`}{' '}
              · ${analysis.pricePerSqftUsd}/sf
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={startEdit}
              title="Edit asking price, sq ft, or CapEx"
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-700 hover:border-slate-900 hover:text-slate-950"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </button>
            <button
              type="button"
              onClick={() => onOpenReport(analysis)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-950 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800"
            >
              <FileText className="h-3.5 w-3.5" />
              Generate Report
            </button>
          </div>
        </div>

        {/* Inline Edit Bar */}
        {isEditingSpecs && (
          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="grid grid-cols-3 gap-2">
              <label className="block text-[11px] font-medium text-slate-600">
                Ask (USD)
                <input
                  type="number"
                  value={editPriceUsd}
                  onChange={(e) => setEditPriceUsd(e.target.value)}
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1 font-mono text-xs text-slate-900"
                />
              </label>
              <label className="block text-[11px] font-medium text-slate-600">
                Sq Ft
                <input
                  type="number"
                  value={editSqft}
                  onChange={(e) => setEditSqft(e.target.value)}
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1 font-mono text-xs text-slate-900"
                />
              </label>
              <label className="block text-[11px] font-medium text-slate-600">
                CapEx (USD)
                <input
                  type="number"
                  value={editCapex}
                  onChange={(e) => setEditCapex(e.target.value)}
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1 font-mono text-xs text-slate-900"
                />
              </label>
            </div>
            <div className="mt-2.5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsEditingSpecs(false)}
                className="rounded px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={commitEdit}
                className="inline-flex items-center gap-1 rounded bg-slate-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-800"
              >
                <Check className="h-3 w-3" />
                Recalculate
              </button>
            </div>
          </div>
        )}

        {/* Drawer Sub-Tabs */}
        <div className="mt-3.5 grid grid-cols-4 gap-1 rounded-lg bg-slate-100 p-1">
          {(
            [
              { id: 'overview', label: 'Listing' },
              { id: 'comps', label: `Comps (${analysis.comps.length})` },
              { id: 'underwriting', label: 'Yield' },
              { id: 'legal', label: 'Verdict' },
            ] as Array<{ id: DrawerTab; label: string }>
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`rounded-md py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                activeTab === t.id
                  ? 'bg-white text-slate-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {/* TAB 1: OVERVIEW & SIGNAL AUDIT */}
        {activeTab === 'overview' && (
          <>
            {/* Quick KPI Grid */}
            <div className="grid grid-cols-3 gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
              <div>
                <p className="text-[11px] text-slate-500">All-In Basis</p>
                <p className="mt-0.5 font-mono text-xs font-bold text-slate-900 tabular-nums">
                  {formatMoney(analysis.allInBasisUsd, currency, fx, true)}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500">
                  Net Cap ({underwritingParams.strategy})
                </p>
                <p
                  className={`mt-0.5 font-mono text-xs font-bold tabular-nums ${
                    analysis.activeStrategyCapRatePct >= underwritingParams.targetHurdleCapRate
                      ? 'text-emerald-700'
                      : 'text-amber-700'
                  }`}
                >
                  {analysis.activeStrategyCapRatePct.toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500">Target Offer</p>
                <p className="mt-0.5 font-mono text-xs font-bold text-slate-900 tabular-nums">
                  {formatMoney(analysis.targetOfferLowUsd, currency, fx, true)}–
                  {formatMoney(analysis.targetOfferHighUsd, currency, fx, true)}
                </p>
              </div>
            </div>

            {/* Property Specs */}
            <div>
              <h3 className="font-display text-xs font-bold uppercase tracking-wide text-slate-500">
                Stage 1 · Listing Snapshot
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-700">
                {property.description}
              </p>

              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 border-t border-slate-100 pt-3 text-xs">
                <div>
                  <dt className="text-[11px] text-slate-500">Layout</dt>
                  <dd className="font-medium text-slate-900">
                    {property.beds} Bed / {property.baths} Bath · {property.propertyType}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] text-slate-500">Interior / Lot</dt>
                  <dd className="font-mono font-medium text-slate-900 tabular-nums">
                    {property.sqft.toLocaleString()} sf / {property.lotSqft.toLocaleString()} sf
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] text-slate-500">Tenure</dt>
                  <dd className="font-medium text-slate-900">{property.tenure}</dd>
                </div>
                <div>
                  <dt className="text-[11px] text-slate-500">Parish / DOM</dt>
                  <dd className="font-medium text-slate-900">
                    {property.parish} · {property.daysOnMarket}d
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-[11px] text-slate-500">Construction</dt>
                  <dd className="text-slate-800">{property.construction}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-[11px] text-slate-500">Utilities</dt>
                  <dd className="mt-1 flex flex-wrap gap-1.5">
                    {property.utilities.map((u) => (
                      <span
                        key={u}
                        className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-700"
                      >
                        {u}
                      </span>
                    ))}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Signal Audit Flags */}
            <div>
              <h3 className="font-display text-xs font-bold uppercase tracking-wide text-slate-500">
                Signal Audit & Red Flags
              </h3>
              <div className="mt-2 space-y-2">
                {property.signalFlags.map((flag, idx) => (
                  <div
                    key={idx}
                    className={`flex items-start gap-2.5 rounded-lg border p-3 text-xs ${
                      flag.level === 'red'
                        ? 'border-red-200 bg-red-50/70 text-red-950'
                        : flag.level === 'amber'
                          ? 'border-amber-200 bg-amber-50/70 text-amber-950'
                          : 'border-emerald-200 bg-emerald-50/70 text-emerald-950'
                    }`}
                  >
                    {flag.level === 'red' ? (
                      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                    ) : flag.level === 'amber' ? (
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    ) : (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    )}
                    <div>
                      <p className="font-semibold">{flag.label}</p>
                      <p className="mt-0.5 leading-relaxed opacity-90">{flag.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Broker Card */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Building2 className="h-4 w-4 shrink-0 text-slate-500" />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">
                      {property.broker}
                    </p>
                    <p className="truncate text-[11px] text-slate-500">
                      {property.agency}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {property.agentPhone && (
                    <span className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-700">
                      <Phone className="h-3 w-3" />
                      {property.agentPhone}
                    </span>
                  )}
                  {property.listingUrl && (
                    <a
                      href={property.listingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:border-slate-900"
                    >
                      Source
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {/* TAB 2: COMPS & LAND VS STRUCTURE */}
        {activeTab === 'comps' && (
          <>
            <div>
              <h3 className="font-display text-xs font-bold uppercase tracking-wide text-slate-500">
                Stage 2 · Land vs. Structure Breakdown
              </h3>
              <div className="mt-2.5 rounded-xl border border-slate-200 p-3.5">
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-slate-700">
                    Land Basis ({landSharePct}%)
                  </span>
                  <span className="font-medium text-slate-700">
                    Implied Structure ({100 - landSharePct}%)
                  </span>
                </div>
                <div className="mt-2 flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="bg-emerald-600"
                    style={{ width: `${landSharePct}%` }}
                  />
                  <div
                    className="bg-slate-800"
                    style={{ width: `${100 - landSharePct}%` }}
                  />
                </div>
                <div className="mt-2.5 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-[11px] text-slate-500">
                      Land @ ${property.landValuePerSqftUsd}/sf
                    </p>
                    <p className="font-mono font-semibold text-slate-900 tabular-nums">
                      {formatMoney(analysis.estimatedLandValueUsd, currency, fx)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-slate-500">Implied Building</p>
                    <p className="font-mono font-semibold text-slate-900 tabular-nums">
                      {formatMoney(analysis.impliedStructureValueUsd, currency, fx)}
                      {analysis.impliedStructurePerSqftUsd > 0 && (
                        <span className="ml-1 text-[11px] font-normal text-slate-500">
                          (${analysis.impliedStructurePerSqftUsd}/sf)
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <h3 className="font-display text-xs font-bold uppercase tracking-wide text-slate-500">
                  Local Comparable Properties
                </h3>
                <span className="font-mono text-[11px] text-slate-500">
                  Ask vs Med: {analysis.askVsCompPct >= 0 ? '+' : ''}
                  {analysis.askVsCompPct}%
                </span>
              </div>
              <div className="mt-2.5 space-y-2.5">
                {analysis.comps.map((c) => (
                  <div
                    key={c.id}
                    className="rounded-lg border border-slate-200 bg-white p-3 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-900">{c.name}</p>
                        <p className="text-[11px] text-slate-500">
                          {c.beds}bd / {c.baths}ba ·{' '}
                          {c.sqft > 0
                            ? `${c.sqft.toLocaleString()} sf`
                            : `${c.lotSqft.toLocaleString()} sf lot`}{' '}
                          · {c.status}
                          {c.daysOnMarket ? ` (${c.daysOnMarket}d)` : ''}
                        </p>
                      </div>
                      <div className="text-right font-mono tabular-nums shrink-0">
                        <p className="font-semibold text-slate-900">
                          {formatMoney(c.priceUsd, currency, fx)}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {currency === 'USD'
                            ? formatMoney(c.priceUsd, 'JMD', fx, true)
                            : formatMoney(c.priceUsd, 'USD', fx, true)}
                        </p>
                      </div>
                    </div>
                    <p className="mt-2 border-t border-slate-100 pt-2 text-[11px] leading-relaxed text-slate-600">
                      {c.implication}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* TAB 3: UNDERWRITING & YIELD */}
        {activeTab === 'underwriting' && (
          <>
            {/* Interactive Strategy & Hurdle Controls */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Underwriting Strategy
                </p>
                <div className="mt-1.5 grid grid-cols-3 gap-1 rounded-lg bg-slate-200/70 p-1">
                  {(['LTR', 'STR', 'Value-Add'] as InvestmentStrategy[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() =>
                        onUnderwritingChange({ ...underwritingParams, strategy: s })
                      }
                      className={`rounded-md py-1 text-xs font-medium transition-colors ${
                        underwritingParams.strategy === s
                          ? 'bg-white text-slate-950 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <label className="block">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600">Target Net Cap Rate Hurdle</span>
                  <span className="font-mono font-semibold text-slate-900 tabular-nums">
                    {underwritingParams.targetHurdleCapRate}%
                  </span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={16}
                  step={0.5}
                  value={underwritingParams.targetHurdleCapRate}
                  onChange={(e) =>
                    onUnderwritingChange({
                      ...underwritingParams,
                      targetHurdleCapRate: Number(e.target.value),
                    })
                  }
                  className="parcel-slider mt-1.5 w-full"
                />
              </label>
            </div>

            {/* All-In Basis Breakdown */}
            <div>
              <h3 className="font-display text-xs font-bold uppercase tracking-wide text-slate-500">
                Stage 3 · Jamaica All-In Cash Basis
              </h3>
              <dl className="mt-2.5 space-y-2 rounded-xl border border-slate-200 p-3.5 text-xs">
                <div className="flex justify-between">
                  <dt className="text-slate-600">Asking Price</dt>
                  <dd className="font-mono font-medium text-slate-900 tabular-nums">
                    {formatMoney(property.value, currency, fx)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-600">
                    Buyer Closing Costs (0% Foreign Surcharge)
                  </dt>
                  <dd className="font-mono text-slate-700 tabular-nums">
                    {formatMoney(analysis.closingCostsUsd, currency, fx)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-600">Immediate CapEx / Rehab</dt>
                  <dd className="font-mono text-slate-700 tabular-nums">
                    {formatMoney(analysis.capexUsd, currency, fx)}
                  </dd>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2 font-semibold text-slate-950">
                  <dt>Total All-In Basis</dt>
                  <dd className="font-mono tabular-nums">
                    {formatMoney(analysis.allInBasisUsd, currency, fx)}
                  </dd>
                </div>
              </dl>
              <p className="mt-1.5 text-[11px] text-slate-500">
                Includes 50% flat J$5,000 Stamp Duty, 0.25% NLA registration, attorney fees + 16.5% GCT, Surveyor ID report & valuation. Seller pays 2% Transfer Tax.
              </p>
            </div>

            {/* LTR vs STR Yield Cards */}
            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="text-[11px] font-semibold text-slate-500">
                  Long-Term Rental
                </p>
                <p className="mt-1 font-mono text-lg font-bold text-slate-950 tabular-nums">
                  {analysis.ltrCapRatePct.toFixed(2)}%
                </p>
                <p className="mt-1 text-[11px] text-slate-600">
                  J${property.estimatedLtrMonthlyJmd.toLocaleString()}/mo gross
                </p>
                <p className="font-mono text-[11px] font-medium text-slate-800">
                  NOI: {formatMoney(analysis.ltrNoiUsd, currency, fx)}/yr
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 p-3">
                <p className="text-[11px] font-semibold text-slate-500">
                  Short-Term (Airbnb)
                </p>
                <p className="mt-1 font-mono text-lg font-bold text-slate-950 tabular-nums">
                  {analysis.strCapRatePct.toFixed(2)}%
                </p>
                <p className="mt-1 text-[11px] text-slate-600">
                  ${property.estimatedStrNightlyUsd}/nt @ {property.strOccupancyPct}% occ
                </p>
                <p className="font-mono text-[11px] font-medium text-slate-800">
                  NOI: {formatMoney(analysis.strNoiUsd, currency, fx)}/yr
                </p>
              </div>
            </div>
          </>
        )}

        {/* TAB 4: LEGAL, VERDICT & AGENT SCRIPT */}
        {activeTab === 'legal' && (
          <>
            <div>
              <h3 className="font-display text-xs font-bold uppercase tracking-wide text-slate-500">
                Stage 4 · Legal, Title & Site Make-or-Breaks
              </h3>
              <div className="mt-2.5 space-y-2">
                {analysis.legalChecks.map((chk, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-slate-200 bg-white p-3 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-slate-900">{chk.title}</p>
                      <span
                        className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase ${
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
                    <p className="mt-1 leading-relaxed text-slate-600">
                      {chk.detail}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-display text-xs font-bold uppercase tracking-wide text-slate-500">
                Stage 5 · Verdict & Target Offer Band
              </h3>
              <div className="mt-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs">
                <p className="font-display text-sm font-bold text-slate-950">
                  {analysis.verdictHeadline}
                </p>
                <p className="mt-1.5 leading-relaxed text-slate-700">
                  {analysis.verdictRationale}
                </p>
                <div className="mt-3 rounded-lg border border-slate-200 bg-white p-2.5">
                  <p className="text-[11px] text-slate-500">
                    Defensible Target Offer Band
                  </p>
                  <p className="mt-0.5 font-mono text-sm font-bold text-slate-950 tabular-nums">
                    {formatMoney(analysis.targetOfferLowUsd, 'USD', fx)} –{' '}
                    {formatMoney(analysis.targetOfferHighUsd, 'USD', fx)} USD
                  </p>
                  <p className="font-mono text-[11px] text-slate-500 tabular-nums">
                    {formatMoney(analysis.targetOfferLowUsd, 'JMD', fx)} –{' '}
                    {formatMoney(analysis.targetOfferHighUsd, 'JMD', fx)} JMD
                  </p>
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <h3 className="font-display text-xs font-bold uppercase tracking-wide text-slate-500">
                  Agent Qualification Script
                </h3>
                <button
                  type="button"
                  onClick={() => void handleCopyScript()}
                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 hover:text-slate-950"
                >
                  {copiedScript ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  {copiedScript ? 'Copied' : 'Copy Script'}
                </button>
              </div>
              <ol className="mt-2 list-decimal space-y-2 pl-4 text-xs leading-relaxed text-slate-700">
                {analysis.qualificationQuestions.map((q, idx) => (
                  <li key={idx}>“{q}”</li>
                ))}
              </ol>
            </div>
          </>
        )}
      </div>

      {/* Footer Actions */}
      <div className="flex shrink-0 items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-3">
        <button
          type="button"
          onClick={() => {
            onDeleteProperty(property.id);
            onClose();
          }}
          className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Remove Parcel
        </button>

        <button
          type="button"
          onClick={() => onOpenReport(analysis)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-900 hover:underline"
        >
          <FileText className="h-3.5 w-3.5" />
          Open Printable Full Report
        </button>
      </div>
    </aside>
  );
}
