import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { Loader2, MapPin, Search, X } from 'lucide-react';
import { isQuotaErrorMessage, notifyQuotaExceeded } from '../services/geocodeService';

export interface SelectedAddressResult {
  address: string;
  name?: string;
  lat: number;
  lng: number;
  placeId?: string;
}

interface AddressAutocompleteInputProps {
  value: string;
  onChange: (val: string) => void;
  onSelectAddress: (result: SelectedAddressResult) => void;
  placeholder?: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}

/**
 * Modern Places API (New) address autocomplete built with
 * AutocompleteSuggestion.fetchAutocompleteSuggestions, AutocompleteSessionToken,
 * and Place.fetchFields (zero legacy Autocomplete/PlacesService).
 * Doc: https://developers.google.com/maps/documentation/javascript/place-autocomplete-data?utm_campaign=gmp_mcp_codeassist_v1_aistudio
 */
export function AddressAutocompleteInput({
  value,
  onChange,
  onSelectAddress,
  placeholder = 'Search any street address...',
  inputRef,
}: AddressAutocompleteInputProps) {
  const placesLib = useMapsLibrary('places');
  const sessionTokenRef =
    useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [suggestions, setSuggestions] = useState<
    google.maps.places.AutocompleteSuggestion[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isFetchingDetails, setIsFetchingDetails] = useState(false);
  const skipNextFetchRef = useRef(false);

  const resetSession = useCallback(() => {
    sessionTokenRef.current = null;
    setSuggestions([]);
    setIsOpen(false);
    setActiveIndex(-1);
  }, []);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  useEffect(() => {
    if (skipNextFetchRef.current) {
      skipNextFetchRef.current = false;
      return;
    }

    const query = value.trim();
    if (!placesLib || query.length < 3) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const { AutocompleteSessionToken, AutocompleteSuggestion } = placesLib;
        if (!sessionTokenRef.current) {
          sessionTokenRef.current = new AutocompleteSessionToken();
        }

        setIsLoading(true);
        const res = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: query,
          sessionToken: sessionTokenRef.current,
        });

        if (!cancelled) {
          const next = res.suggestions || [];
          setSuggestions(next);
          setIsOpen(next.length > 0);
          setActiveIndex(-1);
        }
      } catch (err) {
        if (!cancelled) {
          setSuggestions([]);
          setIsOpen(false);
          if (isQuotaErrorMessage(err)) {
            notifyQuotaExceeded();
          }
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }, 260);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [placesLib, value]);

  const handleSelectSuggestion = useCallback(
    async (suggestion: google.maps.places.AutocompleteSuggestion) => {
      if (!placesLib || !suggestion.placePrediction) return;
      setIsFetchingDetails(true);
      try {
        const place = suggestion.placePrediction.toPlace();
        await place.fetchFields({
          fields: ['id', 'displayName', 'formattedAddress', 'location'],
        });

        if (place.location) {
          const formatted =
            place.formattedAddress ||
            suggestion.placePrediction.text.text ||
            value;
          skipNextFetchRef.current = true;
          onChange(formatted);
          onSelectAddress({
            address: formatted,
            name: place.displayName || undefined,
            lat: place.location.lat(),
            lng: place.location.lng(),
            placeId: place.id,
          });
        }
      } catch (err) {
        if (isQuotaErrorMessage(err)) {
          notifyQuotaExceeded();
        }
      } finally {
        setIsFetchingDetails(false);
        resetSession();
      }
    },
    [onChange, onSelectAddress, placesLib, resetSession, value]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      void handleSelectSuggestion(suggestions[activeIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative flex items-center">
        <Search
          className="pointer-events-none absolute left-3 h-4 w-4 text-slate-400"
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-label="Physical street address"
          className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-9 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
        />
        {isLoading || isFetchingDetails ? (
          <Loader2
            className="absolute right-3 h-4 w-4 animate-spin text-slate-400"
            aria-hidden="true"
          />
        ) : value.length > 0 ? (
          <button
            type="button"
            onClick={() => {
              onChange('');
              resetSession();
            }}
            aria-label="Clear address"
            className="absolute right-2.5 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      {isOpen && suggestions.length > 0 && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-full z-40 mt-1.5 max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          {suggestions.map((suggestion, idx) => {
            const pred = suggestion.placePrediction;
            if (!pred) return null;
            const mainText = pred.mainText?.text || pred.text.text;
            const secondaryText = pred.secondaryText?.text || '';
            const isActive = idx === activeIndex;

            return (
              <li key={pred.placeId || idx} role="option" aria-selected={isActive}>
                <button
                  type="button"
                  onClick={() => void handleSelectSuggestion(suggestion)}
                  className={`flex w-full items-start gap-2.5 px-3 py-2 text-left text-sm transition-colors ${
                    isActive
                      ? 'bg-slate-100 text-slate-900'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-slate-900">
                      {mainText}
                    </span>
                    {secondaryText && (
                      <span className="block truncate text-xs text-slate-500">
                        {secondaryText}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
