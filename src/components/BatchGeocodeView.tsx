import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Play,
  Upload,
} from 'lucide-react';
import type { ParsedBatchRow, PropertyRecord } from '../types/property';
import { PARISH_PRESETS } from '../data/jamaicaListings';
import {
  formatCurrencyFull,
  inferJamaicaParish,
  parseBatchInput,
} from '../utils/valuation';
import { geocodePhysicalAddress } from '../services/geocodeService';

interface BatchGeocodeViewProps {
  existingProperties: PropertyRecord[];
  onBatchComplete: (
    newProperties: PropertyRecord[],
    replaceExisting: boolean
  ) => void;
  onOpenStudio: () => void;
}

const SAMPLE_JAMAICA_CSV = `Address | Asking Price USD | Sq Ft | Property Type
Lot 14 Winchester Estates, Green Island, Hanover, Jamaica | 65000 | 520 | Scheme House
18 West End Road, Negril, Westmoreland, Jamaica | 310000 | 1850 | Beachfront / Resort
Lot 55 Drax Hall Country Club, St. Ann, Jamaica | 345000 | 1680 | Villa / Detached
12 Lady Musgrave Road, Kingston 5, Jamaica | 275000 | 1120 | Condo / Apt
Lot 72 Bogue Village, Montego Bay, St. James, Jamaica | 155000 | 980 | Scheme House`;

