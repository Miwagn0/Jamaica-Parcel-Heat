# Jamaica ParcelHeat

An interactive **Jamaica Real Estate Property Search, Valuation Heatmap & 5-Stage Property Vetting Tool** forked and adapted from `Parcel-Heat`.

## Features

- **Address & Listing URL Search:** Enter any Jamaica street address, estate, MLS#, or listing URL to geocode, pull up property details, plot on the heatmap, and immediately run underwriting.
- **Price & Location Scan Filters:** Filter across Jamaican parishes (Hanover, Westmoreland/Negril, St. James/Montego Bay, St. Ann/Ocho Rios, Kingston & St. Andrew, Portland, St. Elizabeth, Manchester, St. Catherine, Trelawny), USD/JMD price bands, property types, deal status (including **NHT Private Treaty**), bedrooms, and deal verdicts.
- **Dual-Engine Interactive Heatmap:** Works out of the box with **Leaflet + CartoDB/Esri Satellite + Canvas2D Thermal Heatmap** (zero API keys required) and automatically upgrades to **Google Maps + Deck.gl** when `VITE_GOOGLE_MAPS_API_KEY` is configured.
- **5-Stage Jamaica Property Vetting Engine:**
  1. **Listing Extraction & Signal Audit** (NHT Private-Treaty flags, construction, utilities, broker chain)
  2. **Market Comp & Land-vs.-Structure Breakdown** (parish land basis, implied structure value, local comps table)
  3. **All-In Basis & Yield Underwriting** (Jamaica closing costs: 0% foreign surcharge, 50% of flat J$5,000 Stamp Duty, 0.25% NLA title reg, attorney + 16.5% GCT, surveyor & valuation; LTR vs. STR vs. Value-Add NOI & Net Cap Rate)
  4. **Legal, Title & Site Make-or-Breaks** (unrestricted foreign freehold, NHT mortgagee powers-of-sale risks, Strata by-laws, coastal setbacks)
  5. **Verdict, Target Offer Band & Agent Qualification Script** (`Pursue` / `Negotiate` / `Pass`, USD & JMD offer range, copyable broker questions)
- **Printable & Exportable Reports:** Generate a clean print-to-PDF 5-stage vetting dossier, download as Markdown (`.md`), or export the filtered ledger to CSV.

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

### Optional Environment Variables (`.env`)

- `VITE_GOOGLE_MAPS_API_KEY` — Enables Google Maps + Deck.gl GPU heatmap & Google Geocoding API (optional; Leaflet + Nominatim work automatically without it).
- `PORT` — Server port (default `3000`).
