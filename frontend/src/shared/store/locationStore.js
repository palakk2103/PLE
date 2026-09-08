import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

const reverseGeocodeNominatim = async (latitude, longitude) => {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&addressdetails=1`;
  const response = await fetch(url, {
    headers: {
      "Accept-Language": "en",
    },
  });
  if (!response.ok) throw new Error("Nominatim reverse geocode failed");
  const data = await response.json();
  const addr = data?.address || {};

  const streetNumber = addr.house_number || "";
  const road = addr.road || addr.street || addr.footway || addr.path || "";
  const streetAddress = [streetNumber, road].filter(Boolean).join(" ");
  const area = addr.suburb || addr.neighbourhood || addr.residential || addr.quarter || addr.subdivision || "";
  const city = addr.city || addr.town || addr.village || addr.municipality || addr.city_district || addr.county || "";
  const state = addr.state || addr.state_district || "";
  const zipCode = addr.postcode || "";
  const country = addr.country || "India";

  const addressLine = [streetAddress || area, area && area !== streetAddress ? area : ""].filter(Boolean).join(", ");
  const formattedAddress = data?.display_name || [addressLine, city, state, zipCode, country].filter(Boolean).join(", ");

  return {
    latitude,
    longitude,
    address: addressLine || streetAddress || road || area || "Current GPS Location",
    area: area || city || "Current Location",
    city: city || "",
    state: state || "",
    zipCode: zipCode || "",
    country: country || "India",
    formattedAddress: formattedAddress,
    fullAddress: formattedAddress,
    displayName: data?.display_name || formattedAddress,
  };
};

const reverseGeocodeBigDataCloud = async (latitude, longitude) => {
  const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("BigDataCloud reverse geocode failed");
  const data = await response.json();

  const area = data.locality || data.principalSubdivisionDescription || "";
  const city = data.city || data.locality || "";
  const state = data.principalSubdivision || "";
  const zipCode = data.postcode || "";
  const country = data.countryName || "India";

  const parts = [area, city, state, zipCode, country].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);
  const formattedAddress = parts.join(", ") || `Lat: ${latitude.toFixed(4)}, Lng: ${longitude.toFixed(4)}`;

  return {
    latitude,
    longitude,
    address: area || city || "Current GPS Location",
    area: area || city || "Current Location",
    city: city || "",
    state: state || "",
    zipCode: zipCode || "",
    country: country || "India",
    formattedAddress,
    fullAddress: formattedAddress,
    displayName: formattedAddress,
  };
};

const fetchAddressFromCoords = async (latitude, longitude) => {
  try {
    return await reverseGeocodeNominatim(latitude, longitude);
  } catch (err1) {
    console.warn("Nominatim lookup failed, trying fallback reverse geocoding:", err1);
    try {
      return await reverseGeocodeBigDataCloud(latitude, longitude);
    } catch (err2) {
      console.warn("All reverse geocode providers failed:", err2);
      const fallbackFormatted = `GPS (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;
      return {
        latitude,
        longitude,
        address: fallbackFormatted,
        area: "Current Location",
        city: "",
        state: "",
        zipCode: "",
        country: "India",
        formattedAddress: fallbackFormatted,
        fullAddress: fallbackFormatted,
        displayName: fallbackFormatted,
      };
    }
  }
};

export const useLocationStore = create(
  persist(
    (set, get) => ({
      currentLocation: null,
      isDetecting: false,
      detectionError: null,

      setCurrentLocation: (location) => {
        set({ currentLocation: location, detectionError: null });
      },

      clearLocation: () => {
        set({ currentLocation: null, detectionError: null });
      },

      detectCurrentLocation: async (options = { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }) => {
        set({ isDetecting: true, detectionError: null });

        return new Promise((resolve, reject) => {
          if (!navigator?.geolocation) {
            const error = new Error("Geolocation is not supported by your browser.");
            set({ isDetecting: false, detectionError: error.message });
            reject(error);
            return;
          }

          navigator.geolocation.getCurrentPosition(
            async (position) => {
              try {
                const { latitude, longitude } = position.coords;
                const locData = await fetchAddressFromCoords(latitude, longitude);

                set({
                  currentLocation: locData,
                  isDetecting: false,
                  detectionError: null,
                });

                resolve(locData);
              } catch (err) {
                const errorMsg = err?.message || "Failed to resolve address coordinates.";
                set({ isDetecting: false, detectionError: errorMsg });
                reject(new Error(errorMsg));
              }
            },
            (geoError) => {
              let errorMsg = "Unable to retrieve your location.";
              if (geoError.code === 1) {
                errorMsg = "Location permission denied. Please allow location access in your browser settings.";
              } else if (geoError.code === 2) {
                errorMsg = "Location unavailable. Please check your GPS or internet connection.";
              } else if (geoError.code === 3) {
                errorMsg = "Location request timed out. Please try again.";
              }
              set({ isDetecting: false, detectionError: errorMsg });
              reject(new Error(errorMsg));
            },
            options
          );
        });
      },
    }),
    {
      name: "user-location-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        currentLocation: state.currentLocation,
      }),
    }
  )
);

export default useLocationStore;
