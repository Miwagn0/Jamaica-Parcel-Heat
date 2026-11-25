import type {
  CompRecord,
  CurrencyCode,
  DealVerdict,
  HeatmapPaletteId,
  JamaicaParish,
  ParsedBatchRow,
  PropertyRecord,
  PropertyType,
  UnderwritingParams,
  VettingAnalysis,
  WeightMode,
} from '../types/property';
import { DEFAULT_FX_RATE_JMD, PARISH_PRESETS } from '../data/jamaicaListings';

export type RgbaColor = [number, number, number, number];

export interface HeatmapPalette {
  id: HeatmapPaletteId;
  label: string;
  cssGradient: string;
  colorRange: RgbaColor[];
}

export const HEATMAP_PALETTES: Record<HeatmapPaletteId, HeatmapPalette> = {
  infrared: {
    id: 'infrared',
    label: 'Thermal Infrared',
    cssGradient:
      'linear-gradient(90deg, #0e7490 0%, #06b6d4 22%, #facc15 50%, #f97316 74%, #dc2626 90%, #991b1b 100%)',
    colorRange: [
      [14, 116, 144, 170],
      [6, 182, 212, 195],
      [250, 204, 21, 220],
      [249, 115, 22, 238],
      [220, 38, 38, 250],
      [153, 27, 27, 255],
    ],
  },
  emerald: {
    id: 'emerald',
    label: 'Emerald Yield',
    cssGradient:
      'linear-gradient(90deg, #0f766e 0%, #14b8a6 24%, #10b981 48%, #84cc16 72%, #eab308 88%, #d97706 100%)',
    colorRange: [
      [15, 118, 110, 170],
      [20, 184, 166, 195],
      [16, 185, 129, 220],
      [132, 204, 22, 236],
      [234, 179, 8, 248],
      [217, 119, 6, 255],
    ],
  },
  magma: {
    id: 'magma',
    label: 'Magma Equity',
    cssGradient:
      'linear-gradient(90deg, #312e81 0%, #6d28d9 24%, #c026d3 48%, #f43f5e 72%, #fb923c 88%, #fde047 100%)',
    colorRange: [
      [49, 46, 129, 175],
      [109, 40, 217, 200],
      [192, 38, 211, 220],
      [244, 63, 94, 238],
      [251, 146, 60, 250],
      [253, 224, 71, 255],
    ],
  },
};

export const DEFAULT_UNDERWRITING_PARAMS: UnderwritingParams = {
  fxRate: DEFAULT_FX_RATE_JMD,
  strategy: 'LTR',
  targetHurdleCapRate: 10,
  buyerProfile: 'Non-Resident / Foreign Investor',
  ltrOperatingDragPct: 30,
  strOperatingDragPct: 48,
  closingCostPct: 4.5,
};

export function formatMoney(
  usdValue: number,
  currency: CurrencyCode = 'USD',
  fxRate = DEFAULT_FX_RATE_JMD,
  compact = false
): string {
  const val = currency === 'JMD' ? usdValue * fxRate : usdValue;
  const prefix = currency === 'JMD' ? 'J$' : '$';

  if (compact) {
    if (Math.abs(val) >= 1_000_000) {
      const m = val / 1_000_000;
      return `${prefix}${m >= 100 ? m.toFixed(0) : m >= 10 ? m.toFixed(1) : m.toFixed(2)}M`;
    }
    if (Math.abs(val) >= 1_000) {
      return `${prefix}${Math.round(val / 1_000)}k`;
    }
    return `${prefix}${Math.round(val)}`;
  }

  return `${prefix}${Math.round(val).toLocaleString('en-US')}`;
}

export function formatCurrencyFull(value: number): string {
  return formatMoney(value, 'USD', DEFAULT_FX_RATE_JMD, false);
}

export function formatCurrencyCompact(value: number): string {
  return formatMoney(value, 'USD', DEFAULT_FX_RATE_JMD, true);
}

export function getPricePerSqft(
  property: Pick<PropertyRecord, 'value' | 'sqft' | 'lotSqft'>
): number {
  if (property.sqft && property.sqft > 0) {
    return Math.round(property.value / property.sqft);
  }
  if (property.lotSqft && property.lotSqft > 0) {
    return Math.round(property.value / property.lotSqft);
  }
  return 0;
}

