import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody } from '@/components/ui/dialog';
import { MapPin, Search, Navigation, X, ExternalLink, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

export interface LocationData {
  lat: number;
  lng: number;
  address?: string;
  name?: string;
}

interface SearchResult {
  place_id: string;
  main_text: string;
  secondary_text: string;
  description: string;
  lat: number;
  lng: number;
  source: 'local' | 'google' | 'nominatim';
}

interface LocationPickerProps {
  value?: LocationData | null;
  onChange: (location: LocationData | null) => void;
  placeholder?: string;
  disabled?: boolean;
  label?: string;
}

// Lazy loaded map component
interface MapComponentProps {
  center: [number, number];
  selectedLocation: LocationData | null;
  onLocationSelect: (lat: number, lng: number) => void;
}

function LazyMapComponent({ center, selectedLocation, onLocationSelect }: MapComponentProps) {
  const [MapComponents, setMapComponents] = useState<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadMap = async () => {
      try {
        await import('leaflet/dist/leaflet.css');
        const L = await import('leaflet');

        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
        });

        const RL = await import('react-leaflet');

        if (mounted) {
          setMapComponents(RL);
          setIsLoaded(true);
        }
      } catch (error) {
        console.error('Failed to load map:', error);
      }
    };

    loadMap();
    return () => { mounted = false; };
  }, []);

  if (!isLoaded || !MapComponents) {
    return (
      <div className="h-full w-full rounded-lg border bg-muted flex items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="text-sm">جاري تحميل الخريطة...</span>
        </div>
      </div>
    );
  }

  const { MapContainer, TileLayer, Marker, useMapEvents, useMap } = MapComponents;

  function MapEventHandler() {
    useMapEvents({
      click: (e: any) => {
        onLocationSelect(e.latlng.lat, e.latlng.lng);
      },
    });
    return null;
  }

  function MapRecenter({ position }: { position: [number, number] }) {
    const map = useMap();
    useEffect(() => {
      map.setView(position, map.getZoom());
    }, [position, map]);
    return null;
  }

  return (
    <MapContainer
      center={center}
      zoom={13}
      style={{ height: '100%', width: '100%' }}
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapEventHandler />
      <MapRecenter position={center} />
      {selectedLocation && (
        <Marker position={[selectedLocation.lat, selectedLocation.lng]} />
      )}
    </MapContainer>
  );
}

