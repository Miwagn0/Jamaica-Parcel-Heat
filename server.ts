import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const IS_PROD = process.env.NODE_ENV === 'production';

interface GeocodePayload {
  lat: number;
  lng: number;
  formattedAddress: string;
  placeId?: string;
  granularity:
    | 'ROOFTOP'
    | 'RANGE_INTERPOLATED'
    | 'GEOMETRIC_CENTER'
    | 'APPROXIMATE'
    | 'NOMINATIM';
}

const PARISH_CENTROIDS: Array<{
  keywords: string[];
  parish: string;
  lat: number;
  lng: number;
}> = [
  { keywords: ['winchester', 'green island'], parish: 'Hanover', lat: 18.3848, lng: -78.2682 },
  { keywords: ['lucea', 'oceanpointe', 'hopewell', 'hanover', 'orange bay'], parish: 'Hanover', lat: 18.451, lng: -78.173 },
  { keywords: ['negril', 'westmoreland', 'savanna-la-mar', 'little bay'], parish: 'Westmoreland', lat: 18.2683, lng: -78.3481 },
  { keywords: ['montego bay', 'st. james', 'st james', 'ironshore', 'bogue', 'freeport', 'rose hall'], parish: 'St. James', lat: 18.4762, lng: -77.8939 },
  { keywords: ['ocho rios', 'drax hall', 'mammee bay', 'runaway bay', 'st. ann', 'st ann', 'discovery bay'], parish: 'St. Ann', lat: 18.4074, lng: -77.1031 },
  { keywords: ['kingston', 'st. andrew', 'st andrew', 'norbrook', 'mona', 'cherry gardens', 'new kingston'], parish: 'Kingston & St. Andrew', lat: 18.0179, lng: -76.7885 },
  { keywords: ['port antonio', 'portland', 'san san', 'boston bay'], parish: 'Portland', lat: 18.1763, lng: -76.4508 },
  { keywords: ['treasure beach', 'st. elizabeth', 'st elizabeth', 'black river'], parish: 'St. Elizabeth', lat: 17.8878, lng: -77.7689 },
  { keywords: ['mandeville', 'manchester', 'ingleside'], parish: 'Manchester', lat: 18.0417, lng: -77.5071 },
  { keywords: ['portmore', 'spanish town', 'st. catherine', 'st catherine'], parish: 'St. Catherine', lat: 17.9598, lng: -76.8902 },
  { keywords: ['falmouth', 'trelawny', 'stonebrook'], parish: 'Trelawny', lat: 18.4936, lng: -77.6562 },
  { keywords: ['may pen', 'clarendon'], parish: 'Clarendon', lat: 17.9645, lng: -77.2451 },
  { keywords: ['morant bay', 'st. thomas', 'st thomas'], parish: 'St. Thomas', lat: 17.8815, lng: -76.4093 },
  { keywords: ['oracabessa', 'port maria', 'st. mary', 'st mary'], parish: 'St. Mary', lat: 18.3702, lng: -76.8897 },
];

function getMapsApiKey(): string {
  return (
    process.env.VITE_GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    ''
  ).trim();
}

function normalizeGranularity(
  raw?: string
): GeocodePayload['granularity'] {
  if (raw === 'ROOFTOP') return 'ROOFTOP';
  if (raw === 'RANGE_INTERPOLATED') return 'RANGE_INTERPOLATED';
  if (raw === 'GEOMETRIC_CENTER') return 'GEOMETRIC_CENTER';
  if (raw === 'NOMINATIM') return 'NOMINATIM';
  return 'APPROXIMATE';
}

function ensureJamaicaContext(address: string): string {
  if (/jamaica/i.test(address)) return address;
  return `${address}, Jamaica`;
}

async function geocodeViaNominatim(address: string): Promise<GeocodePayload | null> {
  try {
    const query = ensureJamaicaContext(address);
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=jm&q=${encodeURIComponent(
      query
    )}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'JamaicaParcelHeat/1.0 (property-vetting-tool)',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{
      lat?: string;
      lon?: string;
      display_name?: string;
      place_id?: number;
    }>;
    if (rows && rows.length > 0 && rows[0].lat && rows[0].lon) {
      return {
        lat: Number(rows[0].lat),
        lng: Number(rows[0].lon),
        formattedAddress: rows[0].display_name || query,
        placeId: rows[0].place_id ? `osm-${rows[0].place_id}` : undefined,
        granularity: 'NOMINATIM',
      };
    }
  } catch {
    // Fall through to parish centroid fallback
  }
  return null;
}

function geocodeParishFallback(address: string): GeocodePayload {
  const lower = address.toLowerCase();
  const match = PARISH_CENTROIDS.find((p) =>
    p.keywords.some((k) => lower.includes(k))
  );
  // Deterministic micro-offset so multiple fallback pins in the same parish do not stack
  let hash = 0;
  for (let i = 0; i < address.length; i++) {
    hash = (hash * 31 + address.charCodeAt(i)) | 0;
  }
  const jitterLat = (((hash & 0xff) / 255) - 0.5) * 0.018;
  const jitterLng = ((((hash >> 8) & 0xff) / 255) - 0.5) * 0.018;

  const baseLat = match?.lat ?? 18.0179;
  const baseLng = match?.lng ?? -76.7885;

  return {
    lat: Number((baseLat + jitterLat).toFixed(6)),
    lng: Number((baseLng + jitterLng).toFixed(6)),
    formattedAddress: ensureJamaicaContext(address),
    granularity: 'APPROXIMATE',
  };
}