export function inferJamaicaParish(text: string): JamaicaParish {
  const lower = text.toLowerCase();
  if (lower.includes('hanover') || lower.includes('green island') || lower.includes('lucea') || lower.includes('hopewell') || lower.includes('orange bay')) return 'Hanover';
  if (lower.includes('westmoreland') || lower.includes('negril') || lower.includes('savanna-la-mar')) return 'Westmoreland';
  if (lower.includes('st. james') || lower.includes('st james') || lower.includes('montego bay') || lower.includes('ironshore') || lower.includes('bogue') || lower.includes('freeport') || lower.includes('rose hall')) return 'St. James';
  if (lower.includes('st. ann') || lower.includes('st ann') || lower.includes('ocho rios') || lower.includes('drax hall') || lower.includes('runaway bay') || lower.includes('mammee bay') || lower.includes('discovery bay')) return 'St. Ann';
  if (lower.includes('kingston') || lower.includes('st. andrew') || lower.includes('st andrew') || lower.includes('norbrook') || lower.includes('mona') || lower.includes('cherry gardens') || lower.includes('liguanea')) return 'Kingston & St. Andrew';
  if (lower.includes('portland') || lower.includes('port antonio') || lower.includes('san san') || lower.includes('boston bay')) return 'Portland';
  if (lower.includes('st. elizabeth') || lower.includes('st elizabeth') || lower.includes('treasure beach') || lower.includes('black river')) return 'St. Elizabeth';
  if (lower.includes('manchester') || lower.includes('mandeville')) return 'Manchester';
  if (lower.includes('st. catherine') || lower.includes('st catherine') || lower.includes('portmore') || lower.includes('spanish town')) return 'St. Catherine';
  if (lower.includes('trelawny') || lower.includes('falmouth') || lower.includes('duncans')) return 'Trelawny';
  if (lower.includes('clarendon') || lower.includes('may pen')) return 'Clarendon';
  if (lower.includes('st. thomas') || lower.includes('st thomas') || lower.includes('morant bay')) return 'St. Thomas';
  if (lower.includes('st. mary') || lower.includes('st mary') || lower.includes('oracabessa') || lower.includes('port maria')) return 'St. Mary';
  return 'Kingston & St. Andrew';
}

/**
 * Finds or synthesizes comparable properties for a subject listing.
 */
export function buildCompsForProperty(
  subject: PropertyRecord,
  allProperties: PropertyRecord[]
): CompRecord[] {
  if (subject.comps && subject.comps.length > 0) {
    return subject.comps;
  }

  // Pull up to 3 closest comps from the live catalog in same parish or same property type
  const candidates = allProperties
    .filter((p) => p.id !== subject.id)
    .map((p) => {
      const sameParish = p.parish === subject.parish ? 0 : 1;
      const sameType = p.propertyType === subject.propertyType ? 0 : 1;
      const priceDiff = Math.abs(p.value - subject.value) / Math.max(subject.value, 1);
      return { prop: p, score: sameParish * 2 + sameType + priceDiff };
    })
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);

  const catalogComps: CompRecord[] = candidates.map(({ prop }) => {
    const pctDiff = Math.round(((subject.value - prop.value) / Math.max(prop.value, 1)) * 100);
    const relation =
      pctDiff > 8
        ? `Subject asks ${pctDiff}% above this ${prop.parish} comp.`
        : pctDiff < -8
          ? `Subject is priced ${Math.abs(pctDiff)}% below this ${prop.parish} comp.`
          : `Subject is priced closely in line with this ${prop.parish} benchmark.`;
    return {
      id: `comp-${prop.id}`,
      name: prop.name,
      address: prop.address,
      parish: prop.parish,
      community: prop.community,
      beds: prop.beds,
      baths: prop.baths,
      sqft: prop.sqft,
      lotSqft: prop.lotSqft,
      priceUsd: prop.value,
      status: prop.dealStatus === 'NHT Private Treaty' ? 'NHT Schedule' : 'Active',
      daysOnMarket: prop.daysOnMarket,
      implication: relation,
    };
  });

  if (catalogComps.length >= 2) {
    return catalogComps;
  }

  // Fallback synthetic parish benchmarks if dataset is tiny
  const preset = PARISH_PRESETS.find((p) => p.parish === subject.parish);
  const landRate = preset?.avgLandPerSqftUsd ?? 14;
  return [
    {
      id: `bench-low-${subject.id}`,
      name: `${subject.parish} Entry Benchmark`,
      address: `${subject.community}, ${subject.parish}, Jamaica`,
      parish: subject.parish,
      community: subject.community,
      beds: Math.max(1, subject.beds),
      baths: Math.max(1, subject.baths),
      sqft: Math.round(subject.sqft * 0.92),
      lotSqft: Math.round(subject.lotSqft * 0.95),
      priceUsd: Math.round((subject.value * 0.88) / 1000) * 1000,
      status: 'Sold',
      daysOnMarket: 62,
      implication: `Recent ${subject.parish} baseline (~$${landRate}/sf land basis).`,
    },
    {
      id: `bench-high-${subject.id}`,
      name: `${subject.parish} Renovated Comp`,
      address: `${subject.community}, ${subject.parish}, Jamaica`,
      parish: subject.parish,
      community: subject.community,
      beds: Math.max(1, subject.beds + 1),
      baths: Math.max(1, subject.baths),
      sqft: Math.round(subject.sqft * 1.18),
      lotSqft: Math.round(subject.lotSqft * 1.1),
      priceUsd: Math.round((subject.value * 1.22) / 1000) * 1000,
      status: 'Active',
      daysOnMarket: 49,
      implication: `Sets upper ceiling for upgraded turnkey units in ${subject.parish}.`,
    },
  ];
}

/**
 * Full 5-Stage Jamaica Property Vetting Analysis Engine
 * Derived directly from the user's Property Vetting Framework & 97 Winchester Estates methodology.
 */
