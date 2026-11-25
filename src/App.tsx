import React, { Component, useCallback, useMemo, useRef, useState } from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';
import type {
  CurrencyCode,
  DealStatus,
  HeatmapSettings,
  PropertyFilters,
  PropertyRecord,
  PropertyType,
  UnderwritingParams,
  VettingAnalysis,
  WorkspaceTab,
} from './types/property';
import { JAMAICA_LISTINGS } from './data/jamaicaListings';
import {
  DEFAULT_UNDERWRITING_PARAMS,
  runVettingAnalysis,
} from './utils/valuation';
import { lookupAndCreateJamaicaProperty } from './services/geocodeService';
import { StudioSidebar } from './components/StudioSidebar';
import { LeafletJamaicaMap } from './components/LeafletJamaicaMap';
import { RealEstateMap } from './components/RealEstateMap';
import { PropertyVettingDrawer } from './components/PropertyVettingDrawer';
import { VettingReportModal } from './components/VettingReportModal';
import { PropertyLedgerView } from './components/PropertyLedgerView';
import { BatchGeocodeView } from './components/BatchGeocodeView';
import { HowItWorksView } from './components/HowItWorksView';

const MAPS_API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();

class AppErrorBoundary extends Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
          <h1 className="font-display text-lg font-semibold text-slate-900">
            Workspace interrupted
          </h1>
          <p className="mt-1.5 max-w-md text-sm text-slate-600">
            {this.state.error.message || 'An unexpected rendering issue occurred.'}
          </p>
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800"
          >
            Reload Workspace
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const DEFAULT_HEATMAP_SETTINGS: HeatmapSettings = {
  visible: true,
  showMarkers: true,
  weightMode: 'value',
  palette: 'infrared',
  aggregation: 'SUM',
  radiusPixels: 54,
  intensity: 1.5,
  opacity: 0.78,
};

const DEFAULT_FILTERS: PropertyFilters = {
  searchQuery: '',
  parishes: [],
  propertyTypes: [],
  dealStatuses: [],
  minPriceUsd: null,
  maxPriceUsd: null,
  minBeds: null,
  verdictFilter: 'All',
};

