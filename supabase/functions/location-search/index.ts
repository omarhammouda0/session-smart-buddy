import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Google Places API Key (set in Supabase secrets)
const GOOGLE_PLACES_API_KEY = Deno.env.get("GOOGLE_PLACES_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Egyptian areas for local fallback
const EGYPT_AREAS = [
  { name: 'القاهرة', lat: 30.0444, lng: 31.2357, area: 'مصر' },
  { name: 'الجيزة', lat: 30.0131, lng: 31.2089, area: 'مصر' },
  { name: 'الإسكندرية', lat: 31.2001, lng: 29.9187, area: 'مصر' },
  { name: 'مدينة نصر', lat: 30.0511, lng: 31.3656, area: 'القاهرة' },
  { name: 'المعادي', lat: 29.9602, lng: 31.2569, area: 'القاهرة' },
  { name: 'مصر الجديدة', lat: 30.0875, lng: 31.3428, area: 'القاهرة' },
  { name: 'الزمالك', lat: 30.0659, lng: 31.2194, area: 'القاهرة' },
  { name: 'المهندسين', lat: 30.0566, lng: 31.2003, area: 'الجيزة' },
  { name: 'الدقي', lat: 30.0392, lng: 31.2125, area: 'الجيزة' },
  { name: '6 أكتوبر', lat: 29.9285, lng: 30.9188, area: 'الجيزة' },
  { name: 'الشيخ زايد', lat: 30.0394, lng: 30.9444, area: 'الجيزة' },
  { name: 'التجمع الخامس', lat: 30.0074, lng: 31.4913, area: 'القاهرة الجديدة' },
  { name: 'الرحاب', lat: 30.0614, lng: 31.4903, area: 'القاهرة الجديدة' },
  { name: 'العبور', lat: 30.1736, lng: 31.4736, area: 'القليوبية' },
  { name: 'شبرا', lat: 30.1094, lng: 31.2486, area: 'القاهرة' },
  { name: 'عين شمس', lat: 30.1314, lng: 31.3283, area: 'القاهرة' },
  { name: 'حلوان', lat: 29.8419, lng: 31.3342, area: 'القاهرة' },
  { name: 'المقطم', lat: 30.0108, lng: 31.3019, area: 'القاهرة' },
  { name: 'العجوزة', lat: 30.0578, lng: 31.2089, area: 'الجيزة' },
  { name: 'فيصل', lat: 29.9869, lng: 31.1494, area: 'الجيزة' },
  { name: 'الهرم', lat: 29.9792, lng: 31.1342, area: 'الجيزة' },
  { name: 'شارع التحرير', lat: 30.0444, lng: 31.2357, area: 'وسط البلد، القاهرة' },
  { name: 'شارع الهرم', lat: 30.0131, lng: 31.2089, area: 'الجيزة' },
  { name: 'شارع جامعة الدول العربية', lat: 30.0566, lng: 31.2003, area: 'المهندسين' },
  { name: 'شارع مصطفى النحاس', lat: 30.0511, lng: 31.3456, area: 'مدينة نصر' },
  { name: 'شارع عباس العقاد', lat: 30.0561, lng: 31.3456, area: 'مدينة نصر' },
  { name: 'شارع مكرم عبيد', lat: 30.0611, lng: 31.3456, area: 'مدينة نصر' },
  { name: 'الكوربة', lat: 30.0875, lng: 31.3428, area: 'مصر الجديدة' },
  { name: 'روكسي', lat: 30.0875, lng: 31.3250, area: 'مصر الجديدة' },
  { name: 'ميدان التحرير', lat: 30.0444, lng: 31.2357, area: 'وسط البلد' },
  { name: 'ميدان رمسيس', lat: 30.0619, lng: 31.2467, area: 'القاهرة' },
  { name: 'شارع 9', lat: 30.0511, lng: 31.3656, area: 'المعادي' },
  { name: 'المنيل', lat: 30.0167, lng: 31.2333, area: 'القاهرة' },
  { name: 'جاردن سيتي', lat: 30.0361, lng: 31.2319, area: 'القاهرة' },
  { name: 'وسط البلد', lat: 30.0500, lng: 31.2500, area: 'القاهرة' },
  { name: 'المنصورة', lat: 31.0409, lng: 31.3785, area: 'الدقهلية' },
  { name: 'طنطا', lat: 30.7865, lng: 31.0004, area: 'الغربية' },
  { name: 'الزقازيق', lat: 30.5877, lng: 31.5020, area: 'الشرقية' },
  { name: 'أسيوط', lat: 27.1809, lng: 31.1837, area: 'أسيوط' },
  { name: 'سوهاج', lat: 26.5591, lng: 31.6948, area: 'سوهاج' },
  { name: 'الأقصر', lat: 25.6872, lng: 32.6396, area: 'الأقصر' },
  { name: 'أسوان', lat: 24.0889, lng: 32.8998, area: 'أسوان' },
  { name: 'بورسعيد', lat: 31.2653, lng: 32.3019, area: 'بورسعيد' },
  { name: 'السويس', lat: 29.9668, lng: 32.5498, area: 'السويس' },
  { name: 'الإسماعيلية', lat: 30.5965, lng: 32.2715, area: 'الإسماعيلية' },
  { name: 'دمياط', lat: 31.4165, lng: 31.8133, area: 'دمياط' },
  { name: 'شرم الشيخ', lat: 27.9158, lng: 34.3300, area: 'جنوب سيناء' },
  { name: 'الغردقة', lat: 27.2579, lng: 33.8116, area: 'البحر الأحمر' },
];

interface SearchResult {
  place_id: string;
  main_text: string;
  secondary_text: string;
  description: string;
  lat: number;
  lng: number;
  source: 'local' | 'google' | 'nominatim';
}

// Search using Google Places API
async function searchGoogle(query: string): Promise<SearchResult[]> {
  if (!GOOGLE_PLACES_API_KEY) {
    return [];
  }

  try {
    // Autocomplete
    const autocompleteUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&components=country:eg&language=ar&key=${GOOGLE_PLACES_API_KEY}`;
    const response = await fetch(autocompleteUrl);
    const data = await response.json();

    if (data.status !== 'OK' || !data.predictions) {
      console.log('Google Autocomplete status:', data.status);
      return [];
    }

    // Get details for each prediction
    const results: SearchResult[] = [];
    for (const pred of data.predictions.slice(0, 5)) {
      try {
        const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${pred.place_id}&fields=geometry,formatted_address,name&key=${GOOGLE_PLACES_API_KEY}`;
        const detailsResponse = await fetch(detailsUrl);
        const detailsData = await detailsResponse.json();

        if (detailsData.status === 'OK' && detailsData.result?.geometry?.location) {
          results.push({
            place_id: pred.place_id,
            main_text: pred.structured_formatting?.main_text || pred.description.split(',')[0],
            secondary_text: pred.structured_formatting?.secondary_text || '',
            description: pred.description,
            lat: detailsData.result.geometry.location.lat,
            lng: detailsData.result.geometry.location.lng,
            source: 'google'
          });
        }
      } catch (e) {
        console.error('Error getting place details:', e);
      }
    }

    return results;
  } catch (error) {
    console.error('Google Places search error:', error);
    return [];
  }
}

