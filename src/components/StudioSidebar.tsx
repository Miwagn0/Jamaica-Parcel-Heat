import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Filter,
  Loader2,
  MapPin,
  RotateCcw,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import type {
  CurrencyCode,
  DealStatus,
  DealVerdict,
  HeatmapPaletteId,
  HeatmapSettings,
  JamaicaParish,
  PropertyFilters,
  PropertyRecord,
  PropertyType,
  UnderwritingParams,
  WeightMode,
} from '../types/property';
import { ALL_JAMAICA_PARISHES } from '../data/jamaicaListings';
import {
  HEATMAP_PALETTES,
  computePortfolioStats,
  formatMoney,
  runVettingAnalysis,
} from '../utils/valuation';

interface StudioSidebarProps {
  filteredProperties: PropertyRecord[];
  allProperties: PropertyRecord[];
  filters: PropertyFilters;
  onFiltersChange: (next: PropertyFilters) => void;
  onResetFilters: () => void;
  settings: HeatmapSettings;
  onSettingsChange: (next: HeatmapSettings) => void;
  currency: CurrencyCode;
  underwritingParams: UnderwritingParams;
  selectedId: string | null;
  onSelectAndFocus: (prop: PropertyRecord) => void;
  onLookupAddress: (input: {
    query: string;
    valueUsd?: number;
    beds?: number;
    propertyType?: PropertyType;
    dealStatus?: DealStatus;
  }) => Promise<void>;
  addressInputRef: React.RefObject<HTMLInputElement | null>;
}

const PROPERTY_TYPES: PropertyType[] = [
  'Scheme House',
  'Villa / Detached',
  'Condo / Apt',
  'Beachfront / Resort',
  'Multi-Family',
  'Raw Land',
];

const DEAL_STATUSES: DealStatus[] = [
  'Turnkey',
  'Value-Add',
  'NHT Private Treaty',
];

const PRICE_BANDS: Array<{
  label: string;
  min: number | null;
  max: number | null;
}> = [
  { label: 'Any', min: null, max: null },
  { label: '< $150k', min: null, max: 150000 },
  { label: '$150k–$350k', min: 150000, max: 350000 },
  { label: '$350k–$600k', min: 350000, max: 600000 },
  { label: '$600k+', min: 600000, max: null },
];

