import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
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
  getMetricValue,
  getNormalizedHeatScore,
  getPricePerSqft,
  getTierColorHex,
  runVettingAnalysis,
  type RgbaColor,
} from '../utils/valuation';

interface LeafletJamaicaMapProps {
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

function buildColorLut(colorRange: RgbaColor[]): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(256 * 4);
  const stops = colorRange.length;
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    if (t < 0.03) {
      lut[i * 4 + 3] = 0;
      continue;
    }
    const scaled = t * (stops - 1);
    const low = Math.floor(scaled);
    const high = Math.min(stops - 1, low + 1);
    const frac = scaled - low;
    const c0 = colorRange[low];
    const c1 = colorRange[high];
    lut[i * 4] = Math.round(c0[0] + (c1[0] - c0[0]) * frac);
    lut[i * 4 + 1] = Math.round(c0[1] + (c1[1] - c0[1]) * frac);
    lut[i * 4 + 2] = Math.round(c0[2] + (c1[2] - c0[2]) * frac);
    const alphaRamp = Math.min(1, (t - 0.03) / 0.22);
    lut[i * 4 + 3] = Math.round((c0[3] + (c1[3] - c0[3]) * frac) * alphaRamp);
  }
  return lut;
}

export function LeafletJamaicaMap({
  properties,
  allProperties,
  settings,
  currency,
  underwritingParams,
  selectedId,
  onSelectProperty,
  fitBoundsSignal,
  focusTarget,
}: LeafletJamaicaMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const labelLayerRef = useRef<L.TileLayer | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  const [mapType, setMapType] = useState<MapTypeOption>('roadmap');
  const [manualFitSeq, setManualFitSeq] = useState(0);

  const stats = useMemo(
    () =>
      computePortfolioStats(properties, settings.weightMode, underwritingParams),
    [properties, settings.weightMode, underwritingParams]
  );

  const palette = HEATMAP_PALETTES[settings.palette];
  const combinedFitSignal = fitBoundsSignal + manualFitSeq;

  // Initialize Leaflet map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [JAMAICA_CENTER.lat, JAMAICA_CENTER.lng],
      zoom: JAMAICA_DEFAULT_ZOOM,
      zoomControl: false,
      attributionControl: true,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);
    markersLayerRef.current = L.layerGroup().addTo(map);

    map.on('click', () => {
      onSelectProperty(null);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      tileLayerRef.current = null;
      labelLayerRef.current = null;
      markersLayerRef.current = null;
    };
  }, []);

  // Switch basemap tiles
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
      tileLayerRef.current = null;
    }
    if (labelLayerRef.current) {
      map.removeLayer(labelLayerRef.current);
      labelLayerRef.current = null;
    }

    if (mapType === 'roadmap') {
      tileLayerRef.current = L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        {
          attribution: '&copy; OpenStreetMap &copy; CARTO',
          subdomains: 'abcd',
          maxZoom: 19,
        }
      ).addTo(map);
    } else {
      tileLayerRef.current = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          attribution: 'Tiles &copy; Esri',
          maxZoom: 19,
        }
      ).addTo(map);

      if (mapType === 'hybrid') {
        labelLayerRef.current = L.tileLayer(
          'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png',
          {
            subdomains: 'abcd',
            maxZoom: 19,
          }
        ).addTo(map);
      }
    }
  }, [mapType]);

  // Draw Canvas2D heatmap overlay synchronized with Leaflet map movements
  useEffect(() => {
    const map = mapRef.current;
    const canvas = canvasRef.current;
    if (!map || !canvas) return;

    const lut = buildColorLut(palette.colorRange);
    const span = stats.maxMetric - stats.minMetric;

    const renderHeatmap = () => {
      const size = map.getSize();
      if (canvas.width !== size.x || canvas.height !== size.y) {
        canvas.width = size.x;
        canvas.height = size.y;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (!settings.visible || properties.length === 0) return;

      const radius = settings.radiusPixels;
      for (const prop of properties) {
        const pt = map.latLngToContainerPoint([prop.lat, prop.lng]);
        if (
          pt.x < -radius ||
          pt.y < -radius ||
          pt.x > size.x + radius ||
          pt.y > size.y + radius
        ) {
          continue;
        }

        const rawMetric = getMetricValue(
          prop,
          settings.weightMode,
          allProperties,
          underwritingParams
        );
        const normWeight =
          settings.weightMode === 'density' || span <= 0
            ? 0.65
            : 0.2 + ((rawMetric - stats.minMetric) / span) * 0.8;
        const alpha = Math.min(1, normWeight * 0.55 * settings.intensity);

        const grad = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, radius);
        grad.addColorStop(0, `rgba(0,0,0,${alpha})`);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        const a = data[i + 3];
        if (a === 0) continue;
        const lutIdx = a * 4;
        data[i] = lut[lutIdx];
        data[i + 1] = lut[lutIdx + 1];
        data[i + 2] = lut[lutIdx + 2];
        data[i + 3] = lut[lutIdx + 3];
      }
      ctx.putImageData(imgData, 0, 0);
    };

    renderHeatmap();
    map.on('move zoom viewreset resize', renderHeatmap);
    return () => {
      map.off('move zoom viewreset resize', renderHeatmap);
    };
  }, [
    properties,
    allProperties,
    settings,
    palette,
    stats,
    underwritingParams,
  ]);

  // Render clickable property pins
  useEffect(() => {
    const map = mapRef.current;
    const layer = markersLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    if (!settings.showMarkers) return;

    properties.forEach((prop) => {
      const score = getNormalizedHeatScore(
        prop,
        stats,
        settings.weightMode,
        allProperties,
        underwritingParams
      );
      const tierColor = getTierColorHex(score, settings.palette);
      const isSelected = prop.id === selectedId;
      const analysis = runVettingAnalysis(prop, allProperties, underwritingParams);

      let label = formatMoney(prop.value, currency, underwritingParams.fxRate, true);
      if (settings.weightMode === 'price_per_sqft') {
        label = `$${getPricePerSqft(prop)}/sf`;
      } else if (settings.weightMode === 'cap_rate') {
        label = `${analysis.activeStrategyCapRatePct.toFixed(1)}%`;
      }

      const verdictDot =
        analysis.verdict === 'Pursue'
          ? '#10b981'
          : analysis.verdict === 'Negotiate'
            ? '#f59e0b'
            : '#ef4444';

      const html = `
        <div class="jamaica-pin ${isSelected ? 'jamaica-pin-selected' : ''}" title="${prop.name} (${prop.parish})">
          <span class="jamaica-pin-dot" style="background:${settings.weightMode === 'cap_rate' ? verdictDot : tierColor};"></span>
          <span>${label}</span>
        </div>
      `;

      const icon = L.divIcon({
        html,
        className: 'jamaica-pin-wrapper',
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      const marker = L.marker([prop.lat, prop.lng], {
        icon,
        zIndexOffset: isSelected ? 1000 : Math.round(score * 300),
      });

      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        onSelectProperty(prop.id);
      });

      marker.addTo(layer);
    });
  }, [
    properties,
    allProperties,
    settings,
    stats,
    selectedId,
    currency,
    underwritingParams,
    onSelectProperty,
  ]);

  // Fit bounds when requested
  useEffect(() => {
    const map = mapRef.current;
    if (!map || properties.length === 0 || combinedFitSignal === 0) return;
    if (properties.length === 1) {
      map.setView([properties[0].lat, properties[0].lng], 14, { animate: true });
      return;
    }
    const bounds = L.latLngBounds(properties.map((p) => [p.lat, p.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [56, 56], maxZoom: 14, animate: true });
  }, [combinedFitSignal]);

  // Focus specific target
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusTarget) return;
    const nextZoom = focusTarget.zoom ?? Math.max(map.getZoom(), 13);
    map.setView([focusTarget.lat, focusTarget.lng], nextZoom, { animate: true });
  }, [focusTarget]);

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
      <div ref={containerRef} className="h-full w-full z-0" />

      {/* Synchronized Thermal Heatmap Canvas */}
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 z-[400]"
        style={{ opacity: settings.opacity }}
        aria-hidden="true"
      />

      {/* Top-Right Floating Map Controls */}
      <div className="pointer-events-auto absolute right-4 top-4 z-[500] flex items-center gap-2">
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
          title="Fit map to matching Jamaica listings"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs font-medium text-slate-700 shadow-sm backdrop-blur-sm transition-colors hover:bg-white hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap shrink-0"
        >
          <Crosshair className="h-3.5 w-3.5" />
          Fit Bounds
        </button>
      </div>

      {/* Bottom-Left Thermal Value Scale Legend */}
      <div className="pointer-events-auto absolute bottom-5 left-4 z-[500] w-72 rounded-lg border border-slate-200 bg-white/95 p-3.5 shadow-sm backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
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
          aria-label={`${palette.label} heat intensity gradient`}
        />

        {properties.length > 0 ? (
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
        ) : (
          <p className="mt-1.5 text-[11px] text-slate-500">
            Adjust filters or search a Jamaica address to populate heatmap
          </p>
        )}
      </div>
    </div>
  );
}
