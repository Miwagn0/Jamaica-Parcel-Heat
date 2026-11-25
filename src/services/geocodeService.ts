import type {
  DealStatus,
  GeocodeGranularity,
  PropertyRecord,
  PropertyType,
} from '../types/property';
import { PARISH_PRESETS } from '../data/jamaicaListings';
import { inferJamaicaParish } from '../utils/valuation';

export interface GeocodeResult {
  lat: number;
  lng: number;
  formattedAddress: string;
  placeId?: string;
  granularity: GeocodeGranularity;
}

const CLIENT_PARISH_CENTROIDS: Array<{
  keywords: string[];
  lat: number;
  lng: number;
}> = [
  { keywords: ['winchester', 'green island'], lat: 18.3848, lng: -78.2682 },
  { keywords: ['lucea', 'oceanpointe', 'hopewell', 'hanover', 'orange bay'], lat: 18.451, lng: -78.173 },
  { keywords: ['negril', 'westmoreland', 'savanna-la-mar', 'little bay'], lat: 18.2683, lng: -78.3481 },
  { keywords: ['montego bay', 'st. james', 'st james', 'ironshore', 'bogue', 'freeport', 'rose hall'], lat: 18.4762, lng: -77.8939 },
  { keywords: ['ocho rios', 'drax hall', 'mammee bay', 'runaway bay', 'st. ann', 'st ann', 'discovery bay'], lat: 18.4074, lng: -77.1031 },
  { keywords: ['kingston', 'st. andrew', 'st andrew', 'norbrook', 'mona', 'cherry gardens', 'new kingston'], lat: 18.0179, lng: -76.7885 },
  { keywords: ['port antonio', 'portland', 'san san', 'boston bay'], lat: 18.1763, lng: -76.4508 },
  { keywords: ['treasure beach', 'st. elizabeth', 'st elizabeth', 'black river'], lat: 17.8878, lng: -77.7689 },
  { keywords: ['mandeville', 'manchester', 'ingleside'], lat: 18.0417, lng: -77.5071 },
  { keywords: ['portmore', 'spanish town', 'st. catherine', 'st catherine'], lat: 17.9598, lng: -76.8902 },
  { keywords: ['falmouth', 'trelawny', 'stonebrook'], lat: 18.4936, lng: -77.6562 },
  { keywords: ['may pen', 'clarendon'], lat: 17.9645, lng: -77.2451 },
  { keywords: ['morant bay', 'st. thomas', 'st thomas'], lat: 17.8815, lng: -76.4093 },
  { keywords: ['oracabessa', 'port maria', 'st. mary', 'st mary'], lat: 18.3702, lng: -76.8897 },
];

export function isQuotaErrorMessage(err: unknown): boolean {
  const text =
    err instanceof Error
      ? `${err.name} ${err.message}`
      : typeof err === 'string'
        ? err
        : JSON.stringify(err || '');
  return (
    text.includes('RESOURCE_EXHAUSTED') ||
    text.includes('OVER_QUERY_LIMIT') ||
    text.includes('QuotaExceededError') ||
    text.includes('429')
  );
}

export function notifyQuotaExceeded(): void {
  window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
}

function clientParishFallback(address: string): GeocodeResult {
  const lower = address.toLowerCase();
  const match = CLIENT_PARISH_CENTROIDS.find((p) =>
    p.keywords.some((k) => lower.includes(k))
  );
  let hash = 0;
  for (let i = 0; i < address.length; i++) {
    hash = (hash * 31 + address.charCodeAt(i)) | 0;
  }
  const jitterLat = ((hash & 0xff) / 255 - 0.5) * 0.016;
  const jitterLng = (((hash >> 8) & 0xff) / 255 - 0.5) * 0.016;
  const baseLat = match?.lat ?? 18.0179;
  const baseLng = match?.lng ?? -76.7885;
  return {
    lat: Number((baseLat + jitterLat).toFixed(6)),
    lng: Number((baseLng + jitterLng).toFixed(6)),
    formattedAddress: /jamaica/i.test(address) ? address : `${address}, Jamaica`,
    granularity: 'APPROXIMATE',
  };
}

