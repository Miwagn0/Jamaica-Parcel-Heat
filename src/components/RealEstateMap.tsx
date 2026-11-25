import React, { Component, useEffect, useMemo, useRef, useState } from 'react';
import {
  AdvancedMarker,
  APILoadingStatus,
  Map as GoogleMap,
  useApiLoadingStatus,
  useMap,
} from '@vis.gl/react-google-maps';
import { Crosshair, Layers } from 'lucide-react';
import type {
  CurrencyCode,
  HeatmapSettings,
  MapTypeOption,
  PropertyRecord,
  UnderwritingParams,
} from '../types/property';
import { JAMAICA_CENTER, JAMAICA_DEFAULT_ZOOM } from '../data/jamaicaListings';
import {
  HEATMAP_PALETTES,
  computePortfolioStats,
  formatMetricValue,
  formatMoney,
  getNormalizedHeatScore,
  getPricePerSqft,
  getTierColorHex,
  runVettingAnalysis,
} from '../utils/valuation';
import { DeckGlHeatmapOverlay } from './DeckGlHeatmapOverlay';

interface RealEstateMapProps {
  properties: PropertyRecord[];
  allProperties: PropertyRecord[];
  settings: HeatmapSettings;
  currency: CurrencyCode;
  underwritingParams: UnderwritingParams;
  selectedId: string | null;
  onSelectProperty: (id: string | null) => void;
  fitBoundsSignal: number;
  focusTarget: { lat: number; lng: number; zoom?: number; seq: number } | null;
}

class OverlayErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

