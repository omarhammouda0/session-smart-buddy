import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody } from '@/components/ui/dialog';
import { MapPin, Search, Navigation, X, ExternalLink, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface LocationData {
  lat: number;
  lng: number;
  address?: string;
  name?: string;
}

interface SearchPrediction {
  place_id: string;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  importance: number;
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

  // Dynamically import Leaflet and react-leaflet
  useEffect(() => {
    let mounted = true;

    const loadMap = async () => {
      try {
        // Import CSS
        await import('leaflet/dist/leaflet.css');

        // Import Leaflet
        const L = await import('leaflet');

        // Fix default marker icon
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
        });

        // Import react-leaflet components
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

    return () => {
      mounted = false;
    };
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

  // Inner component for map events - must be inside MapContainer
  function MapEventHandler() {
    useMapEvents({
      click: (e: any) => {
        onLocationSelect(e.latlng.lat, e.latlng.lng);
      },
    });
    return null;
  }

  // Inner component for recentering - must be inside MapContainer
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

  // Search predictions state
  const [predictions, setPredictions] = useState<SearchPrediction[]>([]);
  const [showPredictions, setShowPredictions] = useState(false);
  const [isLoadingPredictions, setIsLoadingPredictions] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const predictionsRef = useRef<HTMLDivElement>(null);

  // Update selected location when value prop changes
  useEffect(() => {
    if (value) {
      setSelectedLocation(value);
      setMapCenter([value.lat, value.lng]);
    }
  }, [value]);

  // Close predictions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (predictionsRef.current && !predictionsRef.current.contains(event.target as Node)) {
        setShowPredictions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search for predictions
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery.trim().length < 2) {
      setPredictions([]);
      setShowPredictions(false);
      return;
    }

    setIsLoadingPredictions(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        // Search with Egypt bias for better local results
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&countrycodes=eg&limit=6&accept-language=ar&addressdetails=1`
        );
        const data = await response.json();

        if (data.length === 0) {
          // Try without country restriction if no results
          const response2 = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=6&accept-language=ar&addressdetails=1`
          );
          const data2 = await response2.json();
          setPredictions(data2);
        } else {
          setPredictions(data);
        }
        setShowPredictions(true);
      } catch (error) {
        console.error('Search predictions failed:', error);
        setPredictions([]);
      } finally {
        setIsLoadingPredictions(false);
      }
    }, 300); // 300ms debounce

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  // Select a prediction
  const selectPrediction = useCallback((prediction: SearchPrediction) => {
    const lat = parseFloat(prediction.lat);
    const lng = parseFloat(prediction.lon);

    setMapCenter([lat, lng]);
    setSelectedLocation({
      lat,
      lng,
      address: prediction.display_name,
      name: prediction.display_name.split(',')[0],
    });
    setSearchQuery(prediction.display_name.split(',')[0]);
    setShowPredictions(false);
    setPredictions([]);
  }, []);

  // Reverse geocode to get address from coordinates
  const reverseGeocode = useCallback(async (lat: number, lng: number): Promise<string> => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=ar`
      );
      const data = await response.json();
      return data.display_name || '';
    } catch (error) {
      console.error('Reverse geocoding failed:', error);
      return '';
    }
  }, []);

  // Search for location by name
  const searchLocation = useCallback(async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      // Search with Egypt bias
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery + ', Egypt')}&limit=5&accept-language=ar`
      );
      const data = await response.json();

      if (data.length > 0) {
        const result = data[0];
        const lat = parseFloat(result.lat);
        const lng = parseFloat(result.lon);
        setMapCenter([lat, lng]);
        setSelectedLocation({
          lat,
          lng,
          address: result.display_name,
          name: searchQuery,
        });
      } else {
        // Try without Egypt if no results
        const response2 = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5&accept-language=ar`
        );
        const data2 = await response2.json();

        if (data2.length > 0) {
          const result = data2[0];
          const lat = parseFloat(result.lat);
          const lng = parseFloat(result.lon);
          setMapCenter([lat, lng]);
          setSelectedLocation({
            lat,
            lng,
            address: result.display_name,
            name: searchQuery,
          });
        }
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery]);

  // Get current location using browser geolocation
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
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  }, [reverseGeocode]);

  // Handle map click
  const handleMapClick = useCallback(async (lat: number, lng: number) => {
    setIsLoadingAddress(true);
    const address = await reverseGeocode(lat, lng);
    setIsLoadingAddress(false);

    setSelectedLocation({
      lat,
      lng,
      address,
    });
  }, [reverseGeocode]);

  // Confirm selection
  const handleConfirm = useCallback(() => {
    onChange(selectedLocation);
    setIsOpen(false);
  }, [onChange, selectedLocation]);

  // Clear selection
  const handleClear = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
    setSelectedLocation(null);
  }, [onChange]);

  // Open location in Google Maps
  const openInGoogleMaps = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (value) {
      window.open(
        `https://www.google.com/maps?q=${value.lat},${value.lng}`,
        '_blank'
      );
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
            {/* Search bar with predictions */}
            <div className="flex gap-2">
              <div className="flex-1 relative" ref={predictionsRef}>
                <Input
                  placeholder="ابحث عن مكان (مثل: شارع التحرير، مدينة نصر...)"
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

                {/* Loading indicator */}
                {isLoadingPredictions && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}

                {/* Predictions dropdown */}
                {showPredictions && predictions.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-background border rounded-lg shadow-lg max-h-[200px] overflow-y-auto">
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
                        <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {prediction.display_name.split(',')[0]}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {prediction.display_name.split(',').slice(1, 3).join(',')}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* No results message */}
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

            {/* Map */}
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

            {/* Selected location info */}
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

// Simple display component for showing a location (used in cards, lists)
interface LocationDisplayProps {
  location: LocationData;
  compact?: boolean;
  showOpenButton?: boolean;
}

export function LocationDisplay({ location, compact = false, showOpenButton = true }: LocationDisplayProps) {
  const openInMaps = () => {
    window.open(
      `https://www.google.com/maps?q=${location.lat},${location.lng}`,
      '_blank'
    );
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
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={openInMaps}
        >
          <ExternalLink className="h-3 w-3 ml-1" />
          خريطة
        </Button>
      )}
    </div>
  );
}

export default LocationPicker;