function WorkspaceContent({ useGoogleMaps }: { useGoogleMaps: boolean }) {
  const addressInputRef = useRef<HTMLInputElement | null>(null);

  const [activeTab, setActiveTab] = useState<WorkspaceTab>('studio');
  const [properties, setProperties] = useState<PropertyRecord[]>(JAMAICA_LISTINGS);
  const [filters, setFilters] = useState<PropertyFilters>(DEFAULT_FILTERS);
  const [settings, setSettings] = useState<HeatmapSettings>(
    DEFAULT_HEATMAP_SETTINGS
  );
  const [currency, setCurrency] = useState<CurrencyCode>('USD');
  const [underwritingParams, setUnderwritingParams] = useState<UnderwritingParams>(
    DEFAULT_UNDERWRITING_PARAMS
  );
  const [selectedId, setSelectedId] = useState<string | null>(
    JAMAICA_LISTINGS[0]?.id ?? null
  );
  const [reportAnalysis, setReportAnalysis] = useState<VettingAnalysis | null>(
    null
  );
  const [fitBoundsSignal, setFitBoundsSignal] = useState(0);
  const [focusTarget, setFocusTarget] = useState<{
    lat: number;
    lng: number;
    zoom?: number;
    seq: number;
  } | null>(null);

  const filteredProperties = useMemo(() => {
    const q = filters.searchQuery.trim().toLowerCase();
    return properties.filter((p) => {
      if (filters.parishes.length > 0 && !filters.parishes.includes(p.parish)) {
        return false;
      }
      if (
        filters.propertyTypes.length > 0 &&
        !filters.propertyTypes.includes(p.propertyType)
      ) {
        return false;
      }
      if (
        filters.dealStatuses.length > 0 &&
        !filters.dealStatuses.includes(p.dealStatus)
      ) {
        return false;
      }
      if (filters.minPriceUsd !== null && p.value < filters.minPriceUsd) {
        return false;
      }
      if (filters.maxPriceUsd !== null && p.value > filters.maxPriceUsd) {
        return false;
      }
      if (filters.minBeds !== null && p.beds < filters.minBeds) {
        return false;
      }
      if (filters.verdictFilter !== 'All') {
        const analysis = runVettingAnalysis(p, properties, underwritingParams);
        if (analysis.verdict !== filters.verdictFilter) {
          return false;
        }
      }
      if (q) {
        const matchesText =
          p.name.toLowerCase().includes(q) ||
          p.address.toLowerCase().includes(q) ||
          p.parish.toLowerCase().includes(q) ||
          p.community.toLowerCase().includes(q) ||
          (p.mlsNumber || '').toLowerCase().includes(q);
        if (!matchesText) return false;
      }
      return true;
    });
  }, [properties, filters, underwritingParams]);

  const selectedProperty = useMemo(
    () => properties.find((p) => p.id === selectedId) ?? null,
    [properties, selectedId]
  );

  const handleLookupAddress = useCallback(
    async (input: {
      query: string;
      valueUsd?: number;
      beds?: number;
      propertyType?: PropertyType;
      dealStatus?: DealStatus;
    }) => {
      const created = await lookupAndCreateJamaicaProperty(input);
      setProperties((prev) => [created, ...prev]);
      setFilters((prev) => ({ ...prev, searchQuery: '' }));
      setSelectedId(created.id);
      setFocusTarget({
        lat: created.lat,
        lng: created.lng,
        zoom: 14,
        seq: Date.now(),
      });
    },
    []
  );

  const handleUpdateProperty = useCallback(
    (
      id: string,
      updates: Partial<
        Pick<
          PropertyRecord,
          | 'value'
          | 'sqft'
          | 'lotSqft'
          | 'propertyType'
          | 'estimatedCapexUsd'
          | 'estimatedLtrMonthlyJmd'
          | 'estimatedStrNightlyUsd'
        >
      >
    ) => {
      setProperties((prev) =>
        prev.map((p) =>
          p.id === id
            ? {
                ...p,
                ...updates,
                valuationNote: 'User edited',
              }
            : p
        )
      );
    },
    []
  );

  const handleDeleteProperty = useCallback((id: string) => {
    setProperties((prev) => prev.filter((p) => p.id !== id));
    setSelectedId((curr) => (curr === id ? null : curr));
  }, []);

  const handleClearAll = useCallback(() => {
    setProperties([]);
    setSelectedId(null);
  }, []);

  const handleSelectAndFocus = useCallback((prop: PropertyRecord) => {
    setSelectedId(prop.id);
    setActiveTab('studio');
    setFocusTarget({
      lat: prop.lat,
      lng: prop.lng,
      zoom: 13,
      seq: Date.now(),
    });
  }, []);

  const handleBatchComplete = useCallback(
    (newProperties: PropertyRecord[], replaceExisting: boolean) => {
      setProperties((prev) =>
        replaceExisting ? newProperties : [...newProperties, ...prev]
      );
      setSelectedId(newProperties[0]?.id ?? null);
      setFitBoundsSignal((n) => n + 1);
    },
    []
  );

  const handlePrimarySearchCta = () => {
    setActiveTab('studio');
    window.setTimeout(() => {
      addressInputRef.current?.focus();
    }, 60);
  };

  const navItems: Array<{ id: WorkspaceTab; label: string }> = [
    { id: 'studio', label: 'Search & Heatmap' },
    { id: 'ledger', label: 'Property Ledger' },
    { id: 'batch', label: 'Batch Geocode' },
    { id: 'framework', label: 'Vetting Framework' },
  ];

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="flex shrink-0 items-center justify-between gap-6 border-b border-slate-200 bg-white px-6 py-3 print:hidden">
        <a
          href="#studio"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('studio');
          }}
          className="flex items-center gap-2 font-display text-lg font-bold tracking-tight text-slate-950 whitespace-nowrap shrink-0"
        >
          <span className="inline-block h-2.5 w-2.5 rounded-xs bg-emerald-600" />
          Jamaica ParcelHeat
        </a>

        <nav
          aria-label="Primary workspace navigation"
          className="flex items-center gap-6 overflow-x-auto text-sm font-medium"
        >
          {navItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`relative py-1 transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'text-slate-950 font-semibold'
                    : 'text-slate-600 hover:text-slate-950'
                }`}
              >
                {item.label}
                {active && (
                  <span
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-950"
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-2.5 shrink-0">
          <div
            className="flex items-center rounded-lg border border-slate-200 bg-slate-100 p-0.5 font-mono text-xs"
            role="group"
            aria-label="Display currency"
          >
            {(['USD', 'JMD'] as CurrencyCode[]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCurrency(c)}
                className={`rounded-md px-2.5 py-1 font-semibold transition-colors ${
                  currency === c
                    ? 'bg-white text-slate-950 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handlePrimarySearchCta}
            className="rounded-lg bg-slate-950 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800 whitespace-nowrap shrink-0"
          >
            Search Address
          </button>
        </div>
      </header>

      {/* Main Content Viewport */}
      <main className="flex-1 min-h-0 overflow-hidden print:hidden">
        {activeTab === 'studio' && (
          <div className="flex h-full flex-col lg:flex-row">
            <StudioSidebar
              filteredProperties={filteredProperties}
              allProperties={properties}
              filters={filters}
              onFiltersChange={setFilters}
              onResetFilters={() => setFilters(DEFAULT_FILTERS)}
              settings={settings}
              onSettingsChange={setSettings}
              currency={currency}
              underwritingParams={underwritingParams}
              selectedId={selectedId}
              onSelectAndFocus={handleSelectAndFocus}
              onLookupAddress={handleLookupAddress}
              addressInputRef={addressInputRef}
            />

            <div className="relative flex-1 min-h-[400px] h-full">
              {useGoogleMaps ? (
                <RealEstateMap
                  properties={filteredProperties}
                  allProperties={properties}
                  settings={settings}
                  currency={currency}
                  underwritingParams={underwritingParams}
                  selectedId={selectedId}
                  onSelectProperty={setSelectedId}
                  fitBoundsSignal={fitBoundsSignal}
                  focusTarget={focusTarget}
                />
              ) : (
                <LeafletJamaicaMap
                  properties={filteredProperties}
                  allProperties={properties}
                  settings={settings}
                  currency={currency}
                  underwritingParams={underwritingParams}
                  selectedId={selectedId}
                  onSelectProperty={setSelectedId}
                  fitBoundsSignal={fitBoundsSignal}
                  focusTarget={focusTarget}
                />
              )}
            </div>

            {selectedProperty && (
              <PropertyVettingDrawer
                property={selectedProperty}
                allProperties={properties}
                currency={currency}
                underwritingParams={underwritingParams}
                onUnderwritingChange={setUnderwritingParams}
                onUpdateProperty={handleUpdateProperty}
                onDeleteProperty={handleDeleteProperty}
                onOpenReport={setReportAnalysis}
                onClose={() => setSelectedId(null)}
              />
            )}
          </div>
        )}

        {activeTab === 'ledger' && (
          <PropertyLedgerView
            properties={filteredProperties}
            allProperties={properties}
            currency={currency}
            underwritingParams={underwritingParams}
            onUpdateProperty={handleUpdateProperty}
            onDeleteProperty={handleDeleteProperty}
            onClearAll={handleClearAll}
            onLocateOnMap={handleSelectAndFocus}
            onOpenReport={setReportAnalysis}
          />
        )}

        {activeTab === 'batch' && (
          <BatchGeocodeView
            existingProperties={properties}
            onBatchComplete={handleBatchComplete}
            onOpenStudio={() => setActiveTab('studio')}
          />
        )}

        {activeTab === 'framework' && (
          <HowItWorksView onNavigate={setActiveTab} />
        )}
      </main>

      {/* Full-Screen Printable 5-Stage Vetting Report Modal */}
      {reportAnalysis && (
        <VettingReportModal
          analysis={reportAnalysis}
          onClose={() => setReportAnalysis(null)}
        />
      )}
    </div>
  );
}

export default function App() {
  const hasGoogleMapsKey = Boolean(MAPS_API_KEY);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-slate-50 text-slate-900 print:h-auto print:w-auto print:overflow-visible">
      <AppErrorBoundary>
        {hasGoogleMapsKey ? (
          <APIProvider apiKey={MAPS_API_KEY} language="en" region="JM">
            <WorkspaceContent useGoogleMaps={true} />
          </APIProvider>
        ) : (
          <WorkspaceContent useGoogleMaps={false} />
        )}
      </AppErrorBoundary>
    </div>
  );
}