export function runVettingAnalysis(
  property: PropertyRecord,
  allProperties: PropertyRecord[],
  params: UnderwritingParams = DEFAULT_UNDERWRITING_PARAMS,
  capexOverrideUsd?: number
): VettingAnalysis {
  const fx = params.fxRate || DEFAULT_FX_RATE_JMD;
  const comps = buildCompsForProperty(property, allProperties);

  // Stage 2: Land vs. Structure & Comp Benchmarking
  const estimatedLandValueUsd = Math.round(
    Math.min(property.value * 0.92, property.lotSqft * property.landValuePerSqftUsd)
  );
  const impliedStructureValueUsd = Math.max(0, property.value - estimatedLandValueUsd);
  const impliedStructurePerSqftUsd =
    property.sqft > 0 ? Math.round(impliedStructureValueUsd / property.sqft) : 0;
  const pricePerSqftUsd = getPricePerSqft(property);

  const compPrices = comps.map((c) => c.priceUsd).sort((a, b) => a - b);
  const midIdx = Math.floor(compPrices.length / 2);
  const compMedianPriceUsd =
    compPrices.length === 0
      ? property.value
      : compPrices.length % 2 === 0
        ? Math.round((compPrices[midIdx - 1] + compPrices[midIdx]) / 2)
        : compPrices[midIdx];

  const compPsfList = comps
    .map((c) => (c.sqft > 0 ? c.priceUsd / c.sqft : c.lotSqft > 0 ? c.priceUsd / c.lotSqft : 0))
    .filter((v) => v > 0)
    .sort((a, b) => a - b);
  const compMedianPsfUsd =
    compPsfList.length > 0
      ? Math.round(compPsfList[Math.floor(compPsfList.length / 2)])
      : pricePerSqftUsd;

  const askVsCompPct =
    compMedianPriceUsd > 0
      ? Math.round(((property.value - compMedianPriceUsd) / compMedianPriceUsd) * 100)
      : 0;

  // Stage 3: Jamaica All-In Acquisition Basis & Yield Underwriting
  // Jamaica closing costs: 0% foreign surcharge, Seller pays 2% Transfer Tax;
  // Buyer pays 50% of flat J$5,000 Stamp Duty (J$2,500), 0.25% NLA registration,
  // ~2.5% attorney + 16.5% GCT (~2.91%), plus Surveyor ID Report + Valuation (~0.75%-1.25%).
  const stampDutyHalfUsd = Math.round(2500 / fx);
  const nlaRegistrationUsd = Math.round(property.value * 0.0025);
  const attorneyAndGctUsd = Math.round(property.value * 0.025 * 1.165);
  const surveyAndValuationUsd = Math.max(
    650,
    Math.round(property.value * 0.006 + 380)
  );
  const closingCostsUsd =
    stampDutyHalfUsd + nlaRegistrationUsd + attorneyAndGctUsd + surveyAndValuationUsd;

  const capexUsd =
    capexOverrideUsd !== undefined ? capexOverrideUsd : property.estimatedCapexUsd;
  const allInBasisUsd = property.value + closingCostsUsd + capexUsd;

  // LTR Model
  const ltrGrossAnnualUsd = Math.round((property.estimatedLtrMonthlyJmd * 12) / fx);
  const ltrNoiUsd = Math.round(
    ltrGrossAnnualUsd * (1 - params.ltrOperatingDragPct / 100)
  );
  const ltrCapRatePct =
    allInBasisUsd > 0 ? Number(((ltrNoiUsd / allInBasisUsd) * 100).toFixed(2)) : 0;

  // STR Model
  const strGrossAnnualUsd = Math.round(
    property.estimatedStrNightlyUsd * 365 * (property.strOccupancyPct / 100)
  );
  const strNoiUsd = Math.round(
    strGrossAnnualUsd * (1 - params.strOperatingDragPct / 100)
  );
  const strCapRatePct =
    allInBasisUsd > 0 ? Number(((strNoiUsd / allInBasisUsd) * 100).toFixed(2)) : 0;

  // Active strategy selection
  let activeStrategyGrossUsd = ltrGrossAnnualUsd;
  let activeStrategyNoiUsd = ltrNoiUsd;
  let activeStrategyCapRatePct = ltrCapRatePct;

  if (params.strategy === 'STR') {
    activeStrategyGrossUsd = strGrossAnnualUsd;
    activeStrategyNoiUsd = strNoiUsd;
    activeStrategyCapRatePct = strCapRatePct;
  } else if (params.strategy === 'Value-Add') {
    // Model 22% post-rehab NOI uplift on best of LTR/STR
    const baseBestGross = Math.max(ltrGrossAnnualUsd, strGrossAnnualUsd);
    const baseBestNoi = Math.max(ltrNoiUsd, strNoiUsd);
    activeStrategyGrossUsd = Math.round(baseBestGross * 1.22);
    activeStrategyNoiUsd = Math.round(baseBestNoi * 1.22);
    activeStrategyCapRatePct =
      allInBasisUsd > 0
        ? Number(((activeStrategyNoiUsd / allInBasisUsd) * 100).toFixed(2))
        : 0;
  }

  const hurdleGapPct = Number(
    (activeStrategyCapRatePct - params.targetHurdleCapRate).toFixed(2)
  );

  // Stage 4: Legal, Title & Site Make-or-Breaks (Jamaica-specific)
  const legalChecks: VettingAnalysis['legalChecks'] = [
    {
      title: 'Foreign Freehold Ownership Eligibility',
      severity: 'clear',
      detail:
        'Jamaica places no statutory restrictions or foreign-buyer surcharges on non-citizens purchasing registered freehold land. Closing taxes are identical to local citizens.',
    },
  ];

  if (
    property.dealStatus === 'NHT Private Treaty' ||
    property.dealStatus === 'Distressed / Foreclosure'
  ) {
    legalChecks.push({
      title: 'NHT Private-Treaty / Mortgagee Powers-of-Sale Risk',
      severity: 'critical',
      detail:
        'Sold strictly "as-is, where-is" without warranties. Confirm vacant possession in the Agreement for Sale, verify whether interior inspection is permitted, and check for any defaulting-mortgagor court injunctions.',
    });
  }

  if (property.tenure === 'Strata Title') {
    legalChecks.push({
      title: 'Strata Corporation Standing & STR Rules',
      severity: 'caution',
      detail:
        'Obtain a Strata Certificate of Payment, 24-month financial statements, insurance schedule, and written confirmation that short-term rentals (Airbnb) are permitted under Strata by-laws.',
    });
  } else {
    legalChecks.push({
      title: 'Surveyor’s ID Report & Restrictive Covenants',
      severity: 'caution',
      detail:
        'Commission a licensed Commissioned Land Surveyor’s Identification Report to verify boundary pegs, setback compliance, and Certificate of Title restrictive covenants (especially before planning a 2nd storey or duplex).',
    });
  }

  if (
    property.propertyType === 'Beachfront / Resort' ||
    property.parish === 'Hanover' ||
    property.parish === 'Westmoreland' ||
    property.parish === 'Portland' ||
    property.parish === 'St. Elizabeth'
  ) {
    legalChecks.push({
      title: 'Coastal Setback, Water Redundancy & Power Backup',
      severity: 'caution',
      detail:
        'Confirm exact GPS pin relative to the shoreline/main road, NEPA coastal setback compliance, reserve water tank/cistern capacity, and whether backup solar/generator hardware actually conveys with the sale.',
    });
  }

  // Stage 5: Verdict & Target Offer Band
  const hasCriticalRedFlag = property.signalFlags.some((f) => f.level === 'red');
  let verdict: DealVerdict = 'Negotiate';
  let verdictHeadline = 'Negotiate Only — Priced Above Target Yield Hurdle';
  let verdictRationale = '';

  if (property.propertyType === 'Raw Land') {
    verdict = askVsCompPct <= 5 ? 'Negotiate' : 'Pass';
    verdictHeadline =
      verdict === 'Negotiate'
        ? 'Negotiate — Viable Land Bank / Build-to-Suit Basis'
        : 'Pass at Full Ask — Land Basis Above Submarket Comps';
    verdictRationale = `Raw land generates zero immediate cash flow. At $${(
      property.value / Math.max(property.lotSqft, 1)
    ).toFixed(2)}/sq ft in ${property.parish}, validate NEPA/Parish building approvals and target a discount for holding & infrastructure costs.`;
  } else if (
    activeStrategyCapRatePct >= params.targetHurdleCapRate &&
    !hasCriticalRedFlag
  ) {
    verdict = 'Pursue';
    verdictHeadline = `Pursue — Clears ${params.targetHurdleCapRate}% Net Cap Rate Hurdle`;
    verdictRationale = `Projected ${params.strategy} net yield of ${activeStrategyCapRatePct.toFixed(
      1
    )}% exceeds your ${params.targetHurdleCapRate}% hurdle rate on an all-in basis of ${formatMoney(
      allInBasisUsd,
      'USD',
      fx
    )}. Proceed to physical inspection and title/survey verification.`;
  } else if (
    activeStrategyCapRatePct >= params.targetHurdleCapRate * 0.65 ||
    params.strategy === 'Value-Add' ||
    hasCriticalRedFlag
  ) {
    verdict = 'Negotiate';
    verdictHeadline = hasCriticalRedFlag
      ? 'Negotiate Discount — Price In Undisclosed / Distressed Risk'
      : `Negotiate — ${activeStrategyCapRatePct.toFixed(1)}% Yield Below ${params.targetHurdleCapRate}% Hurdle`;
    verdictRationale = `At full ask (${formatMoney(
      property.value,
      'USD',
      fx
    )} / ${formatMoney(property.value, 'JMD', fx)}), net yield under ${
      params.strategy
    } is ${activeStrategyCapRatePct.toFixed(1)}% (${hurdleGapPct > 0 ? '+' : ''}${hurdleGapPct.toFixed(
      1
    )}% vs. hurdle). Offer below ask to price in ${
      hasCriticalRedFlag ? 'private-treaty / uninspected condition risk and ' : ''
    }immediate CapEx of ${formatMoney(capexUsd, 'USD', fx)}.`;
  } else {
    verdict = 'Pass';
    verdictHeadline = `Pass at Full Ask — ${activeStrategyCapRatePct.toFixed(1)}% Yield Too Thin`;
    verdictRationale = `All-in basis of ${formatMoney(
      allInBasisUsd,
      'USD',
      fx
    )} produces only ${activeStrategyCapRatePct.toFixed(1)}% net yield under ${
      params.strategy
    }. Only revisit if seller accepts a steep price reduction or if purchasing primarily for personal/appreciation use.`;
  }

  // Compute defensible Target Offer Band
  const yieldTargetAllIn =
    activeStrategyNoiUsd > 0
      ? activeStrategyNoiUsd / (params.targetHurdleCapRate / 100)
      : property.value * 0.82;
  const yieldAnchoredOffer = Math.max(
    property.value * 0.68,
    Math.min(
      property.value * 0.97,
      yieldTargetAllIn - closingCostsUsd - capexUsd
    )
  );
  const compAnchoredOffer = Math.min(property.value * 0.95, compMedianPriceUsd * 0.94);
  const blendedTarget =
    property.propertyType === 'Raw Land'
      ? property.value * 0.84
      : yieldAnchoredOffer * 0.65 + compAnchoredOffer * 0.35;

  const targetOfferLowUsd =
    Math.round(Math.min(property.value * 0.92, blendedTarget * 0.93) / 500) * 500;
  const targetOfferHighUsd =
    Math.round(Math.min(property.value * 0.98, blendedTarget * 1.03) / 500) * 500;

  // Stage 5: Agent Qualification Script (tailored to property)
  const qualificationQuestions: string[] = [];
  if (property.dealStatus === 'NHT Private Treaty') {
    qualificationQuestions.push(
      `I see ${property.name} is on the NHT Private-Treaty schedule—is this a mortgagee sale under powers of sale, and is NHT accepting offers below the ${formatMoney(property.value, 'JMD', fx)} valuation?`
    );
    qualificationQuestions.push(
      `Is the property confirmed vacant right now, and will vacant possession be guaranteed in the Agreement for Sale?`
    );
    qualificationQuestions.push(
      `Is interior access available for a physical inspection and structural check, or is this strictly a drive-by / sight-unseen sale?`
    );
  } else {
    qualificationQuestions.push(
      `Are you the direct mandate holder for ${property.name}, and is the Registered Certificate of Title currently free of encumbrances or caveats?`
    );
    qualificationQuestions.push(
      `Can you share the exact GPS pin and confirm whether all stated appliances, solar/water tank hardware, and furnishings convey in the asking price?`
    );
  }

  if (property.tenure === 'Strata Title') {
    qualificationQuestions.push(
      `What are the exact monthly Strata maintenance dues, reserve fund balance, and are short-term rentals (Airbnb/VRBO) expressly permitted by the Strata by-laws?`
    );
  } else {
    qualificationQuestions.push(
      `Are there any outstanding NWC water arrears, property taxes, or restrictive covenants on the Certificate of Title that limit expansion or multi-unit rental use?`
    );
  }

  qualificationQuestions.push(
    `How motivated is the vendor on a cash closing within 45–60 days, and have there been any recent valuation or Surveyor’s ID reports completed?`
  );

  return {
    property,
    params,
    estimatedLandValueUsd,
    impliedStructureValueUsd,
    impliedStructurePerSqftUsd,
    pricePerSqftUsd,
    compMedianPriceUsd,
    compMedianPsfUsd,
    askVsCompPct,
    comps,
    closingCostsUsd,
    closingBreakdown: {
      stampDutyHalfUsd,
      nlaRegistrationUsd,
      attorneyAndGctUsd,
      surveyAndValuationUsd,
    },
    capexUsd,
    allInBasisUsd,
    ltrGrossAnnualUsd,
    ltrNoiUsd,
    ltrCapRatePct,
    strGrossAnnualUsd,
    strNoiUsd,
    strCapRatePct,
    activeStrategyGrossUsd,
    activeStrategyNoiUsd,
    activeStrategyCapRatePct,
    hurdleGapPct,
    legalChecks,
    verdict,
    verdictHeadline,
    verdictRationale,
    targetOfferLowUsd,
    targetOfferHighUsd,
    qualificationQuestions,
  };
}