export function LocationPicker({
  value,
  onChange,
  placeholder = "اختر الموقع على الخريطة",
  disabled = false,
  label
}: LocationPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(value || null);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);
  const [mapCenter, setMapCenter] = useState<[number, number]>(
    value ? [value.lat, value.lng] : [30.0444, 31.2357] // Default: Cairo, Egypt
  );

  const [predictions, setPredictions] = useState<SearchResult[]>([]);
  const [showPredictions, setShowPredictions] = useState(false);
  const [isLoadingPredictions, setIsLoadingPredictions] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const predictionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value) {
      setSelectedLocation(value);
      setMapCenter([value.lat, value.lng]);
    }
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (predictionsRef.current && !predictionsRef.current.contains(event.target as Node)) {
        setShowPredictions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search using Supabase Edge Function (avoids CORS)
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery.trim().length < 2) {
      setPredictions([]);
      setShowPredictions(false);
      return;
    }

    let cancelled = false;
    setIsLoadingPredictions(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        console.log('[LocationPicker] Searching for:', searchQuery);
        
        const { data, error } = await supabase.functions.invoke('location-search', {
          body: { action: 'search', query: searchQuery }
        });

        if (cancelled) return;

        if (error) {
          console.error('[LocationPicker] Search error:', error);
          setPredictions([]);
        } else if (data?.success && data?.results) {
          console.log('[LocationPicker] Found results:', data.results.length);
          setPredictions(data.results);
          setShowPredictions(true);
        } else {
          setPredictions([]);
        }
      } catch (error) {
        if (cancelled) return;
        console.error('[LocationPicker] Search failed:', error);
        setPredictions([]);
      } finally {
        if (!cancelled) setIsLoadingPredictions(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  const selectPrediction = useCallback((prediction: SearchResult) => {
    setShowPredictions(false);
    setPredictions([]);
    setSearchQuery(prediction.main_text);

    const lat = prediction.lat;
    const lng = prediction.lng;
    
    setMapCenter([lat, lng]);
    setSelectedLocation({
      lat,
      lng,
      address: prediction.description,
      name: prediction.main_text,
    });
  }, []);

  const reverseGeocode = useCallback(async (lat: number, lng: number): Promise<string> => {
    try {
      const { data, error } = await supabase.functions.invoke('location-search', {
        body: { action: 'reverse', lat, lng }
      });

      if (error || !data?.success) {
        return '';
      }

      return data.address || '';
    } catch (error) {
      console.error('Reverse geocoding failed:', error);
      return '';
    }
  }, []);

  const searchLocation = useCallback(async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setShowPredictions(false);

    try {
      const { data, error } = await supabase.functions.invoke('location-search', {
        body: { action: 'search', query: searchQuery }
      });

      if (!error && data?.success && data?.results?.length > 0) {
        const first = data.results[0];
        setMapCenter([first.lat, first.lng]);
        setSelectedLocation({
          lat: first.lat,
          lng: first.lng,
          address: first.description,
          name: first.main_text,
        });
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery]);

  const getCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      alert('المتصفح لا يدعم تحديد الموقع');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        setIsLoadingAddress(true);
        const address = await reverseGeocode(lat, lng);
        setIsLoadingAddress(false);

        setMapCenter([lat, lng]);
        setSelectedLocation({
          lat,
          lng,
          address,
          name: 'موقعي الحالي',
        });
      },
      (error) => {
        console.error('Geolocation error:', error);
        alert('فشل في تحديد الموقع. تأكد من السماح بالوصول للموقع.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [reverseGeocode]);

  const handleMapClick = useCallback(async (lat: number, lng: number) => {
    setIsLoadingAddress(true);
    const address = await reverseGeocode(lat, lng);
    setIsLoadingAddress(false);
    setSelectedLocation({ lat, lng, address });
  }, [reverseGeocode]);

  const handleConfirm = useCallback(() => {
    onChange(selectedLocation);
    setIsOpen(false);
  }, [onChange, selectedLocation]);

  const handleClear = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
    setSelectedLocation(null);
  }, [onChange]);

  const openInGoogleMaps = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (value) {
      window.open(`https://www.google.com/maps?q=${value.lat},${value.lng}`, '_blank');
    }
  }, [value]);

  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          className="flex-1 justify-start text-right h-auto min-h-[2.5rem] py-2 px-3"
          onClick={() => !disabled && setIsOpen(true)}
          disabled={disabled}
        >
          <MapPin className="h-4 w-4 ml-2 shrink-0 text-primary" />
          <span className="truncate text-sm">
            {value?.name || value?.address?.split(',')[0] || placeholder}
          </span>
        </Button>

        {value && !disabled && (
          <div className="flex gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={openInGoogleMaps}
              className="h-10 w-10 shrink-0"
              title="فتح في خرائط جوجل"
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleClear}
              className="h-10 w-10 shrink-0"
              title="مسح الموقع"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              اختر الموقع على الخريطة
            </DialogTitle>
          </DialogHeader>

          <DialogBody className="space-y-4">
            <div className="flex gap-2">
              <div className="flex-1 relative" ref={predictionsRef}>
                <Input
                  placeholder="ابحث عن مكان (مثل: شارع التحرير، مدينة نصر، المعادي...)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      searchLocation();
                      setShowPredictions(false);
                    }
                    if (e.key === 'Escape') {
                      setShowPredictions(false);
                    }
                  }}
                  onFocus={() => {
                    if (predictions.length > 0) {
                      setShowPredictions(true);
                    }
                  }}
                  className="pl-10"
                  dir="rtl"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />

                {isLoadingPredictions && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}

                {showPredictions && predictions.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-background border rounded-lg shadow-lg max-h-[250px] overflow-y-auto">
                    {predictions.map((prediction, index) => (
                      <button
                        key={prediction.place_id || index}
                        type="button"
                        className={cn(
                          "w-full text-right px-3 py-2.5 hover:bg-accent transition-colors flex items-start gap-2",
                          index !== predictions.length - 1 && "border-b"
                        )}
                        onClick={() => selectPrediction(prediction)}
                      >
                        <MapPin className={cn(
                          "h-4 w-4 mt-0.5 shrink-0",
                          prediction.source === 'local' ? "text-green-500" : 
                          prediction.source === 'google' ? "text-blue-500" : "text-primary"
                        )} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {prediction.main_text}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {prediction.secondary_text}
                          </p>
                        </div>
                        {prediction.source === 'local' && (
                          <span className="text-[10px] bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-1.5 py-0.5 rounded">
                            مقترح
                          </span>
                        )}
                        {prediction.source === 'google' && (
                          <span className="text-[10px] bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded">
                            Google
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {showPredictions && searchQuery.length >= 2 && predictions.length === 0 && !isLoadingPredictions && (
                  <div className="absolute z-50 w-full mt-1 bg-background border rounded-lg shadow-lg p-3 text-center text-sm text-muted-foreground">
                    لا توجد نتائج لـ "{searchQuery}"
                  </div>
                )}
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  searchLocation();
                  setShowPredictions(false);
                }}
                disabled={isSearching}
                className="shrink-0"
              >
                {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'بحث'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={getCurrentLocation}
                title="موقعي الحالي"
                className="shrink-0"
              >
                <Navigation className="h-4 w-4" />
              </Button>
            </div>

            <div className="h-[250px] sm:h-[350px] rounded-lg overflow-hidden border relative">
              <LazyMapComponent
                center={mapCenter}
                selectedLocation={selectedLocation}
                onLocationSelect={handleMapClick}
              />

              {isLoadingAddress && (
                <div className="absolute inset-0 bg-background/50 flex items-center justify-center pointer-events-none">
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    جاري تحديد العنوان...
                  </div>
                </div>
              )}
            </div>

            <p className="text-xs text-muted-foreground text-center">
              اضغط على الخريطة لتحديد الموقع، أو استخدم البحث أو موقعك الحالي
            </p>

            {selectedLocation && (
              <div className="p-3 bg-muted rounded-lg text-sm space-y-1">
                <p className="font-medium flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  الموقع المحدد:
                </p>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  {selectedLocation.address || `${selectedLocation.lat.toFixed(6)}, ${selectedLocation.lng.toFixed(6)}`}
                </p>
              </div>
            )}
          </DialogBody>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={handleConfirm} disabled={!selectedLocation}>
              <MapPin className="h-4 w-4 ml-2" />
              تأكيد الموقع
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Simple display component
interface LocationDisplayProps {
  location: LocationData;
  compact?: boolean;
  showOpenButton?: boolean;
}

export function LocationDisplay({ location, compact = false, showOpenButton = true }: LocationDisplayProps) {
  const openInMaps = () => {
    window.open(`https://www.google.com/maps?q=${location.lat},${location.lng}`, '_blank');
  };

  if (compact) {
    return (
      <button
        type="button"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
        onClick={openInMaps}
        title="فتح في خرائط جوجل"
      >
        <MapPin className="h-3 w-3" />
        <span className="truncate max-w-[120px]">
          {location.name || location.address?.split(',')[0] || 'عرض الموقع'}
        </span>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <MapPin className="h-4 w-4 text-primary shrink-0" />
      <span className="truncate text-muted-foreground">
        {location.name || location.address?.split(',')[0] || 'موقع محدد'}
      </span>
      {showOpenButton && (
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={openInMaps}>
          <ExternalLink className="h-3 w-3 ml-1" />
          خريطة
        </Button>
      )}
    </div>
  );
}

export default LocationPicker;

