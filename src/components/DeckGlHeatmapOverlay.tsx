import { useEffect, useMemo, useRef, useState } from 'react';
import { useMap } from '@vis.gl/react-google-maps';
import { GoogleMapsOverlay } from '@deck.gl/google-maps';
import { HeatmapLayer } from '@deck.gl/aggregation-layers';
import type { LayersList } from '@deck.gl/core';
import type { HeatmapSettings, PropertyRecord } from '../types/property';
import {
  HEATMAP_PALETTES,
  getMetricValue,
  type RgbaColor,
} from '../utils/valuation';

interface DeckGlHeatmapOverlayProps {
  properties: PropertyRecord[];
  settings: HeatmapSettings;
}

function checkWebGL2Support(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    return Boolean(gl);
  } catch {
    return false;
  }
}

/**
 * Fallback 2D Canvas Google Maps OverlayView renderer used automatically when
 * WebGL2 is unavailable or if a WebGL context fails at runtime.
 */
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
    const alphaRamp = Math.min(1, (t - 0.03) / 0.25);
    lut[i * 4 + 3] = Math.round((c0[3] + (c1[3] - c0[3]) * frac) * alphaRamp);
  }
  return lut;
}

export function DeckGlHeatmapOverlay({
  properties,
  settings,
}: DeckGlHeatmapOverlayProps) {
  const map = useMap();
  const webgl2Supported = useMemo(() => checkWebGL2Support(), []);
  const [deckFailed, setDeckFailed] = useState(false);

  const weightStats = useMemo(() => {
    if (properties.length === 0) return { min: 0, max: 1 };
    const vals = properties.map((p) => getMetricValue(p, settings.weightMode));
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    return { min, max };
  }, [properties, settings.weightMode]);

  // Primary GPU path: deck.gl HeatmapLayer + GoogleMapsOverlay
  // Doc: https://developers.google.com/maps/documentation/javascript/examples/deckgl-heatmap?utm_campaign=gmp_mcp_codeassist_v1_aistudio
  const deckOverlay = useMemo(() => {
    if (!webgl2Supported || deckFailed) return null;
    try {
      return new GoogleMapsOverlay({
        interleaved: false,
        onError: (err: Error) => {
          console.warn('Deck.gl overlay fallback activated:', err?.message);
          setDeckFailed(true);
        },
      });
    } catch {
      return null;
    }
  }, [webgl2Supported, deckFailed]);

  useEffect(() => {
    if (!deckOverlay || !map) return;
    try {
      deckOverlay.setMap(map);
    } catch {
      setDeckFailed(true);
      return;
    }
    return () => {
      try {
        deckOverlay.setMap(null);
      } catch {
        // Ignore teardown errors
      }
    };
  }, [deckOverlay, map]);

  const layers: LayersList = useMemo(() => {
    if (!deckOverlay || !settings.visible || properties.length === 0) {
      return [];
    }

    try {
      const palette = HEATMAP_PALETTES[settings.palette];
      const span = weightStats.max - weightStats.min;

      return [
        new HeatmapLayer<PropertyRecord>({
          id: 'parcel-value-heatmap',
          data: properties,
          getPosition: (d) => [d.lng, d.lat],
          getWeight: (d) => {
            if (settings.weightMode === 'density') return 1;
            const raw = getMetricValue(d, settings.weightMode);
            if (span <= 0) return 1;
            return 0.12 + ((raw - weightStats.min) / span) * 0.88;
          },
          radiusPixels: settings.radiusPixels,
          intensity: settings.intensity,
          threshold: 0.03,
          opacity: settings.opacity,
          aggregation: settings.aggregation,
          colorRange: palette.colorRange,
          weightsTextureSize: 1024,
          updateTriggers: {
            getWeight: [settings.weightMode, weightStats.min, weightStats.max],
          },
        }),
      ];
    } catch {
      return [];
    }
  }, [deckOverlay, properties, settings, weightStats]);

  useEffect(() => {
    if (!deckOverlay) return;
    try {
      deckOverlay.setProps({ layers });
    } catch {
      setDeckFailed(true);
    }
  }, [deckOverlay, layers]);

  // Graceful Canvas2D OverlayView fallback when WebGL2 is unavailable or fails (CF3)
  const fallbackRef = useRef<google.maps.OverlayView | null>(null);

  useEffect(() => {
    if (
      deckOverlay ||
      !map ||
      typeof google === 'undefined' ||
      !google.maps?.OverlayView
    ) {
      return;
    }

    if (!settings.visible || properties.length === 0) {
      if (fallbackRef.current) {
        fallbackRef.current.setMap(null);
        fallbackRef.current = null;
      }
      return;
    }

    const palette = HEATMAP_PALETTES[settings.palette];
    const lut = buildColorLut(palette.colorRange);
    const span = weightStats.max - weightStats.min;

    class Canvas2DHeatmapOverlay extends google.maps.OverlayView {
      private canvas: HTMLCanvasElement | null = null;

      onAdd() {
        const canvas = document.createElement('canvas');
        canvas.style.position = 'absolute';
        canvas.style.pointerEvents = 'none';
        canvas.style.opacity = String(settings.opacity);
        this.canvas = canvas;
        const panes = this.getPanes();
        panes?.overlayLayer.appendChild(canvas);
      }

      draw() {
        const canvas = this.canvas;
        const projection = this.getProjection();
        const bounds = map?.getBounds();
        if (!canvas || !projection || !bounds) return;

        const sw = projection.fromLatLngToDivPixel(bounds.getSouthWest());
        const ne = projection.fromLatLngToDivPixel(bounds.getNorthEast());
        if (!sw || !ne) return;

        const width = Math.max(1, Math.round(ne.x - sw.x));
        const height = Math.max(1, Math.round(sw.y - ne.y));
        canvas.style.left = `${Math.round(sw.x)}px`;
        canvas.style.top = `${Math.round(ne.y)}px`;
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, width, height);

        const radius = settings.radiusPixels;
        for (const prop of properties) {
          const px = projection.fromLatLngToDivPixel(
            new google.maps.LatLng(prop.lat, prop.lng)
          );
          if (!px) continue;
          const x = px.x - sw.x;
          const y = px.y - ne.y;
          if (
            x < -radius ||
            y < -radius ||
            x > width + radius ||
            y > height + radius
          ) {
            continue;
          }

          const normWeight =
            settings.weightMode === 'density' || span <= 0
              ? 0.65
              : 0.18 +
                ((getMetricValue(prop, settings.weightMode) - weightStats.min) /
                  span) *
                  0.82;
          const alpha = Math.min(1, normWeight * 0.55 * settings.intensity);

          const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
          grad.addColorStop(0, `rgba(0,0,0,${alpha})`);
          grad.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fill();
        }

        const imgData = ctx.getImageData(0, 0, width, height);
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
      }

      onRemove() {
        if (this.canvas && this.canvas.parentNode) {
          this.canvas.parentNode.removeChild(this.canvas);
        }
        this.canvas = null;
      }
    }

    const overlay = new Canvas2DHeatmapOverlay();
    overlay.setMap(map);
    fallbackRef.current = overlay;

    return () => {
      overlay.setMap(null);
      if (fallbackRef.current === overlay) {
        fallbackRef.current = null;
      }
    };
  }, [deckOverlay, map, properties, settings, weightStats]);

  return null;
}