export function getMetricValue(
  property: PropertyRecord,
  weightMode: WeightMode,
  allProperties: PropertyRecord[] = [],
  params: UnderwritingParams = DEFAULT_UNDERWRITING_PARAMS
): number {
  if (weightMode === 'price_per_sqft') {
    return getPricePerSqft(property);
  }
  if (weightMode === 'cap_rate') {
    const analysis = runVettingAnalysis(property, allProperties, params);
    return analysis.activeStrategyCapRatePct;
  }
  if (weightMode === 'density') {
    return 1;
  }
  return property.value;
}

export function formatMetricValue(
  val: number,
  weightMode: WeightMode,
  currency: CurrencyCode = 'USD',
  fxRate = DEFAULT_FX_RATE_JMD
): string {
  if (weightMode === 'price_per_sqft') {
    const scaled = currency === 'JMD' ? Math.round(val * fxRate) : Math.round(val);
    const prefix = currency === 'JMD' ? 'J$' : '$';
    return `${prefix}${scaled.toLocaleString()}/sf`;
  }
  if (weightMode === 'cap_rate') {
    return `${val.toFixed(1)}% cap`;
  }
  if (weightMode === 'density') {
    return `${val.toFixed(0)} parcel`;
  }
  return formatMoney(val, currency, fxRate, true);
}