export function BatchGeocodeView({
  existingProperties,
  onBatchComplete,
  onOpenStudio,
}: BatchGeocodeViewProps) {
  const [rawText, setRawText] = useState(SAMPLE_JAMAICA_CSV);
  const [rows, setRows] = useState<ParsedBatchRow[]>([]);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);

  const previewRows = useMemo(() => parseBatchInput(rawText), [rawText]);
  const activeRows = rows.length > 0 ? rows : previewRows;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setRawText(reader.result);
        setRows([]);
      }
    };
    reader.readAsText(file);
  };

  const handleRunBatch = async () => {
    const parsed = parseBatchInput(rawText);
    if (parsed.length === 0) return;

    setIsRunning(true);
    setCompletedCount(0);
    setRows(parsed);

    const resolvedProperties: PropertyRecord[] = [];

    for (let i = 0; i < parsed.length; i++) {
      const row = parsed[i];
      setRows((prev) =>
        prev.map((r, idx) => (idx === i ? { ...r, status: 'geocoding' } : r))
      );

      try {
        const geo = await geocodePhysicalAddress(row.address, null);
        const parish = row.parish ?? inferJamaicaParish(geo.formattedAddress);
        const preset = PARISH_PRESETS.find((p) => p.parish === parish);

        const prop: PropertyRecord = {
          id: `batch-jm-${Date.now()}-${i}`,
          name: row.address.split(',')[0].trim(),
          address: geo.formattedAddress,
          parish,
          community: row.address.split(',')[0].trim(),
          lat: geo.lat,
          lng: geo.lng,
          placeId: geo.placeId,
          granularity: geo.granularity,
          value: row.value,
          sqft: row.sqft,
          lotSqft: Math.max(3200, Math.round(row.sqft * 2.4)),
          beds: Math.max(1, Math.round(row.sqft / 580)),
          baths: Math.max(1, Math.round(row.sqft / 750)),
          propertyType: row.propertyType,
          dealStatus: /nht|winchester|bogue/i.test(row.address)
            ? 'NHT Private Treaty'
            : 'Value-Add',
          tenure:
            row.propertyType === 'Condo / Apt'
              ? 'Strata Title'
              : 'Registered Freehold Title',
          construction: 'Concrete block-and-steel (batch imported)',
          utilities: ['NWC Piped Water', 'JPS Electricity'],
          broker: 'Batch Import',
          agency: 'NHT / MLS Schedule',
          listedDate: new Date().toISOString().slice(0, 10),
          daysOnMarket: 1,
          description: `Batch imported Jamaica parcel in ${parish}. Click Generate Report to run full 5-stage vetting analysis.`,
          signalFlags: [
            {
              level: 'amber',
              label: 'Batch Imported Parcel — Verify Specs',
              detail:
                'Confirm exact title status, interior condition, and NWC/JPS arrears before making an offer.',
            },
          ],
          estimatedLtrMonthlyJmd:
            Math.round(
              ((preset?.avgRent1BedJmd ?? 80000) *
                Math.max(1, row.sqft / 650)) /
                5000
            ) * 5000,
          estimatedStrNightlyUsd: Math.round(
            Math.max(70, (row.sqft / 600) * 75)
          ),
          strOccupancyPct: 48,
          estimatedCapexUsd: Math.round(row.value * 0.1),
          landValuePerSqftUsd: preset?.avgLandPerSqftUsd ?? 12,
          source: 'batch',
          valuationNote: 'Batch geocoded',
        };

        resolvedProperties.push(prop);
        setRows((prev) =>
          prev.map((r, idx) =>
            idx === i
              ? {
                  ...r,
                  status: 'success',
                  resolvedAddress: geo.formattedAddress,
                  lat: geo.lat,
                  lng: geo.lng,
                  granularity: geo.granularity,
                }
              : r
          )
        );
      } catch (err) {
        setRows((prev) =>
          prev.map((r, idx) =>
            idx === i
              ? {
                  ...r,
                  status: 'error',
                  errorMessage:
                    err instanceof Error ? err.message : 'Geocoding failed',
                }
              : r
          )
        );
      }

      setCompletedCount(i + 1);
    }

    if (resolvedProperties.length > 0) {
      onBatchComplete(resolvedProperties, replaceExisting);
    }
    setIsRunning(false);
  };

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
              Batch Geocode Jamaica Schedules
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Paste NHT Private-Treaty lists or MLS spreadsheets (`Address | USD Price | Sq Ft | Type`) to plot and vet multiple Jamaica parcels at once.
            </p>
          </div>

          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:border-slate-900 hover:text-slate-950 shrink-0">
            <Upload className="h-3.5 w-3.5" />
            Upload CSV
            <input
              type="file"
              accept=".csv,.txt"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-5 space-y-4">
            <textarea
              value={rawText}
              onChange={(e) => {
                setRawText(e.target.value);
                setRows([]);
              }}
              rows={11}
              className="w-full rounded-xl border border-slate-300 bg-white p-3.5 font-mono text-xs leading-relaxed text-slate-800 focus:border-slate-900 focus:outline-none"
            />

            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={replaceExisting}
                onChange={(e) => setReplaceExisting(e.target.checked)}
                className="rounded border-slate-300"
              />
              Replace existing {existingProperties.length} listings on map
            </label>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                disabled={isRunning || previewRows.length === 0}
                onClick={() => void handleRunBatch()}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {isRunning ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Geocoding {completedCount}/{previewRows.length}...
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5" />
                    Geocode {previewRows.length} Jamaica Parcels
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onOpenStudio}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-medium text-slate-700 hover:border-slate-900"
              >
                Map
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="lg:col-span-7 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-700">
              Parsed Queue ({activeRows.length} parcels)
            </div>
            <div className="max-h-[420px] overflow-y-auto divide-y divide-slate-100">
              {activeRows.map((row) => (
                <div
                  key={row.rowNumber}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-900">
                      {row.resolvedAddress || row.address}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {row.parish} · {row.propertyType} · {row.sqft.toLocaleString()} sf
                      {row.lat && row.lng
                        ? ` · (${row.lat.toFixed(4)}, ${row.lng.toFixed(4)})`
                        : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-mono font-semibold text-slate-900 tabular-nums">
                      {formatCurrencyFull(row.value)}
                    </span>
                    {row.status === 'geocoding' && (
                      <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                    )}
                    {row.status === 'success' && (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    )}
                    {row.status === 'error' && (
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
