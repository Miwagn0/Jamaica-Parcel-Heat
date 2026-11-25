import React, { useMemo, useState } from 'react';
import {
  ArrowUpDown,
  Download,
  FileText,
  MapPin,
  Search,
  Trash2,
} from 'lucide-react';
import type {
  CurrencyCode,
  JamaicaParish,
  PropertyRecord,
  PropertyType,
  UnderwritingParams,
  VettingAnalysis,
} from '../types/property';
import { ALL_JAMAICA_PARISHES } from '../data/jamaicaListings';
import {
  computePortfolioStats,
  exportPropertiesToCsv,
  formatMoney,
  getPricePerSqft,
  runVettingAnalysis,
} from '../utils/valuation';

interface PropertyLedgerViewProps {
  properties: PropertyRecord[];
  allProperties: PropertyRecord[];
  currency: CurrencyCode;
  underwritingParams: UnderwritingParams;
  onUpdateProperty: (
    id: string,
    updates: Partial<Pick<PropertyRecord, 'value' | 'sqft' | 'propertyType'>>
  ) => void;
  onDeleteProperty: (id: string) => void;
  onClearAll: () => void;
  onLocateOnMap: (prop: PropertyRecord) => void;
  onOpenReport: (analysis: VettingAnalysis) => void;
}

type SortField = 'value' | 'psf' | 'cap' | 'address';