function MapCameraController({
  properties,
  fitBoundsSignal,
  focusTarget,
}: {
  properties: PropertyRecord[];
  fitBoundsSignal: number;
  focusTarget: { lat: number; lng: number; zoom?: number; seq: number } | null;
}) {
  const map = useMap();
  const propertiesRef = useRef(properties);
  propertiesRef.current = properties;

  useEffect(() => {
    const list = propertiesRef.current;
    if (!map || list.length === 0 || fitBoundsSignal === 0) return;
    if (list.length === 1) {
      map.panTo({ lat: list[0].lat, lng: list[0].lng });
      map.setZoom(14);
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    list.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
    map.fitBounds(bounds, { top: 64, right: 64, bottom: 96, left: 64 });
  }, [map, fitBoundsSignal]);

  useEffect(() => {
    if (!map || !focusTarget) return;
    map.panTo({ lat: focusTarget.lat, lng: focusTarget.lng });
    const targetZoom = focusTarget.zoom ?? Math.max(map.getZoom() ?? 10, 13);
    map.setZoom(targetZoom);
  }, [map, focusTarget]);

  return null;
}

export function RealEstateMap({
  properties,
  allProperties,
  settings,
  currency,
  underwritingParams,
  selectedId,
  onSelectProperty,
  fitBoundsSignal,
  focusTarget,
}: RealEstateMapProps) {
  const loadingStatus = useApiLoadingStatus();
  const [mapType, setMapType] = useState<MapTypeOption>('roadmap');
  const [manualFitSeq, setManualFitSeq] = useState(0);

  const stats = useMemo(
    () =>
      computePortfolioStats(properties, settings.weightMode, underwritingParams),
    [properties, settings.weightMode, underwritingParams]
  );

  const palette = HEATMAP_PALETTES[settings.palette];
  const combinedFitSignal = fitBoundsSignal + manualFitSeq;

  const weightLabel =
    settings.weightMode === 'value'
      ? `Asking Price (${currency})`
      : settings.weightMode === 'price_per_sqft'
        ? `Price / Sq Ft (${currency})`
        : settings.weightMode === 'cap_rate'
          ? `Net Cap Rate (${underwritingParams.strategy})`
          : 'Listing Density';

  return (
    <div className="relative h-full w-full min-h-[420px] bg-slate-100">
      {loadingStatus === APILoadingStatus.FAILED ||
      loadingStatus === APILoadingStatus.AUTH_FAILURE ? (
        <div className="flex h-full w-full flex-col items-center justify-center p-8 text-center">
          <p className="font-display text-base font-semibold text-slate-900">
            Google Maps unavailable
          </p>
          <p className="mt-1.5 max-w-md text-sm text-slate-600">
            Verify VITE_GOOGLE_MAPS_API_KEY or unset it to use the built-in zero-key Leaflet Jamaica map.
          </p>
        </div>
      ) : (
        <GoogleMap
          mapId="DEMO_MAP_ID"
          defaultCenter={JAMAICA_CENTER}
          defaultZoom={JAMAICA_DEFAULT_ZOOM}
          mapTypeId={mapType}
          gestureHandling="greedy"
          streetViewControl={false}
          fullscreenControl={false}
          mapTypeControl={false}
          clickableIcons={false}
          className="h-full w-full"
          style={{ width: '100%', height: '100%' }}
          onClick={() => onSelectProperty(null)}
        >
          <MapCameraController
            properties={properties}
            fitBoundsSignal={combinedFitSignal}
            focusTarget={focusTarget}
          />

          <OverlayErrorBoundary>
            <DeckGlHeatmapOverlay properties={properties} settings={settings} />
          </OverlayErrorBoundary>

          {settings.showMarkers &&
            properties.map((prop) => {
              const score = getNormalizedHeatScore(
                prop,
                stats,
                settings.weightMode,
                allProperties,
                underwritingParams
              );
              const tierColor = getTierColorHex(score, settings.palette);
              const isSelected = prop.id === selectedId;
              const analysis = runVettingAnalysis(
                prop,
                allProperties,
                underwritingParams
              );

              let label = formatMoney(
                prop.value,
                currency,
                underwritingParams.fxRate,
                true
              );
              if (settings.weightMode === 'price_per_sqft') {
                label = `$${getPricePerSqft(prop)}/sf`;
              } else if (settings.weightMode === 'cap_rate') {
                label = `${analysis.activeStrategyCapRatePct.toFixed(1)}%`;
              }

              return (
                <AdvancedMarker
                  key={prop.id}
                  position={{ lat: prop.lat, lng: prop.lng }}
                  zIndex={isSelected ? 50 : Math.round(score * 30)}
                  onClick={() => onSelectProperty(prop.id)}
                >
                  <div
                    className={`flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[11px] font-semibold tabular-nums shadow-sm transition-transform duration-150 ${
                      isSelected
                        ? 'scale-110 border-slate-950 bg-slate-950 text-white shadow-md'
                        : 'border-slate-300/90 bg-white/95 text-slate-900 hover:scale-105 hover:border-slate-900'
                    }`}
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-[2px]"
                      style={{ backgroundColor: tierColor }}
                      aria-hidden="true"
                    />
                    <span className="whitespace-nowrap">{label}</span>
                  </div>
                </AdvancedMarker>
              );
            })}
        </GoogleMap>
      )}

      {/* Top-Right Floating Map Controls */}
      <div className="pointer-events-auto absolute right-4 top-4 z-10 flex items-center gap-2">
        <div
          className="flex items-center rounded-lg border border-slate-200 bg-white/95 p-1 shadow-sm backdrop-blur-sm"
          role="group"
          aria-label="Map layer style"
        >
          {(['roadmap', 'satellite', 'hybrid'] as MapTypeOption[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setMapType(mode)}
              className={`rounded-md px-2.5 py-1.5 text-xs font-medium capitalize transition-colors whitespace-nowrap shrink-0 ${
                mapType === mode
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-950'
              }`}
            >
              {mode === 'roadmap' ? 'Map' : mode}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setManualFitSeq((n) => n + 1)}
          disabled={properties.length === 0}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs font-medium text-slate-700 shadow-sm backdrop-blur-sm hover:bg-white hover:text-slate-950 disabled:opacity-50"
        >
          <Crosshair className="h-3.5 w-3.5" />
          Fit Bounds
        </button>
      </div>

      {/* Bottom-Left Thermal Value Scale Legend */}
      <div className="pointer-events-auto absolute bottom-5 left-4 z-10 w-72 rounded-lg border border-slate-200 bg-white/95 p-3.5 shadow-sm backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-slate-500" />
            <span className="text-xs font-semibold text-slate-900">
              {weightLabel}
            </span>
          </div>
          <span className="font-mono text-[11px] text-slate-500 tabular-nums">
            {properties.length} {properties.length === 1 ? 'listing' : 'listings'}
          </span>
        </div>

        <div
          className="mt-2.5 h-2.5 w-full rounded-sm border border-black/5"
          style={{ background: palette.cssGradient }}
        />

        {properties.length > 0 && (
          <div className="mt-1.5 flex items-center justify-between font-mono text-[11px] text-slate-600 tabular-nums">
            <span>
              {formatMetricValue(
                stats.minMetric,
                settings.weightMode,
                currency,
                underwritingParams.fxRate
              )}
            </span>
            <span className="text-slate-400">
              Med{' '}
              {formatMetricValue(
                stats.medianMetric,
                settings.weightMode,
                currency,
                underwritingParams.fxRate
              )}
            </span>
            <span className="font-semibold text-slate-900">
              {formatMetricValue(
                stats.maxMetric,
                settings.weightMode,
                currency,
                underwritingParams.fxRate
              )}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