export interface PortfolioStats {
  count: number;
  totalValue: number;
  medianValue: number;
  avgValue: number;
  avgPricePerSqft: number;
  avgCapRate: number;
  minMetric: number;
  medianMetric: number;
  maxMetric: number;
}

export function computePortfolioStats(
  properties: PropertyRecord[],
  weightMode: WeightMode,
  params: UnderwritingParams = DEFAULT_UNDERWRITING_PARAMS
): PortfolioStats {
  if (properties.length === 0) {
    return {
      count: 0,
      totalValue: 0,
      medianValue: 0,
      avgValue: 0,
      avgPricePerSqft: 0,
      avgCapRate: 0,
      minMetric: 0,
      medianMetric: 0,
      maxMetric: 0,
    };
  }

  const values = properties.map((p) => p.value).sort((a, b) => a - b);
  const totalValue = values.reduce((acc, v) => acc + v, 0);
  const mid = Math.floor(values.length / 2);
  const medianValue =
    values.length % 2 === 0
      ? Math.round((values[mid - 1] + values[mid]) / 2)
      : values[mid];

  const validPsf = properties.map((p) => getPricePerSqft(p)).filter((v) => v > 0);
  const avgPricePerSqft =
    validPsf.length > 0
      ? Math.round(validPsf.reduce((a, b) => a + b, 0) / validPsf.length)
      : 0;

  const capRates = properties
    .filter((p) => p.propertyType !== 'Raw Land')
    .map((p) => runVettingAnalysis(p, properties, params).activeStrategyCapRatePct);
  const avgCapRate =
    capRates.length > 0
      ? Number((capRates.reduce((a, b) => a + b, 0) / capRates.length).toFixed(1))
      : 0;

  const metrics = properties
    .map((p) => getMetricValue(p, weightMode, properties, params))
    .sort((a, b) => a - b);
  const mMid = Math.floor(metrics.length / 2);
  const medianMetric =
    metrics.length % 2 === 0
      ? (metrics[mMid - 1] + metrics[mMid]) / 2
      : metrics[mMid];

  return {
    count: properties.length,
    totalValue,
    medianValue,
    avgValue: Math.round(totalValue / properties.length),
    avgPricePerSqft,
    avgCapRate,
    minMetric: metrics[0],
    medianMetric,
    maxMetric: metrics[metrics.length - 1],
  };
}