// Search using Nominatim (OpenStreetMap)
async function searchNominatim(query: string): Promise<SearchResult[]> {
  try {
    const egyptViewbox = '24.7,22.0,36.9,31.7';
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=eg&viewbox=${egyptViewbox}&bounded=1&limit=5&accept-language=ar&addressdetails=1`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'SessionSmartBuddy/1.0'
      }
    });

    if (!response.ok) {
      console.error('Nominatim error:', response.status);
      return [];
    }

    const data = await response.json();

    return data.map((item: any) => ({
      place_id: item.place_id?.toString() || `nom_${Math.random()}`,
      main_text: item.display_name?.split(',')[0] || query,
      secondary_text: item.display_name?.split(',').slice(1, 3).join(',') || '',
      description: item.display_name || '',
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      source: 'nominatim' as const
    }));
  } catch (error) {
    console.error('Nominatim search error:', error);
    return [];
  }
}

// Search local database
function searchLocal(query: string): SearchResult[] {
  const lowerQuery = query.toLowerCase();

  return EGYPT_AREAS
    .filter(area =>
      area.name.toLowerCase().includes(lowerQuery) ||
      lowerQuery.includes(area.name.toLowerCase()) ||
      area.name.includes(query) ||
      query.includes(area.name)
    )
    .slice(0, 5)
    .map(area => ({
      place_id: `local_${area.name}`,
      main_text: area.name,
      secondary_text: `${area.area}، مصر`,
      description: `${area.name}، ${area.area}، مصر`,
      lat: area.lat,
      lng: area.lng,
      source: 'local' as const
    }));
}

// Reverse geocode
async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=ar`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'SessionSmartBuddy/1.0'
      }
    });

    if (!response.ok) {
      return '';
    }

    const data = await response.json();
    return data.display_name || '';
  } catch (error) {
    console.error('Reverse geocode error:', error);
    return '';
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, query, lat, lng } = await req.json();

    if (action === 'search' && query) {
      console.log(`[Location Search] Query: "${query}"`);

      const allResults: SearchResult[] = [];
      const seenIds = new Set<string>();

      // 1. Local search (instant)
      const localResults = searchLocal(query);
      localResults.forEach(r => {
        if (!seenIds.has(r.main_text)) {
          allResults.push(r);
          seenIds.add(r.main_text);
        }
      });

      // 2. Google Places (if configured)
      if (GOOGLE_PLACES_API_KEY) {
        console.log('[Location Search] Using Google Places API');
        const googleResults = await searchGoogle(query);
        googleResults.forEach(r => {
          if (!seenIds.has(r.main_text)) {
            allResults.push(r);
            seenIds.add(r.main_text);
          }
        });
      }

      // 3. Nominatim fallback
      if (allResults.length < 5) {
        console.log('[Location Search] Using Nominatim fallback');
        const nominatimResults = await searchNominatim(query);
        nominatimResults.forEach(r => {
          if (!seenIds.has(r.main_text)) {
            allResults.push(r);
            seenIds.add(r.main_text);
          }
        });
      }

      // Sort: local first
      allResults.sort((a, b) => {
        if (a.source === 'local' && b.source !== 'local') return -1;
        if (b.source === 'local' && a.source !== 'local') return 1;
        return 0;
      });

      console.log(`[Location Search] Found ${allResults.length} results`);

      return new Response(
        JSON.stringify({ success: true, results: allResults.slice(0, 8) }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'reverse' && lat !== undefined && lng !== undefined) {
      console.log(`[Reverse Geocode] Lat: ${lat}, Lng: ${lng}`);
      const address = await reverseGeocode(lat, lng);

      return new Response(
        JSON.stringify({ success: true, address }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Location search error:', error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

