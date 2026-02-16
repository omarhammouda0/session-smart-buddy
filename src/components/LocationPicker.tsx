import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody } from '@/components/ui/dialog';
import { MapPin, Search, Navigation, X, ExternalLink, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// Google Places API Key - You need to set this
// Get your API key from: https://console.cloud.google.com/apis/credentials
// Enable: Places API, Maps JavaScript API, Geocoding API
const GOOGLE_PLACES_API_KEY = import.meta.env.VITE_GOOGLE_PLACES_API_KEY || '';

export interface LocationData {
  lat: number;
  lng: number;
  address?: string;
  name?: string;
}

interface GooglePrediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

interface NominatimPrediction {
  place_id: string;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  importance: number;
}

type SearchPrediction = {
  place_id: string;
  main_text: string;
  secondary_text: string;
  description: string;
  lat?: string;
  lon?: string;
  source: 'google' | 'nominatim' | 'local';
};

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

// Egyptian areas for local fallback
const EGYPT_AREAS = [
  { name: 'القاهرة', lat: '30.0444', lon: '31.2357', area: 'مصر' },
  { name: 'الجيزة', lat: '30.0131', lon: '31.2089', area: 'مصر' },
  { name: 'الإسكندرية', lat: '31.2001', lon: '29.9187', area: 'مصر' },
  { name: 'مدينة نصر', lat: '30.0511', lon: '31.3656', area: 'القاهرة' },
  { name: 'المعادي', lat: '29.9602', lon: '31.2569', area: 'القاهرة' },
  { name: 'مصر الجديدة', lat: '30.0875', lon: '31.3428', area: 'القاهرة' },
  { name: 'الزمالك', lat: '30.0659', lon: '31.2194', area: 'القاهرة' },
  { name: 'المهندسين', lat: '30.0566', lon: '31.2003', area: 'الجيزة' },
  { name: 'الدقي', lat: '30.0392', lon: '31.2125', area: 'الجيزة' },
  { name: '6 أكتوبر', lat: '29.9285', lon: '30.9188', area: 'الجيزة' },
  { name: 'الشيخ زايد', lat: '30.0394', lon: '30.9444', area: 'الجيزة' },
  { name: 'التجمع الخامس', lat: '30.0074', lon: '31.4913', area: 'القاهرة الجديدة' },
  { name: 'الرحاب', lat: '30.0614', lon: '31.4903', area: 'القاهرة الجديدة' },
  { name: 'العبور', lat: '30.1736', lon: '31.4736', area: 'القليوبية' },
  { name: 'شبرا', lat: '30.1094', lon: '31.2486', area: 'القاهرة' },
  { name: 'عين شمس', lat: '30.1314', lon: '31.3283', area: 'القاهرة' },
  { name: 'حلوان', lat: '29.8419', lon: '31.3342', area: 'القاهرة' },
  { name: 'المقطم', lat: '30.0108', lon: '31.3019', area: 'القاهرة' },
  { name: 'العجوزة', lat: '30.0578', lon: '31.2089', area: 'الجيزة' },
  { name: 'فيصل', lat: '29.9869', lon: '31.1494', area: 'الجيزة' },
  { name: 'الهرم', lat: '29.9792', lon: '31.1342', area: 'الجيزة' },
  { name: 'شارع التحرير', lat: '30.0444', lon: '31.2357', area: 'وسط البلد، القاهرة' },
  { name: 'شارع الهرم', lat: '30.0131', lon: '31.2089', area: 'الجيزة' },
  { name: 'شارع جامعة الدول العربية', lat: '30.0566', lon: '31.2003', area: 'المهندسين' },
  { name: 'شارع مصطفى النحاس', lat: '30.0511', lon: '31.3456', area: 'مدينة نصر' },
  { name: 'شارع عباس العقاد', lat: '30.0561', lon: '31.3456', area: 'مدينة نصر' },
  { name: 'شارع مكرم عبيد', lat: '30.0611', lon: '31.3456', area: 'مدينة نصر' },
  { name: 'الكوربة', lat: '30.0875', lon: '31.3428', area: 'مصر الجديدة' },
  { name: 'روكسي', lat: '30.0875', lon: '31.3250', area: 'مصر الجديدة' },
  { name: 'ميدان التحرير', lat: '30.0444', lon: '31.2357', area: 'وسط البلد' },
  { name: 'ميدان رمسيس', lat: '30.0619', lon: '31.2467', area: 'القاهرة' },
  { name: 'شارع 9', lat: '30.0511', lon: '31.3656', area: 'المعادي' },
  { name: 'المنيل', lat: '30.0167', lon: '31.2333', area: 'القاهرة' },
  { name: 'جاردن سيتي', lat: '30.0361', lon: '31.2319', area: 'القاهرة' },
  { name: 'وسط البلد', lat: '30.0500', lon: '31.2500', area: 'القاهرة' },
];

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
    value ? [value.lat, value.lng] : [30.0444, 31.2357]
  );

  const [predictions, setPredictions] = useState<SearchPrediction[]>([]);
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

  // Search with Google Places API if available, fallback to Nominatim + local
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
        const query = searchQuery.trim().toLowerCase();
        const allResults: SearchPrediction[] = [];

        // 1. Local Egyptian areas search (fastest, always works)
        const localMatches = EGYPT_AREAS.filter(area => 
          area.name.toLowerCase().includes(query) || 
          query.includes(area.name.toLowerCase()) ||
          area.name.includes(searchQuery) ||
          searchQuery.includes(area.name)
        ).slice(0, 5);

        localMatches.forEach(area => {
          allResults.push({
            place_id: `local_${area.name}`,
            main_text: area.name,
            secondary_text: area.area + '، مصر',
            description: `${area.name}، ${area.area}، مصر`,
            lat: area.lat,
            lon: area.lon,
            source: 'local'
          });
        });

        // 2. Try Google Places API if key is available
        if (GOOGLE_PLACES_API_KEY) {
          try {
            const googleResponse = await fetch(
              `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(searchQuery)}&components=country:eg&language=ar&types=geocode|establishment&key=${GOOGLE_PLACES_API_KEY}`
            );
            const googleData = await googleResponse.json();
            
            if (googleData.predictions) {
              googleData.predictions.slice(0, 5).forEach((pred: GooglePrediction) => {
                if (!allResults.find(r => r.description === pred.description)) {
                  allResults.push({
                    place_id: pred.place_id,
                    main_text: pred.structured_formatting.main_text,
                    secondary_text: pred.structured_formatting.secondary_text,
                    description: pred.description,
                    source: 'google'
                  });
                }
              });
            }
          } catch (e) {
            console.log('Google Places API not available, using fallback');
          }
        }

        // 3. Nominatim search for additional results
        const egyptViewbox = '24.7,22.0,36.9,31.7';
        
        // Direct search
        const response1 = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&countrycodes=eg&viewbox=${egyptViewbox}&bounded=1&limit=5&accept-language=ar&addressdetails=1`
        );
        const data1: NominatimPrediction[] = await response1.json();
        
        data1.forEach(item => {
          const mainText = item.display_name.split(',')[0];
          const secondaryText = item.display_name.split(',').slice(1, 3).join(',');
          if (!allResults.find(r => r.main_text === mainText)) {
            allResults.push({
              place_id: item.place_id,
              main_text: mainText,
              secondary_text: secondaryText,
              description: item.display_name,
              lat: item.lat,
              lon: item.lon,
              source: 'nominatim'
            });
          }
        });

        // Try with شارع prefix if few results
        if (allResults.length < 5 && !searchQuery.includes('شارع')) {
          const response2 = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent('شارع ' + searchQuery)}&countrycodes=eg&viewbox=${egyptViewbox}&bounded=1&limit=3&accept-language=ar`
          );
          const data2: NominatimPrediction[] = await response2.json();
          
          data2.forEach(item => {
            const mainText = item.display_name.split(',')[0];
            const secondaryText = item.display_name.split(',').slice(1, 3).join(',');
            if (!allResults.find(r => r.main_text === mainText)) {
              allResults.push({
                place_id: item.place_id,
                main_text: mainText,
                secondary_text: secondaryText,
                description: item.display_name,
                lat: item.lat,
                lon: item.lon,
                source: 'nominatim'
              });
            }
          });
        }

        // Sort: local first, then by relevance
        const sortedResults = allResults
          .sort((a, b) => {
            if (a.source === 'local' && b.source !== 'local') return -1;
            if (b.source === 'local' && a.source !== 'local') return 1;
            return 0;
          })
          .slice(0, 8);

        setPredictions(sortedResults);
        setShowPredictions(true);
      } catch (error) {
        console.error('Search predictions failed:', error);
        setPredictions([]);
      } finally {
        setIsLoadingPredictions(false);
      }
    }, 350);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  const selectPrediction = useCallback(async (prediction: SearchPrediction) => {
    setShowPredictions(false);
    setPredictions([]);
    setSearchQuery(prediction.main_text);

    // If we have coordinates, use them directly
    if (prediction.lat && prediction.lon) {
      const lat = parseFloat(prediction.lat);
      const lng = parseFloat(prediction.lon);
      setMapCenter([lat, lng]);
      setSelectedLocation({
        lat,
        lng,
        address: prediction.description,
        name: prediction.main_text,
      });
      return;
    }

    // For Google Places results, get coordinates using Geocoding
    if (prediction.source === 'google' && GOOGLE_PLACES_API_KEY) {
      try {
        const response = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?place_id=${prediction.place_id}&key=${GOOGLE_PLACES_API_KEY}`
        );
        const data = await response.json();
        if (data.results?.[0]?.geometry?.location) {
          const { lat, lng } = data.results[0].geometry.location;
          setMapCenter([lat, lng]);
          setSelectedLocation({
            lat,
            lng,
            address: prediction.description,
            name: prediction.main_text,
          });
        }
      } catch (e) {
        console.error('Failed to get coordinates:', e);
      }
    }
  }, []);

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

  const searchLocation = useCallback(async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setShowPredictions(false);
    
    try {
      const query = searchQuery.trim();
      const egyptViewbox = '24.7,22.0,36.9,31.7';
      
      // Check local areas first
      const localMatch = EGYPT_AREAS.find(area => 
        area.name === query || area.name.includes(query) || query.includes(area.name)
      );
      
      if (localMatch) {
        const lat = parseFloat(localMatch.lat);
        const lng = parseFloat(localMatch.lon);
        setMapCenter([lat, lng]);
        setSelectedLocation({
          lat,
          lng,
          address: `${localMatch.name}، ${localMatch.area}، مصر`,
          name: localMatch.name,
        });
        setIsSearching(false);
        return;
      }

      // Try Nominatim search
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=eg&viewbox=${egyptViewbox}&bounded=1&limit=1&accept-language=ar`
      );
      const data = await response.json();
      
      if (data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        setMapCenter([lat, lng]);
        setSelectedLocation({
          lat,
          lng,
          address: data[0].display_name,
          name: query,
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
                          prediction.source === 'local' ? "text-green-500" : "text-primary"
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