export function getNormalizedHeatScore(
  property: PropertyRecord,
  stats: PortfolioStats,
  weightMode: WeightMode,
  allProperties: PropertyRecord[] = [],
  params: UnderwritingParams = DEFAULT_UNDERWRITING_PARAMS
): number {
  if (weightMode === 'density') return 0.55;
  const metric = getMetricValue(property, weightMode, allProperties, params);
  const span = stats.maxMetric - stats.minMetric;
  if (span <= 0) return 0.65;
  return Math.max(0, Math.min(1, (metric - stats.minMetric) / span));
}

export function getTierColorHex(score: number, paletteId: HeatmapPaletteId): string {
  const palette = HEATMAP_PALETTES[paletteId];
  const idx = Math.min(
    palette.colorRange.length - 1,
    Math.max(0, Math.floor(score * palette.colorRange.length))
  );
  const [r, g, b] = palette.colorRange[idx];
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Generates a full 5-Stage Markdown Vetting Report for download or sharing.
 */
export function generateMarkdownVettingReport(analysis: VettingAnalysis): string {
  const { property: p, params } = analysis;
  const fx = params.fxRate;
  const dateStr = new Date().toISOString().slice(0, 10);

  const compRows = analysis.comps
    .map(
      (c) =>
        `| **${c.name}** | ${c.beds}bd / ${c.baths}ba, ${c.sqft > 0 ? `${c.sqft.toLocaleString()} sf` : `${c.lotSqft.toLocaleString()} sf lot`} (${c.status}) | ${formatMoney(c.priceUsd, 'USD', fx)} (${formatMoney(c.priceUsd, 'JMD', fx)}) | ${c.implication} |`
    )
    .join('\n');

  const flagLines = p.signalFlags
    .map((f) => `- **[${f.level.toUpperCase()}] ${f.label}:** ${f.detail}`)
    .join('\n');

  const legalLines = analysis.legalChecks
    .map((l) => `- **[${l.severity.toUpperCase()}] ${l.title}:** ${l.detail}`)
    .join('\n');

  const questionLines = analysis.qualificationQuestions
    .map((q, i) => `${i + 1}. "${q}"`)
    .join('\n');

  return `# 5-Stage Property Vetting Report: ${p.name}

**Generated:** ${dateStr} | **Parish:** ${p.parish}, Jamaica | **MLS / Ref:** ${p.mlsNumber || p.id}
**Address:** ${p.address}
**Coordinates:** ${p.lat.toFixed(5)}, ${p.lng.toFixed(5)} (${p.granularity})
**Verdict:** **${analysis.verdict.toUpperCase()}** — ${analysis.verdictHeadline}

---

## Stage 1: Listing Extraction & Signal Audit

- **Core Specs:** ${p.beds} bed / ${p.baths} bath ${p.propertyType} · ${p.sqft.toLocaleString()} sq ft interior · ${p.lotSqft.toLocaleString()} sq ft (${(p.lotSqft / 43560).toFixed(3)} acres) lot
- **Asking Price:** **${formatMoney(p.value, 'USD', fx)} USD** (~**${formatMoney(p.value, 'JMD', fx)} JMD** at J$${fx}/USD)
- **Deal Status & Tenure:** ${p.dealStatus} · ${p.tenure}
- **Construction:** ${p.construction}
- **Utilities:** ${p.utilities.join(', ')}
- **Broker / Agency:** ${p.broker}, ${p.agency}${p.agentPhone ? ` (${p.agentPhone})` : ''}

### Audit Signals & Red Flags
${flagLines || '- No critical red flags detected from listing metadata.'}

---

## Stage 2: Market Comp & Land-vs.-Structure Breakdown

- **Estimated Land Value:** ${formatMoney(analysis.estimatedLandValueUsd, 'USD', fx)} (${formatMoney(analysis.estimatedLandValueUsd, 'JMD', fx)}) @ $${p.landValuePerSqftUsd}/sq ft land basis
- **Implied Structure Value:** ${formatMoney(analysis.impliedStructureValueUsd, 'USD', fx)}${analysis.impliedStructurePerSqftUsd > 0 ? ` ($${analysis.impliedStructurePerSqftUsd}/sq ft)` : ''}
- **Subject Price / Sq Ft:** $${analysis.pricePerSqftUsd.toLocaleString()}/sf vs. Comp Median $${analysis.compMedianPsfUsd.toLocaleString()}/sf (${analysis.askVsCompPct >= 0 ? '+' : ''}${analysis.askVsCompPct}% vs. comp median)

| Comp / Benchmark | Specs | Asking / Sale Price | Implication |
| :--- | :--- | :--- | :--- |
${compRows}

---

## Stage 3: All-In Basis & Yield Underwriting (${params.strategy} Strategy)

### 1. Estimated All-In Acquisition Basis (Cash Purchase)
- **Asking Price:** ${formatMoney(p.value, 'USD', fx)} (${formatMoney(p.value, 'JMD', fx)})
- **Jamaica Buyer Closing Costs (~${((analysis.closingCostsUsd / Math.max(p.value, 1)) * 100).toFixed(1)}%):** ${formatMoney(analysis.closingCostsUsd, 'USD', fx)}
  - Half Stamp Duty (J$2,500): ${formatMoney(analysis.closingBreakdown.stampDutyHalfUsd, 'USD', fx)}
  - NLA Title Registration (0.25%): ${formatMoney(analysis.closingBreakdown.nlaRegistrationUsd, 'USD', fx)}
  - Attorney Fees + 16.5% GCT: ${formatMoney(analysis.closingBreakdown.attorneyAndGctUsd, 'USD', fx)}
  - Surveyor ID Report & Valuation: ${formatMoney(analysis.closingBreakdown.surveyAndValuationUsd, 'USD', fx)}
- **Immediate CapEx / Rehab:** ${formatMoney(analysis.capexUsd, 'USD', fx)}
- **Estimated All-In Basis:** **${formatMoney(analysis.allInBasisUsd, 'USD', fx)} USD** (**${formatMoney(analysis.allInBasisUsd, 'JMD', fx)} JMD**)

### 2. Cash-Flow & Net Yield Comparison (Target Hurdle: ${params.targetHurdleCapRate}%)
- **Long-Term Rental (LTR):** ${formatMoney(p.estimatedLtrMonthlyJmd / fx, 'JMD', fx)}/mo gross (${formatMoney(analysis.ltrGrossAnnualUsd, 'USD', fx)}/yr) → **${formatMoney(analysis.ltrNoiUsd, 'USD', fx)}/yr NOI** → **${analysis.ltrCapRatePct.toFixed(2)}% Net Cap Rate** (${params.ltrOperatingDragPct}% op drag)
- **Short-Term Rental (STR / Airbnb):** $${p.estimatedStrNightlyUsd}/night @ ${p.strOccupancyPct}% occ (${formatMoney(analysis.strGrossAnnualUsd, 'USD', fx)}/yr) → **${formatMoney(analysis.strNoiUsd, 'USD', fx)}/yr NOI** → **${analysis.strCapRatePct.toFixed(2)}% Net Cap Rate** (${params.strOperatingDragPct}% op drag)
- **Active Strategy (${params.strategy}) Net Yield:** **${analysis.activeStrategyCapRatePct.toFixed(2)}%** (${analysis.hurdleGapPct >= 0 ? '+' : ''}${analysis.hurdleGapPct.toFixed(2)}% vs. ${params.targetHurdleCapRate}% hurdle)

---

## Stage 4: Legal, Title & Site Make-or-Breaks (${params.buyerProfile})

${legalLines}

---

## Stage 5: Verdict & Action Plan

- **Verdict:** **${analysis.verdict.toUpperCase()}** — ${analysis.verdictHeadline}
- **Rationale:** ${analysis.verdictRationale}
- **Defensible Target Offer Band:** **${formatMoney(analysis.targetOfferLowUsd, 'USD', fx)} – ${formatMoney(analysis.targetOfferHighUsd, 'USD', fx)} USD** (**${formatMoney(analysis.targetOfferLowUsd, 'JMD', fx)} – ${formatMoney(analysis.targetOfferHighUsd, 'JMD', fx)} JMD**)

### Agent Qualification Script (${p.broker}${p.agentPhone ? ` · ${p.agentPhone}` : ''})
${questionLines}
`;
}

function normalizePropertyType(raw?: string): PropertyType {
  const lower = (raw || '').trim().toLowerCase();
  if (lower.includes('scheme') || lower.includes('nht')) return 'Scheme House';
  if (lower.includes('condo') || lower.includes('apt')) return 'Condo / Apt';
  if (lower.includes('beach') || lower.includes('resort') || lower.includes('guest'))
    return 'Beachfront / Resort';
  if (lower.includes('multi') || lower.includes('duplex') || lower.includes('plex'))
    return 'Multi-Family';
  if (lower.includes('comm') || lower.includes('retail') || lower.includes('office'))
    return 'Commercial';
  if (lower.includes('land') || lower.includes('lot') || lower.includes('acre'))
    return 'Raw Land';
  return 'Villa / Detached';
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if ((ch === ',' || ch === '\t' || ch === '|') && !inQuotes) {
      cells.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

function parseNumberCell(raw?: string, fallback = 0): number {
  if (!raw) return fallback;
  const cleaned = raw.replace(/[J$,\s]/gi, '');
  const match = cleaned.match(/^([\d.]+)([kKmM])?$/);
  if (!match) {
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
  }
  const base = Number(match[1]);
  const suffix = (match[2] || '').toLowerCase();
  if (suffix === 'm') return Math.round(base * 1_000_000);
  if (suffix === 'k') return Math.round(base * 1_000);
  return Math.round(base);
}

export function parseBatchInput(rawText: string): ParsedBatchRow[] {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const rows: ParsedBatchRow[] = [];

  lines.forEach((line, index) => {
    if (
      index === 0 &&
      /address/i.test(line) &&
      /(value|price|valuation)/i.test(line)
    ) {
      return;
    }

    let address = '';
    let valueStr = '';
    let sqftStr = '';
    let typeStr = '';

    if (line.includes('|')) {
      const parts = line.split('|').map((s) => s.trim());
      [address, valueStr, sqftStr, typeStr] = parts;
    } else if (line.includes('\t')) {
      const parts = line.split('\t').map((s) => s.trim());
      [address, valueStr, sqftStr, typeStr] = parts;
    } else {
      const cells = splitCsvLine(line);
      if (cells.length >= 2) {
        const firstNumericIdx = cells.findIndex(
          (c, i) => i > 0 && /^[J$]?[\d,.]+[kKmM]?$/i.test(c.trim())
        );
        if (firstNumericIdx > 0) {
          address = cells.slice(0, firstNumericIdx).join(', ');
          valueStr = cells[firstNumericIdx] || '';
          sqftStr = cells[firstNumericIdx + 1] || '';
          typeStr = cells[firstNumericIdx + 2] || '';
        } else {
          address = cells[0];
          valueStr = cells[1] || '';
          sqftStr = cells[2] || '';
          typeStr = cells[3] || '';
        }
      } else {
        address = cells[0] || '';
      }
    }

    address = address.replace(/^"|"$/g, '').trim();
    if (!address) return;

    const value = parseNumberCell(valueStr, 185000);
    const sqft = parseNumberCell(sqftStr, 1400);
    const propertyType = normalizePropertyType(typeStr);
    const parish = inferJamaicaParish(address);

    rows.push({
      rowNumber: index + 1,
      address,
      value,
      sqft,
      propertyType,
      parish,
      status: 'pending',
    });
  });

  return rows;
}

export function exportPropertiesToCsv(
  properties: PropertyRecord[],
  params: UnderwritingParams = DEFAULT_UNDERWRITING_PARAMS
): string {
  const header = [
    'Name',
    'Address',
    'Parish',
    'Deal Status',
    'Property Type',
    'Asking Price (USD)',
    'Asking Price (JMD)',
    'Living Sq Ft',
    'Lot Sq Ft',
    'Beds',
    'Baths',
    'Price / Sq Ft (USD)',
    'Net Cap Rate (%)',
    'Verdict',
    'Target Offer Low (USD)',
    'Target Offer High (USD)',
    'Latitude',
    'Longitude',
  ];

  const escapeCell = (val: string | number) => {
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = properties.map((p) => {
    const analysis = runVettingAnalysis(p, properties, params);
    return [
      p.name,
      p.address,
      p.parish,
      p.dealStatus,
      p.propertyType,
      p.value,
      Math.round(p.value * params.fxRate),
      p.sqft,
      p.lotSqft,
      p.beds,
      p.baths,
      getPricePerSqft(p),
      analysis.activeStrategyCapRatePct.toFixed(2),
      analysis.verdict,
      analysis.targetOfferLowUsd,
      analysis.targetOfferHighUsd,
      p.lat.toFixed(6),
      p.lng.toFixed(6),
    ]
      .map(escapeCell)
      .join(',');
  });

  return [header.join(','), ...rows].join('\n');
}