export function StudioSidebar({
  filteredProperties,
  allProperties,
  filters,
  onFiltersChange,
  onResetFilters,
  settings,
  onSettingsChange,
  currency,
  underwritingParams,
  selectedId,
  onSelectAndFocus,
  onLookupAddress,
  addressInputRef,
}: StudioSidebarProps) {
  const [addressQuery, setAddressQuery] = useState('');
  const [showAdvancedAdd, setShowAdvancedAdd] = useState(false);
  const [askPriceInput, setAskPriceInput] = useState('');
  const [bedsInput, setBedsInput] = useState('2');
  const [addPropType, setAddPropType] = useState<PropertyType>('Villa / Detached');
  const [addDealStatus, setAddDealStatus] = useState<DealStatus>('Value-Add');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const [showHeatmapControls, setShowHeatmapControls] = useState(false);

  const stats = computePortfolioStats(
    filteredProperties,
    settings.weightMode,
    underwritingParams
  );

  const activeFilterCount =
    filters.parishes.length +
    filters.propertyTypes.length +
    filters.dealStatuses.length +
    (filters.minPriceUsd !== null || filters.maxPriceUsd !== null ? 1 : 0) +
    (filters.minBeds !== null ? 1 : 0) +
    (filters.verdictFilter !== 'All' ? 1 : 0);

  const handleLookupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = addressQuery.trim();
    if (!q) {
      setLookupError('Enter a Jamaica street address, estate, or listing URL.');
      return;
    }
    setLookupError(null);

    // First check if query directly matches an existing catalog property
    const lowerQ = q.toLowerCase();
    const existing = allProperties.find(
      (p) =>
        p.address.toLowerCase().includes(lowerQ) ||
        p.name.toLowerCase().includes(lowerQ) ||
        (p.mlsNumber && p.mlsNumber.toLowerCase().includes(lowerQ)) ||
        (p.listingUrl && p.listingUrl.toLowerCase() === lowerQ)
    );
    if (existing) {
      onSelectAndFocus(existing);
      return;
    }

    setIsLookingUp(true);
    try {
      const parsedVal = Number(askPriceInput.replace(/[^0-9.]/g, ''));
      const valueUsd =
        Number.isFinite(parsedVal) && parsedVal > 0
          ? currency === 'JMD'
            ? Math.round(parsedVal / underwritingParams.fxRate)
            : Math.round(parsedVal)
          : undefined;

      await onLookupAddress({
        query: q,
        valueUsd,
        beds: Number(bedsInput) || 2,
        propertyType: addPropType,
        dealStatus: addDealStatus,
      });
      setAddressQuery('');
      setAskPriceInput('');
    } catch (err) {
      setLookupError(
        err instanceof Error ? err.message : 'Unable to resolve address.'
      );
    } finally {
      setIsLookingUp(false);
    }
  };

  const toggleParish = (parish: JamaicaParish) => {
    const exists = filters.parishes.includes(parish);
    onFiltersChange({
      ...filters,
      parishes: exists
        ? filters.parishes.filter((p) => p !== parish)
        : [...filters.parishes, parish],
    });
  };

  const toggleType = (t: PropertyType) => {
    const exists = filters.propertyTypes.includes(t);
    onFiltersChange({
      ...filters,
      propertyTypes: exists
        ? filters.propertyTypes.filter((x) => x !== t)
        : [...filters.propertyTypes, t],
    });
  };

  const toggleDealStatus = (d: DealStatus) => {
    const exists = filters.dealStatuses.includes(d);
    onFiltersChange({
      ...filters,
      dealStatuses: exists
        ? filters.dealStatuses.filter((x) => x !== d)
        : [...filters.dealStatuses, d],
    });
  };

  return (
    <aside className="flex h-full w-full flex-col border-b border-slate-200 bg-white lg:w-[396px] lg:shrink-0 lg:border-b-0 lg:border-r">
      <div className="flex-1 overflow-y-auto divide-y divide-slate-200">
        {/* Section 1: Address / Listing URL Search */}
        <section className="p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold text-slate-900">
              Search Jamaica Address or Listing
            </h2>
            <span className="font-mono text-[11px] text-emerald-700 font-medium">
              5-Stage Vet
            </span>
          </div>

          <form onSubmit={handleLookupSubmit} className="mt-2.5 space-y-2.5">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400"
                aria-hidden="true"
              />
              <input
                ref={addressInputRef}
                type="text"
                value={addressQuery}
                onChange={(e) => {
                  setAddressQuery(e.target.value);
                  onFiltersChange({ ...filters, searchQuery: e.target.value });
                  setLookupError(null);
                }}
                placeholder="97 Winchester Estates, Negril, or listing URL..."
                aria-label="Search Jamaica street address or paste listing URL"
                className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              />
            </div>

            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setShowAdvancedAdd(!showAdvancedAdd)}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-900"
              >
                {showAdvancedAdd ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
                Optional Ask / Specs
              </button>

              <button
                type="submit"
                disabled={isLookingUp}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-950 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-60"
              >
                {isLookingUp ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <MapPin className="h-3.5 w-3.5" />
                )}
                Pull Listing & Vet
              </button>
            </div>

            {showAdvancedAdd && (
              <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                <label className="block">
                  <span className="text-[11px] text-slate-600">
                    Asking Price ({currency})
                  </span>
                  <input
                    type="number"
                    value={askPriceInput}
                    onChange={(e) => setAskPriceInput(e.target.value)}
                    placeholder={currency === 'USD' ? 'e.g. 245000' : 'e.g. 38000000'}
                    className="mt-0.5 w-full rounded border border-slate-300 bg-white px-2 py-1 font-mono text-xs text-slate-900"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] text-slate-600">Bedrooms</span>
                  <input
                    type="number"
                    min={0}
                    max={15}
                    value={bedsInput}
                    onChange={(e) => setBedsInput(e.target.value)}
                    className="mt-0.5 w-full rounded border border-slate-300 bg-white px-2 py-1 font-mono text-xs text-slate-900"
                  />
                </label>
                <select
                  value={addPropType}
                  onChange={(e) => setAddPropType(e.target.value as PropertyType)}
                  className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800"
                >
                  {PROPERTY_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <select
                  value={addDealStatus}
                  onChange={(e) => setAddDealStatus(e.target.value as DealStatus)}
                  className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800"
                >
                  {DEAL_STATUSES.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {lookupError && (
              <p className="text-xs font-medium text-red-600" role="alert">
                {lookupError}
              </p>
            )}
          </form>
        </section>

        {/* Section 2: Price & Location Scan Filters */}
        <section className="p-4 space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 text-slate-500" />
              <h2 className="font-display text-sm font-semibold text-slate-900">
                Scan Filters (Price & Location)
              </h2>
            </div>
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={onResetFilters}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-950"
              >
                <RotateCcw className="h-3 w-3" />
                Reset ({activeFilterCount})
              </button>
            )}
          </div>

          {/* Price Band Quick Chips + Custom Min/Max */}
          <div>
            <p className="text-[11px] font-medium text-slate-600">
              Price Range (USD)
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {PRICE_BANDS.map((band) => {
                const active =
                  filters.minPriceUsd === band.min &&
                  filters.maxPriceUsd === band.max;
                return (
                  <button
                    key={band.label}
                    type="button"
                    onClick={() =>
                      onFiltersChange({
                        ...filters,
                        minPriceUsd: band.min,
                        maxPriceUsd: band.max,
                      })
                    }
                    className={`rounded-md border px-2 py-1 font-mono text-[11px] font-medium transition-colors ${
                      active
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    {band.label}
                  </button>
                );
              })}
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2">
              <input
                type="number"
                placeholder="Min USD"
                value={filters.minPriceUsd ?? ''}
                onChange={(e) =>
                  onFiltersChange({
                    ...filters,
                    minPriceUsd: e.target.value ? Number(e.target.value) : null,
                  })
                }
                className="w-full rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-mono text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:bg-white focus:outline-none"
              />
              <input
                type="number"
                placeholder="Max USD"
                value={filters.maxPriceUsd ?? ''}
                onChange={(e) =>
                  onFiltersChange({
                    ...filters,
                    maxPriceUsd: e.target.value ? Number(e.target.value) : null,
                  })
                }
                className="w-full rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-mono text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          {/* Parish / Location Filter */}
          <div>
            <p className="text-[11px] font-medium text-slate-600">
              Jamaica Parish / Location
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {ALL_JAMAICA_PARISHES.slice(0, 10).map((parish) => {
                const active = filters.parishes.includes(parish);
                const shortLabel =
                  parish === 'Kingston & St. Andrew' ? 'Kingston' : parish;
                return (
                  <button
                    key={parish}
                    type="button"
                    onClick={() => toggleParish(parish)}
                    className={`rounded-md border px-2 py-1 text-[11px] font-medium transition-colors ${
                      active
                        ? 'border-emerald-700 bg-emerald-700 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    {shortLabel}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Property Type & Deal Status */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[11px] font-medium text-slate-600">Verdict</p>
              <select
                value={filters.verdictFilter}
                onChange={(e) =>
                  onFiltersChange({
                    ...filters,
                    verdictFilter: e.target.value as 'All' | DealVerdict,
                  })
                }
                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-slate-900 focus:outline-none"
              >
                <option value="All">All Verdicts</option>
                <option value="Pursue">Pursue Only</option>
                <option value="Negotiate">Negotiate</option>
                <option value="Pass">Pass</option>
              </select>
            </div>

            <div>
              <p className="text-[11px] font-medium text-slate-600">Min Beds</p>
              <select
                value={filters.minBeds ?? ''}
                onChange={(e) =>
                  onFiltersChange({
                    ...filters,
                    minBeds: e.target.value ? Number(e.target.value) : null,
                  })
                }
                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-slate-900 focus:outline-none"
              >
                <option value="">Any Beds</option>
                <option value="1">1+ Bed</option>
                <option value="2">2+ Beds</option>
                <option value="3">3+ Beds</option>
                <option value="4">4+ Beds</option>
              </select>
            </div>
          </div>

          {/* Deal Status & Type Chips */}
          <div className="flex flex-wrap gap-1.5">
            {DEAL_STATUSES.map((d) => {
              const active = filters.dealStatuses.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDealStatus(d)}
                  className={`rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                    active
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {d}
                </button>
              );
            })}
            {PROPERTY_TYPES.map((t) => {
              const active = filters.propertyTypes.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleType(t)}
                  className={`rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                    active
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </section>

        {/* Section 3: Collapsible Heatmap Controls */}
        <section className="p-4">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowHeatmapControls(!showHeatmapControls)}
              className="flex items-center gap-1.5 text-left"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-slate-500" />
              <span className="font-display text-sm font-semibold text-slate-900">
                Heatmap Layer
              </span>
              {showHeatmapControls ? (
                <ChevronUp className="h-3.5 w-3.5 text-slate-400" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              )}
            </button>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() =>
                  onSettingsChange({ ...settings, visible: !settings.visible })
                }
                className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium ${
                  settings.visible
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-600'
                }`}
              >
                {settings.visible ? (
                  <Eye className="h-3 w-3" />
                ) : (
                  <EyeOff className="h-3 w-3" />
                )}
                Heat
              </button>
              <button
                type="button"
                onClick={() =>
                  onSettingsChange({
                    ...settings,
                    showMarkers: !settings.showMarkers,
                  })
                }
                className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium ${
                  settings.showMarkers
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-600'
                }`}
              >
                <MapPin className="h-3 w-3" />
                Pins
              </button>
            </div>
          </div>

          {showHeatmapControls && (
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-4 gap-1 rounded-lg bg-slate-100 p-1">
                {(
                  [
                    { id: 'value', label: 'Price' },
                    { id: 'price_per_sqft', label: '$/sf' },
                    { id: 'cap_rate', label: 'Cap %' },
                    { id: 'density', label: 'Density' },
                  ] as Array<{ id: WeightMode; label: string }>
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() =>
                      onSettingsChange({ ...settings, weightMode: opt.id })
                    }
                    className={`rounded-md py-1 text-[11px] font-medium ${
                      settings.weightMode === opt.id
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(HEATMAP_PALETTES) as HeatmapPaletteId[]).map((pid) => {
                  const pal = HEATMAP_PALETTES[pid];
                  return (
                    <button
                      key={pid}
                      type="button"
                      onClick={() =>
                        onSettingsChange({ ...settings, palette: pid })
                      }
                      className={`rounded-lg border p-1.5 text-left ${
                        settings.palette === pid
                          ? 'border-slate-900 bg-slate-50'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div
                        className="h-2 w-full rounded-xs"
                        style={{ background: pal.cssGradient }}
                      />
                      <span className="mt-1 block truncate text-[11px] font-medium text-slate-700">
                        {pal.label.split(' ')[0]}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block text-[11px] text-slate-600">
                  Radius ({settings.radiusPixels}px)
                  <input
                    type="range"
                    min={24}
                    max={95}
                    value={settings.radiusPixels}
                    onChange={(e) =>
                      onSettingsChange({
                        ...settings,
                        radiusPixels: Number(e.target.value),
                      })
                    }
                    className="parcel-slider mt-1 w-full"
                  />
                </label>
                <label className="block text-[11px] text-slate-600">
                  Intensity ({settings.intensity.toFixed(1)}x)
                  <input
                    type="range"
                    min={0.5}
                    max={3.0}
                    step={0.1}
                    value={settings.intensity}
                    onChange={(e) =>
                      onSettingsChange({
                        ...settings,
                        intensity: Number(e.target.value),
                      })
                    }
                    className="parcel-slider mt-1 w-full"
                  />
                </label>
              </div>
            </div>
          )}
        </section>

        {/* Section 4: Matching Summary & Property List */}
        <section className="p-4">
          <div className="grid grid-cols-3 gap-2 rounded-lg bg-slate-50 p-2.5 text-center border border-slate-200/70">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-500">
                Matches
              </p>
              <p className="font-mono text-sm font-bold text-slate-900 tabular-nums">
                {stats.count}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-500">
                Median Ask
              </p>
              <p className="font-mono text-sm font-bold text-slate-900 tabular-nums">
                {stats.count > 0
                  ? formatMoney(
                      stats.medianValue,
                      currency,
                      underwritingParams.fxRate,
                      true
                    )
                  : '—'}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-500">
                Avg Cap
              </p>
              <p className="font-mono text-sm font-bold text-emerald-700 tabular-nums">
                {stats.avgCapRate > 0 ? `${stats.avgCapRate}%` : '—'}
              </p>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <h2 className="font-display text-xs font-bold uppercase tracking-wide text-slate-500">
              Matching Jamaica Listings
            </h2>
            <span className="text-[11px] text-slate-400">
              Click to vet & report
            </span>
          </div>

          {filteredProperties.length === 0 ? (
            <p className="mt-3 text-xs leading-relaxed text-slate-500">
              No Jamaica listings match your current price or parish filters. Reset filters or enter a street address above to pull up a new parcel.
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-slate-100">
              {filteredProperties.map((prop) => {
                const isSelected = prop.id === selectedId;
                const analysis = runVettingAnalysis(
                  prop,
                  allProperties,
                  underwritingParams
                );
                const verdictColor =
                  analysis.verdict === 'Pursue'
                    ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                    : analysis.verdict === 'Negotiate'
                      ? 'text-amber-700 bg-amber-50 border-amber-200'
                      : 'text-red-700 bg-red-50 border-red-200';

                return (
                  <li key={prop.id}>
                    <button
                      type="button"
                      onClick={() => onSelectAndFocus(prop)}
                      className={`w-full py-2.5 px-2 -mx-2 rounded-lg text-left transition-colors ${
                        isSelected
                          ? 'bg-slate-100 ring-1 ring-slate-300'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-slate-900">
                            {prop.name}
                          </p>
                          <p className="mt-0.5 truncate text-[11px] text-slate-500">
                            {prop.parish} · {prop.beds}bd/{prop.baths}ba ·{' '}
                            {prop.sqft > 0
                              ? `${prop.sqft.toLocaleString()} sf`
                              : `${prop.lotSqft.toLocaleString()} sf lot`}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-mono text-xs font-bold text-slate-950 tabular-nums">
                            {formatMoney(
                              prop.value,
                              currency,
                              underwritingParams.fxRate,
                              true
                            )}
                          </p>
                          <p className="font-mono text-[11px] text-slate-500 tabular-nums">
                            {analysis.activeStrategyCapRatePct.toFixed(1)}% cap
                          </p>
                        </div>
                      </div>

                      <div className="mt-1.5 flex items-center gap-1.5">
                        <span
                          className={`rounded border px-1.5 py-0.2 text-[10px] font-semibold ${verdictColor}`}
                        >
                          {analysis.verdict}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {prop.dealStatus}
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </aside>
  );
}