async function clientNominatimGeocode(address: string): Promise<GeocodeResult | null> {
  try {
    const query = /jamaica/i.test(address) ? address : `${address}, Jamaica`;
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=jm&q=${encodeURIComponent(
      query
    )}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
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

export async function geocodePhysicalAddress(
  address: string,
  placesLib?: google.maps.PlacesLibrary | null
): Promise<GeocodeResult> {
  const trimmed = address.trim();
  if (!trimmed) {
    throw new Error('Address cannot be empty.');
  }

  // 1. Try local Express backend when running as a web server
  if (typeof window !== 'undefined' && window.location.protocol.startsWith('http')) {
    try {
      const res = await fetch('/api/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: trimmed }),
      });

      const payload = (await res.json().catch(() => ({}))) as {
        lat?: number;
        lng?: number;
        formattedAddress?: string;
        placeId?: string;
        granularity?: GeocodeGranularity;
      };

      if (res.ok && typeof payload.lat === 'number' && typeof payload.lng === 'number') {
        return {
          lat: payload.lat,
          lng: payload.lng,
          formattedAddress: payload.formattedAddress || trimmed,
          placeId: payload.placeId,
          granularity: payload.granularity || 'NOMINATIM',
        };
      }
    } catch {
      // Fall through to browser-direct Nominatim / Places SDK
    }
  }

  // 2. Try Google Places SDK if loaded
  if (placesLib) {
    try {
      const { places } = await placesLib.Place.searchByText({
        textQuery: /jamaica/i.test(trimmed) ? trimmed : `${trimmed}, Jamaica`,
        fields: ['id', 'displayName', 'formattedAddress', 'location'],
        maxResultCount: 1,
      });

      const match = places?.[0];
      if (match?.location) {
        return {
          lat: match.location.lat(),
          lng: match.location.lng(),
          formattedAddress: match.formattedAddress || trimmed,
          placeId: match.id,
          granularity: 'PLACES',
        };
      }
    } catch (sdkErr) {
      if (isQuotaErrorMessage(sdkErr)) {
        notifyQuotaExceeded();
      }
    }
  }

  // 3. Browser-direct OpenStreetMap Nominatim (works in standalone HTML preview)
  const nom = await clientNominatimGeocode(trimmed);
  if (nom) return nom;

  // 4. Deterministic Jamaica parish centroid fallback (always resolves)
  return clientParishFallback(trimmed);
}

export interface LookupAndBuildInput {
  query: string; // street address or listing URL
  valueUsd?: number;
  sqft?: number;
  lotSqft?: number;
  beds?: number;
  baths?: number;
  propertyType?: PropertyType;
  dealStatus?: DealStatus;
}

/**
 * Resolves a Jamaica address or listing URL via /api/lookup-listing (when hosted)
 * or directly in-browser via Nominatim + Jamaica parish fallback (when opened standalone),
 * returning a fully populated PropertyRecord ready for 5-stage vetting & heatmap plotting.
 */
export async function lookupAndCreateJamaicaProperty(
  input: LookupAndBuildInput
): Promise<PropertyRecord> {
  const isUrl = /^https?:\/\//i.test(input.query);
  let listingUrl: string | undefined = isUrl ? input.query : undefined;
  let title: string | undefined;
  let description: string | undefined;
  let extractedPriceUsd: number | undefined;
  let geo: GeocodeResult | undefined;

  if (typeof window !== 'undefined' && window.location.protocol.startsWith('http')) {
    try {
      const res = await fetch('/api/lookup-listing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: input.query }),
      });

      if (res.ok) {
        const data = (await res.json()) as {
          listingUrl?: string;
          title?: string;
          description?: string;
          extractedPriceUsd?: number;
          geocode?: GeocodeResult;
        };
        listingUrl = data.listingUrl ?? listingUrl;
        title = data.title;
        description = data.description;
        extractedPriceUsd = data.extractedPriceUsd;
        geo = data.geocode;
      }
    } catch {
      // Standalone mode fallback below
    }
  }

  if (!geo) {
    let addressToGeocode = input.query;
    if (isUrl) {
      try {
        const parsed = new URL(input.query);
        const slug = parsed.pathname
          .split('/')
          .filter(Boolean)
          .pop()
          ?.replace(/[-_]+/g, ' ')
          .trim();
        if (slug) addressToGeocode = slug;
      } catch {
        // Keep raw query
      }
    }
    geo = await geocodePhysicalAddress(addressToGeocode);
  }

  const formattedAddress = geo.formattedAddress || input.query;
  const parish = inferJamaicaParish(`${input.query} ${formattedAddress} ${title || ''}`);
  const parishPreset = PARISH_PRESETS.find((p) => p.parish === parish);

  const beds = input.beds ?? 2;
  const baths = input.baths ?? 2;
  const sqft = input.sqft && input.sqft > 0 ? input.sqft : beds * 620 + 200;
  const lotSqft = input.lotSqft && input.lotSqft > 0 ? input.lotSqft : 4500;
  const value =
    input.valueUsd && input.valueUsd > 0
      ? input.valueUsd
      : extractedPriceUsd && extractedPriceUsd > 0
        ? extractedPriceUsd
        : Math.round((sqft * 195) / 1000) * 1000;

  const propertyType: PropertyType = input.propertyType ?? 'Villa / Detached';
  const dealStatus: DealStatus =
    input.dealStatus ??
    (/nht|private[\s-]?treaty|foreclos/i.test(`${input.query} ${description || ''}`)
      ? 'NHT Private Treaty'
      : 'Value-Add');

  const baseRent1Bed = parishPreset?.avgRent1BedJmd ?? 85000;
  const estimatedLtrMonthlyJmd =
    propertyType === 'Raw Land'
      ? 0
      : Math.round((baseRent1Bed * (0.75 + beds * 0.45)) / 5000) * 5000;
  const estimatedStrNightlyUsd =
    propertyType === 'Raw Land'
      ? 0
      : Math.round(
          Math.max(
            75,
            beds * 68 +
              (parish === 'Westmoreland' || parish === 'St. Ann' || parish === 'St. James'
                ? 45
                : 10)
          )
        );

  const cleanName =
    title?.replace(/\s*[-|].*$/, '').trim() ||
    input.query
      .split(',')[0]
      .replace(/^https?:\/\/[^/]+\//i, '')
      .replace(/[-_]+/g, ' ')
      .trim() ||
    formattedAddress.split(',')[0];

  const signalFlags: PropertyRecord['signalFlags'] = [];
  if (dealStatus === 'NHT Private Treaty') {
    signalFlags.push({
      level: 'red',
      label: 'NHT Private Treaty / As-Is Sale',
      detail:
        'Confirm vacant possession, interior access, and whether NHT will entertain offers below valuation.',
    });
  }
  signalFlags.push({
    level: 'amber',
    label: 'Verify Exact GPS Pin & Registered Title',
    detail:
      'Address was resolved via live geocoding. Request the Volume/Folio Certificate of Title and Surveyor’s ID Report prior to deposit.',
  });

  return {
    id: `jm-search-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: cleanName,
    address: formattedAddress,
    parish,
    community: formattedAddress.split(',')[0].trim(),
    lat: geo.lat,
    lng: geo.lng,
    placeId: geo.placeId,
    granularity: geo.granularity,
    value,
    sqft,
    lotSqft,
    beds,
    baths,
    propertyType,
    dealStatus,
    tenure: propertyType === 'Condo / Apt' ? 'Strata Title' : 'Registered Freehold Title',
    construction: 'Concrete block-and-steel (verify roof & finishes on inspection)',
    utilities: ['NWC Piped Water (Verify)', 'JPS Electricity (Verify)'],
    broker: 'Unverified / Direct Search',
    agency: listingUrl ? new URL(listingUrl).hostname : 'Manual Address Lookup',
    listingUrl,
    listedDate: new Date().toISOString().slice(0, 10),
    daysOnMarket: 1,
    description:
      description ||
      `Property looked up via address entry in ${parish}, Jamaica. Edit valuation, living area, or CapEx assumptions below to refine the 5-stage vetting report.`,
    signalFlags,
    estimatedLtrMonthlyJmd,
    estimatedStrNightlyUsd,
    strOccupancyPct:
      parish === 'Westmoreland' || parish === 'St. Ann' || parish === 'St. James' ? 58 : 42,
    estimatedCapexUsd:
      dealStatus === 'NHT Private Treaty'
        ? Math.round(value * 0.2)
        : Math.round(value * 0.06),
    landValuePerSqftUsd: parishPreset?.avgLandPerSqftUsd ?? 14,
    source: isUrl ? 'url_import' : 'address_search',
    valuationNote: 'Live address lookup (editable)',
  };
}