async function geocodeAddressServer(address: string): Promise<{
  status: number;
  data?: GeocodePayload;
  error?: string;
  fallback?: string;
}> {
  const apiKey = getMapsApiKey();
  const jamaicaQuery = ensureJamaicaContext(address);

  // 1. Google Maps Geocoding REST API (when key is available)
  if (apiKey) {
    try {
      const restUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
        jamaicaQuery
      )}&components=country:JM&key=${encodeURIComponent(apiKey)}`;
      const restRes = await fetch(restUrl, {
        signal: AbortSignal.timeout(5000),
      });
      const restJson = (await restRes.json().catch(() => ({}))) as {
        status?: string;
        results?: Array<{
          place_id?: string;
          formatted_address?: string;
          geometry?: {
            location?: { lat?: number; lng?: number };
            location_type?: string;
          };
        }>;
      };

      if (restJson.status === 'OK' && restJson.results && restJson.results.length > 0) {
        const top = restJson.results[0];
        const loc = top.geometry?.location;
        if (typeof loc?.lat === 'number' && typeof loc?.lng === 'number') {
          return {
            status: 200,
            data: {
              lat: loc.lat,
              lng: loc.lng,
              formattedAddress: top.formatted_address || jamaicaQuery,
              placeId: top.place_id,
              granularity: normalizeGranularity(top.geometry?.location_type),
            },
          };
        }
      }
    } catch {
      // Fall through to Nominatim
    }
  }

  // 2. OpenStreetMap Nominatim (zero API key required)
  const nom = await geocodeViaNominatim(address);
  if (nom) {
    return { status: 200, data: nom };
  }

  // 3. Deterministic Jamaica Parish Fallback (always resolves)
  return {
    status: 200,
    data: geocodeParishFallback(address),
  };
}

async function fetchUrlListingMetadata(urlStr: string): Promise<{
  title?: string;
  description?: string;
  extractedAddress?: string;
  extractedPriceUsd?: number;
}> {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return {};
    }
    const slugAddress = parsed.pathname
      .split('/')
      .filter(Boolean)
      .pop()
      ?.replace(/[-_]+/g, ' ')
      .trim();

    const res = await fetch(urlStr, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; JamaicaParcelHeat/1.0)',
      },
      signal: AbortSignal.timeout(4500),
    });
    if (!res.ok) {
      return { extractedAddress: slugAddress };
    }
    const html = await res.text();
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const descMatch =
      html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
    const title = titleMatch?.[1]?.trim();
    const description = descMatch?.[1]?.trim();

    // Try extracting a USD or JMD price from title/description
    let extractedPriceUsd: number | undefined;
    const text = `${title || ''} ${description || ''}`;
    const usdMatch = text.match(/(?:US\$|\$)\s*([\d,]+(?:\.\d+)?)\s*([kKmM])?/);
    const jmdMatch = text.match(/J\$\s*([\d,]+(?:\.\d+)?)\s*([kKmM])?/i);
    if (jmdMatch) {
      const base = Number(jmdMatch[1].replace(/,/g, ''));
      const mult =
        jmdMatch[2]?.toLowerCase() === 'm'
          ? 1_000_000
          : jmdMatch[2]?.toLowerCase() === 'k'
            ? 1_000
            : 1;
      if (Number.isFinite(base) && base > 0) {
        extractedPriceUsd = Math.round((base * mult) / 158.35);
      }
    } else if (usdMatch) {
      const base = Number(usdMatch[1].replace(/,/g, ''));
      const mult =
        usdMatch[2]?.toLowerCase() === 'm'
          ? 1_000_000
          : usdMatch[2]?.toLowerCase() === 'k'
            ? 1_000
            : 1;
      if (Number.isFinite(base) && base > 0) {
        extractedPriceUsd = Math.round(base * mult);
      }
    }

    return {
      title,
      description,
      extractedAddress: slugAddress || title,
      extractedPriceUsd,
    };
  } catch {
    return {};
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      mapsKeyConfigured: Boolean(getMapsApiKey()),
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    });
  });

  app.post('/api/geocode', async (req, res) => {
    const rawAddress =
      typeof req.body?.address === 'string' ? req.body.address.trim() : '';
    if (!rawAddress || rawAddress.length > 400) {
      res
        .status(400)
        .json({ error: 'Please provide a valid Jamaica address (1-400 characters).' });
      return;
    }

    const result = await geocodeAddressServer(rawAddress);
    if (result.status === 200 && result.data) {
      res.status(200).json(result.data);
      return;
    }

    res.status(result.status).json({
      error: result.error || 'Unable to geocode address.',
      fallback: result.fallback,
    });
  });

  app.post('/api/lookup-listing', async (req, res) => {
    const rawInput =
      typeof req.body?.query === 'string' ? req.body.query.trim() : '';
    if (!rawInput) {
      res.status(400).json({ error: 'Provide a Jamaica street address or listing URL.' });
      return;
    }

    const isUrl = /^https?:\/\//i.test(rawInput);
    let meta: {
      title?: string;
      description?: string;
      extractedAddress?: string;
      extractedPriceUsd?: number;
    } = {};

    if (isUrl) {
      meta = await fetchUrlListingMetadata(rawInput);
    }

    const addressToGeocode = meta.extractedAddress || rawInput;
    const geo = await geocodeAddressServer(addressToGeocode);

    res.status(200).json({
      isUrl,
      listingUrl: isUrl ? rawInput : undefined,
      title: meta.title,
      description: meta.description,
      extractedPriceUsd: meta.extractedPriceUsd,
      geocode: geo.data,
    });
  });

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Jamaica ParcelHeat server running on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
