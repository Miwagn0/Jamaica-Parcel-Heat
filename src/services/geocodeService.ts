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

export async function geocodePhysicalAddress(
  address: string,
  placesLib?: google.maps.PlacesLibrary | null
): Promise<GeocodeResult> {
  const trimmed = address.trim();
  if (!trimmed) {
    throw new Error('Address cannot be empty.');
  }

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
      error?: string;
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
    // Fall through to Places SDK if available
  }

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

  throw new Error('Could not resolve coordinates for this Jamaica address.');
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
 * Resolves a Jamaica address or listing URL via /api/lookup-listing and builds a
 * fully populated PropertyRecord ready for 5-stage vetting & heatmap plotting.
 */
export async function lookupAndCreateJamaicaProperty(
  input: LookupAndBuildInput
): Promise<PropertyRecord> {
  const res = await fetch('/api/lookup-listing', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: input.query }),
  });

  if (!res.ok) {
    const errPayload = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(errPayload.error || 'Unable to look up Jamaica listing.');
  }

  const data = (await res.json()) as {
    isUrl: boolean;
    listingUrl?: string;
    title?: string;
    description?: string;
    extractedPriceUsd?: number;
    geocode?: GeocodeResult;
  };

  const geo = data.geocode ?? {
    lat: 18.0179,
    lng: -76.7885,
    formattedAddress: input.query,
    granularity: 'APPROXIMATE' as GeocodeGranularity,
  };

  const formattedAddress = geo.formattedAddress || input.query;
  const parish = inferJamaicaParish(`${input.query} ${formattedAddress} ${data.title || ''}`);
  const parishPreset = PARISH_PRESETS.find((p) => p.parish === parish);

  const beds = input.beds ?? 2;
  const baths = input.baths ?? 2;
  const sqft = input.sqft && input.sqft > 0 ? input.sqft : beds * 620 + 200;
  const lotSqft = input.lotSqft && input.lotSqft > 0 ? input.lotSqft : 4500;
  const value =
    input.valueUsd && input.valueUsd > 0
      ? input.valueUsd
      : data.extractedPriceUsd && data.extractedPriceUsd > 0
        ? data.extractedPriceUsd
        : Math.round((sqft * 195) / 1000) * 1000;

  const propertyType: PropertyType = input.propertyType ?? 'Villa / Detached';
  const dealStatus: DealStatus =
    input.dealStatus ??
    (/nht|private[\s-]?treaty|foreclos/i.test(`${input.query} ${data.description || ''}`)
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
      : Math.round(Math.max(75, beds * 68 + (parish === 'Westmoreland' || parish === 'St. Ann' || parish === 'St. James' ? 45 : 10)));

  const cleanName =
    data.title?.replace(/\s*[-|].*$/, '').trim() ||
    input.query.split(',')[0].replace(/^https?:\/\/[^/]+\//i, '').trim() ||
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
    agency: data.isUrl ? new URL(data.listingUrl!).hostname : 'Manual Address Lookup',
    listingUrl: data.listingUrl,
    listedDate: new Date().toISOString().slice(0, 10),
    daysOnMarket: 1,
    description:
      data.description ||
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
    source: data.isUrl ? 'url_import' : 'address_search',
    valuationNote: 'Live address lookup (editable)',
  };
}
