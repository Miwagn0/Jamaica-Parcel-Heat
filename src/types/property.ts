export type JamaicaParish =
  | 'Hanover'
  | 'Westmoreland'
  | 'St. James'
  | 'St. Ann'
  | 'Kingston & St. Andrew'
  | 'Portland'
  | 'Manchester'
  | 'St. Elizabeth'
  | 'St. Catherine'
  | 'Trelawny'
  | 'Clarendon'
  | 'St. Thomas'
  | 'St. Mary';

export type PropertyType =
  | 'Scheme House'
  | 'Villa / Detached'
  | 'Condo / Apt'
  | 'Beachfront / Resort'
  | 'Multi-Family'
  | 'Commercial'
  | 'Raw Land';

export type DealStatus =
  | 'Turnkey'
  | 'Value-Add'
  | 'NHT Private Treaty'
  | 'Distressed / Foreclosure';

export type TenureType =
  | 'Registered Freehold Title'
  | 'Strata Title'
  | 'Leasehold'
  | 'Unverified Title';

export type CurrencyCode = 'USD' | 'JMD';

export type InvestmentStrategy = 'LTR' | 'STR' | 'Value-Add' | 'Land Bank';

export type BuyerProfile =
  | 'Non-Resident / Foreign Investor'
  | 'Local Citizen / Returning Resident'
  | 'Jamaican LLC / Holding Co';

export type DealVerdict = 'Pursue' | 'Negotiate' | 'Pass';

export type GeocodeGranularity =
  | 'ROOFTOP'
  | 'RANGE_INTERPOLATED'
  | 'GEOMETRIC_CENTER'
  | 'APPROXIMATE'
  | 'PLACES'
  | 'NOMINATIM';

export type PropertySource =
  | 'catalog'
  | 'address_search'
  | 'url_import'
  | 'batch'
  | 'market_discovery';

export interface SignalFlag {
  level: 'red' | 'amber' | 'green';
  label: string;
  detail: string;
}

export interface CompRecord {
  id: string;
  name: string;
  address: string;
  parish: JamaicaParish;
  community: string;
  beds: number;
  baths: number;
  sqft: number;
  lotSqft: number;
  priceUsd: number;
  status: 'Active' | 'Sold' | 'NHT Schedule' | 'Expanded Comp';
  daysOnMarket?: number;
  implication: string;
}

export interface PropertyRecord {
  id: string;
  mlsNumber?: string;
  name: string;
  address: string;
  parish: JamaicaParish;
  community: string;
  lat: number;
  lng: number;
  placeId?: string;
  granularity: GeocodeGranularity;
  value: number; // Asking price in USD
  sqft: number; // Interior building sq ft
  lotSqft: number; // Lot size in sq ft
  beds: number;
  baths: number;
  propertyType: PropertyType;
  dealStatus: DealStatus;
  tenure: TenureType;
  construction: string;
  utilities: string[];
  broker: string;
  agency: string;
  agentPhone?: string;
  listingUrl?: string;
  listedDate: string;
  daysOnMarket: number;
  description: string;
  signalFlags: SignalFlag[];
  estimatedLtrMonthlyJmd: number;
  estimatedStrNightlyUsd: number;
  strOccupancyPct: number; // 0..100
  estimatedCapexUsd: number;
  landValuePerSqftUsd: number;
  comps?: CompRecord[];
  source: PropertySource;
  valuationNote?: string;
}

export type WeightMode = 'value' | 'price_per_sqft' | 'cap_rate' | 'density';

export type HeatmapPaletteId = 'infrared' | 'magma' | 'emerald';

export type HeatmapAggregation = 'SUM' | 'MEAN';

export type MapTypeOption = 'roadmap' | 'satellite' | 'hybrid';

export type WorkspaceTab = 'studio' | 'ledger' | 'batch' | 'framework';

export interface HeatmapSettings {
  visible: boolean;
  showMarkers: boolean;
  weightMode: WeightMode;
  palette: HeatmapPaletteId;
  aggregation: HeatmapAggregation;
  radiusPixels: number;
  intensity: number;
  opacity: number;
}

export interface PropertyFilters {
  searchQuery: string;
  parishes: JamaicaParish[];
  propertyTypes: PropertyType[];
  dealStatuses: DealStatus[];
  minPriceUsd: number | null;
  maxPriceUsd: number | null;
  minBeds: number | null;
  verdictFilter: 'All' | DealVerdict;
}

export interface UnderwritingParams {
  fxRate: number; // JMD per 1 USD
  strategy: InvestmentStrategy;
  targetHurdleCapRate: number; // %
  buyerProfile: BuyerProfile;
  ltrOperatingDragPct: number; // %
  strOperatingDragPct: number; // %
  closingCostPct: number; // %
}

export interface VettingAnalysis {
  property: PropertyRecord;
  params: UnderwritingParams;
  // Stage 2: Land vs Structure & Comps
  estimatedLandValueUsd: number;
  impliedStructureValueUsd: number;
  impliedStructurePerSqftUsd: number;
  pricePerSqftUsd: number;
  compMedianPriceUsd: number;
  compMedianPsfUsd: number;
  askVsCompPct: number; // positive = above comp median
  comps: CompRecord[];
  // Stage 3: All-In Basis & Yield
  closingCostsUsd: number;
  closingBreakdown: {
    stampDutyHalfUsd: number;
    nlaRegistrationUsd: number;
    attorneyAndGctUsd: number;
    surveyAndValuationUsd: number;
  };
  capexUsd: number;
  allInBasisUsd: number;
  ltrGrossAnnualUsd: number;
  ltrNoiUsd: number;
  ltrCapRatePct: number;
  strGrossAnnualUsd: number;
  strNoiUsd: number;
  strCapRatePct: number;
  activeStrategyGrossUsd: number;
  activeStrategyNoiUsd: number;
  activeStrategyCapRatePct: number;
  hurdleGapPct: number; // activeStrategyCapRatePct - targetHurdleCapRate
  // Stage 4: Legal & Site checks
  legalChecks: Array<{
    title: string;
    severity: 'critical' | 'caution' | 'clear';
    detail: string;
  }>;
  // Stage 5: Verdict & Action Plan
  verdict: DealVerdict;
  verdictHeadline: string;
  verdictRationale: string;
  targetOfferLowUsd: number;
  targetOfferHighUsd: number;
  qualificationQuestions: string[];
}

export interface ParishPreset {
  id: string;
  parish: JamaicaParish;
  label: string;
  center: { lat: number; lng: number };
  zoom: number;
  avgLandPerSqftUsd: number;
  avgRent1BedJmd: number;
}

export interface ParsedBatchRow {
  rowNumber: number;
  address: string;
  value: number;
  sqft: number;
  propertyType: PropertyType;
  parish?: JamaicaParish;
  status: 'pending' | 'geocoding' | 'success' | 'error';
  errorMessage?: string;
  resolvedAddress?: string;
  lat?: number;
  lng?: number;
  granularity?: GeocodeGranularity;
}