export function PropertyLedgerView({
  properties,
  allProperties,
  currency,
  underwritingParams,
  onUpdateProperty,
  onDeleteProperty,
  onClearAll,
  onLocateOnMap,
  onOpenReport,
}: PropertyLedgerViewProps) {
  const [search, setSearch] = useState('');
  const [parishFilter, setParishFilter] = useState<'All' | JamaicaParish>('All');
  const [typeFilter, setTypeFilter] = useState<'All' | PropertyType>('All');
  const [sortField, setSortField] = useState<SortField>('cap');
  const [sortAsc, setSortAsc] = useState(false);

  const fx = underwritingParams.fxRate;

  const analyzed = useMemo(() => {
    const q = search.trim().toLowerCase();
    return properties
      .filter((p) => {
        if (parishFilter !== 'All' && p.parish !== parishFilter) return false;
        if (typeFilter !== 'All' && p.propertyType !== typeFilter) return false;
        if (!q) return true;
        return (
          p.address.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q) ||
          p.parish.toLowerCase().includes(q) ||
          p.dealStatus.toLowerCase().includes(q)
        );
      })
      .map((prop) => ({
        prop,
        analysis: runVettingAnalysis(prop, allProperties, underwritingParams),
      }))
      .sort((a, b) => {
        let diff = 0;
        if (sortField === 'value') diff = a.prop.value - b.prop.value;
        else if (sortField === 'psf')
          diff = getPricePerSqft(a.prop) - getPricePerSqft(b.prop);
        else if (sortField === 'cap')
          diff =
            a.analysis.activeStrategyCapRatePct -
            b.analysis.activeStrategyCapRatePct;
        else diff = a.prop.name.localeCompare(b.prop.name);
        return sortAsc ? diff : -diff;
      });
  }, [
    properties,
    allProperties,
    search,
    parishFilter,
    typeFilter,
    sortField,
    sortAsc,
    underwritingParams,
  ]);

  const stats = useMemo(
    () =>
      computePortfolioStats(
        analyzed.map((x) => x.prop),
        'value',
        underwritingParams
      ),
    [analyzed, underwritingParams]
  );

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(field === 'address');
    }
  };

  const handleExport = () => {
    const csv = exportPropertiesToCsv(
      analyzed.map((x) => x.prop),
      underwritingParams
    );
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jamaica-parcelheat-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
              Jamaica Property Underwriting Ledger
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Compare asking prices ({currency}), net cap rates ({underwritingParams.strategy}), verdicts, and generate 5-stage vetting reports.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              disabled={analyzed.length === 0}
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:border-slate-900 hover:text-slate-950 disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </button>
            <button
              type="button"
              disabled={properties.length === 0}
              onClick={onClearAll}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3.5 py-2 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear All
            </button>
          </div>
        </div>

        {/* Summary Strip */}
        <div className="mt-6 grid grid-cols-2 gap-6 border-b border-slate-200 pb-6 sm:grid-cols-4">
          <div>
            <p className="text-xs text-slate-500">Matching Listings</p>
            <p className="mt-1 font-mono text-xl font-semibold text-slate-900 tabular-nums">
              {stats.count}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Median Asking Price</p>
            <p className="mt-1 font-mono text-xl font-semibold text-slate-900 tabular-nums">
              {formatMoney(stats.medianValue, currency, fx)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Average Price / Sq Ft</p>
            <p className="mt-1 font-mono text-xl font-semibold text-slate-900 tabular-nums">
              ${stats.avgPricePerSqft.toLocaleString()}/sf
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">
              Avg Net Cap ({underwritingParams.strategy})
            </p>
            <p className="mt-1 font-mono text-xl font-semibold text-emerald-700 tabular-nums">
              {stats.avgCapRate.toFixed(1)}%
            </p>
          </div>
        </div>

        {/* Toolbar */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="relative w-full sm:max-w-xs">
            <Search
              className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by estate, parish, or status..."
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={parishFilter}
              onChange={(e) =>
                setParishFilter(e.target.value as 'All' | JamaicaParish)
              }
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-slate-900 focus:outline-none"
            >
              <option value="All">All Parishes</option>
              {ALL_JAMAICA_PARISHES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>

            <select
              value={typeFilter}
              onChange={(e) =>
                setTypeFilter(e.target.value as 'All' | PropertyType)
              }
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-slate-900 focus:outline-none"
            >
              <option value="All">All Property Types</option>
              <option value="Scheme House">Scheme House</option>
              <option value="Villa / Detached">Villa / Detached</option>
              <option value="Condo / Apt">Condo / Apt</option>
              <option value="Beachfront / Resort">Beachfront / Resort</option>
              <option value="Multi-Family">Multi-Family</option>
              <option value="Raw Land">Raw Land</option>
            </select>
          </div>
        </div>

        {/* Data Table */}
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {analyzed.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="text-sm font-medium text-slate-900">
                No matching Jamaica listings
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Adjust filters or search a physical address in Search & Heatmap.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">
                      <button
                        type="button"
                        onClick={() => handleSort('address')}
                        className="inline-flex items-center gap-1 hover:text-slate-900"
                      >
                        Listing & Parish
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </th>
                    <th className="px-3 py-3 font-medium">Type / Status</th>
                    <th className="px-3 py-3 text-right font-medium">
                      <button
                        type="button"
                        onClick={() => handleSort('value')}
                        className="inline-flex items-center gap-1 hover:text-slate-900"
                      >
                        Ask (USD)
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </th>
                    <th className="px-3 py-3 text-right font-medium">
                      <button
                        type="button"
                        onClick={() => handleSort('psf')}
                        className="inline-flex items-center gap-1 hover:text-slate-900"
                      >
                        $/Sq Ft
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </th>
                    <th className="px-3 py-3 text-right font-medium">
                      <button
                        type="button"
                        onClick={() => handleSort('cap')}
                        className="inline-flex items-center gap-1 hover:text-slate-900"
                      >
                        Net Cap %
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </th>
                    <th className="px-3 py-3 font-medium">Verdict</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {analyzed.map(({ prop, analysis }) => {
                    const verdictBadge =
                      analysis.verdict === 'Pursue'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : analysis.verdict === 'Negotiate'
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : 'bg-red-50 text-red-800 border-red-200';
                    return (
                      <tr key={prop.id} className="hover:bg-slate-50/75">
                        <td className="max-w-[260px] px-4 py-2.5">
                          <p className="truncate font-semibold text-slate-900">
                            {prop.name}
                          </p>
                          <p className="mt-0.5 truncate text-[11px] text-slate-500">
                            {prop.parish} · {prop.beds}bd/{prop.baths}ba ·{' '}
                            {prop.sqft > 0
                              ? `${prop.sqft.toLocaleString()} sf`
                              : `${prop.lotSqft.toLocaleString()} sf lot`}
                          </p>
                        </td>
                        <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">
                          <span className="block">{prop.propertyType}</span>
                          <span className="text-[11px] text-slate-400">
                            {prop.dealStatus}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap">
                          <input
                            type="number"
                            min={10000}
                            step={5000}
                            value={prop.value}
                            aria-label={`Asking price USD for ${prop.name}`}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              if (Number.isFinite(val) && val > 0) {
                                onUpdateProperty(prop.id, {
                                  value: Math.round(val),
                                });
                              }
                            }}
                            className="w-24 rounded border border-transparent bg-transparent px-1.5 py-0.5 text-right font-mono text-xs font-semibold text-slate-900 tabular-nums hover:border-slate-300 focus:border-slate-900 focus:bg-white focus:outline-none"
                          />
                          <span className="block font-mono text-[10px] text-slate-400 tabular-nums">
                            {formatMoney(prop.value, 'JMD', fx, true)}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-slate-700 tabular-nums whitespace-nowrap">
                          ${getPricePerSqft(prop).toLocaleString()}/sf
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                          {analysis.activeStrategyCapRatePct.toFixed(1)}%
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span
                            className={`rounded border px-2 py-0.5 text-[11px] font-semibold ${verdictBadge}`}
                          >
                            {analysis.verdict}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-2.5">
                            <button
                              type="button"
                              onClick={() => onOpenReport(analysis)}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-900 hover:underline"
                            >
                              <FileText className="h-3.5 w-3.5" />
                              Report
                            </button>
                            <button
                              type="button"
                              onClick={() => onLocateOnMap(prop)}
                              className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-950"
                            >
                              <MapPin className="h-3.5 w-3.5" />
                              Map
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteProperty(prop.id)}
                              aria-label={`Delete ${prop.name}`}
                              className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
