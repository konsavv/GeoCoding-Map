<template>
  <div class="h-screen relative">
    <GeoErrorModal
      v-if="geoError"
      :geoErrorMessage="geoErrorMessage"
      @closeGeoError="closeGeoError"
    />
    <MapFeature
      :coords="coords"
      :fetchCoords="fetchCoords"
      @getGeolocation="getGeolocation"
      @plotResult="plotResult"
      @openSearchResults="openSearchResults"
      :searchResults="searchResults"
      @removeResult="removeResult"
      :routeInfo="routeInfo"
      @getDirections="getDirections"
      @searchNearby="searchNearby"
    />
    <div id="map" class="h-full z-[1]"></div>
    <!-- Map style switcher -->
    <div
      class="absolute bottom-[26px] left-[10px] z-[2] flex rounded-md overflow-hidden shadow-md text-xs"
    >
      <button
        v-for="style in mapStyles"
        :key="style.id"
        @click="changeMapStyle(style.id)"
        class="px-3 py-2 transition-colors"
        :class="
          mapStyle === style.id
            ? 'bg-slate-600 text-white'
            : 'bg-white text-slate-700 hover:bg-slate-100'
        "
      >
        {{ style.label }}
      </button>
    </div>
  </div>
</template>

<script>
import leaflet from "leaflet";
import { onMounted, ref } from "vue";
import axios from "axios";
import GeoErrorModal from "@/components/GeoErrorModal.vue";
import MapFeature from "@/components/MapFeature.vue";
export default {
  name: "HomeView",
  components: { GeoErrorModal, MapFeature },
  setup() {
    let map;
    //currently applied tile layer, kept so we can swap it on style change
    let currentTileLayer;
    //available map styles for the switcher
    const mapStyles = [
      { id: "mapbox/streets-v11", label: "Streets" },
      { id: "mapbox/satellite-streets-v12", label: "Satellite" },
      { id: "mapbox/dark-v11", label: "Dark" },
    ];
    const mapStyle = ref(mapStyles[0].id);

    const applyMapStyle = (styleId) => {
      if (currentTileLayer) {
        map.removeLayer(currentTileLayer);
      }
      currentTileLayer = leaflet
        .tileLayer(
          `https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token=${process.env.VUE_APP_API_KEY}`,
          {
            accessToken: process.env.VUE_APP_API_KEY,
            maxZoom: 18,
            id: styleId,
            tileSize: 512,
            zoomOffset: -1,
            attribution:
              '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          }
        )
        .addTo(map);
      mapStyle.value = styleId;
    };

    const changeMapStyle = (styleId) => {
      if (styleId !== mapStyle.value) {
        applyMapStyle(styleId);
      }
    };

    onMounted(() => {
      //init map
      map = leaflet.map("map").setView([28.538336, -81.379234], 10);

      //add the default tile layer
      applyMapStyle(mapStyle.value);

      map.on("moveend", () => {
        closeSearchResults();
      });

      getGeolocation();
    });
    //store user coordinates
    const coords = ref(null);
    //display loading animation between the time we start fetching the chords and by the time we finish and we have the chords
    const fetchCoords = ref(null);
    //store the marker
    const geoMarker = ref(null);
    const geoError = ref(null);
    const geoErrorMessage = ref(null);

    const getGeolocation = () => {
      if (coords.value) {
        coords.value = null;
        sessionStorage.removeItem("coords");
        map.removeLayer(geoMarker.value);
        return;
      }
      //check session storage for coords
      if (sessionStorage.getItem("coords")) {
        coords.value = JSON.parse(sessionStorage.getItem("coords"));
        plotGeolocation(coords.value);
        return;
      }
      fetchCoords.value = true;
      navigator.geolocation.getCurrentPosition(setCoords, getLocError);
    };

    const setCoords = (position) => {
      //stop fetching coords
      fetchCoords.value = null;

      //set coords in session storage
      const setSessionCoords = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };

      sessionStorage.setItem("coords", JSON.stringify(setSessionCoords));

      //Set ref coords value
      coords.value = setSessionCoords;

      //plot the user's location on leaflet
      plotGeolocation(coords.value);
    };

    const getLocError = (err) => {
      fetchCoords.value = null;
      geoError.value = true;
      geoErrorMessage.value = err.message;
    };

    const plotGeolocation = (coords) => {
      //create custom marker
      const customMarker = leaflet.icon({
        iconUrl: require("../assets/map-marker-red.svg"),
        iconSize: [35, 35],
      });
      //create new marker with coords and custom icon
      geoMarker.value = leaflet
        .marker([coords.lat, coords.lng], {
          icon: customMarker,
        })
        .addTo(map);

      //set map view to current location
      map.setView([coords.lat, coords.lng], 10);
    };

    const closeGeoError = () => {
      geoError.value = null;
      geoErrorMessage.value = null;
    };
    const resultMarker = ref(null);
    //directions state
    let routeLayer;
    let lastDestination = null;
    const routeInfo = ref(null);

    const clearRoute = () => {
      if (routeLayer) {
        map.removeLayer(routeLayer);
        routeLayer = null;
      }
      routeInfo.value = null;
    };

    const plotResult = (coords) => {
      //Check to see if resultMarker has value
      if (resultMarker.value) {
        map.removeLayer(resultMarker.value);
      }
      //a new destination clears any previous route
      clearRoute();
      lastDestination = coords.coordinates;
      //create custom marker
      const customMarker = leaflet.icon({
        iconUrl: require("../assets/map-marker-blue.svg"),
        iconSize: [35, 35],
      });
      //create new marker with coords and custom icon
      resultMarker.value = leaflet
        .marker([coords.coordinates[1], coords.coordinates[0]], {
          icon: customMarker,
        })
        .addTo(map);

      //set map view to current location
      map.setView([coords.coordinates[1], coords.coordinates[0]], 14);
      closeSearchResults();
    };

    //fetch + draw a route to the selected result. origin (a typed start
    //point [lng, lat]) wins; otherwise fall back to the user's location.
    const getDirections = async (profile = "driving", origin = null) => {
      if (!lastDestination) return;
      const start =
        origin || (coords.value ? [coords.value.lng, coords.value.lat] : null);
      if (!start) {
        routeInfo.value = {
          error: "Type a start point, or enable your location (arrow button).",
        };
        return;
      }
      try {
        const originStr = `${start[0]},${start[1]}`;
        const dest = `${lastDestination[0]},${lastDestination[1]}`;
        const { data } = await axios.get(
          `http://localhost:3000/api/directions/${originStr};${dest}?profile=${profile}`
        );
        if (!data.routes || !data.routes.length) {
          routeInfo.value = { error: "No route found." };
          return;
        }
        const route = data.routes[0];
        if (routeLayer) map.removeLayer(routeLayer);
        const line = leaflet.geoJSON(route.geometry, {
          style: { color: "#2563eb", weight: 5, opacity: 0.8 },
        });
        //green dot marks the start of the route
        const startMarker = leaflet.circleMarker([start[1], start[0]], {
          radius: 7,
          color: "#fff",
          weight: 2,
          fillColor: "#16a34a",
          fillOpacity: 1,
        });
        routeLayer = leaflet.featureGroup([line, startMarker]).addTo(map);
        map.fitBounds(routeLayer.getBounds(), { padding: [60, 60] });
        routeInfo.value = {
          distance: route.distance,
          duration: route.duration,
          profile,
        };
      } catch (err) {
        routeInfo.value = { error: "Could not get directions." };
      }
    };

    //find nearby POIs of a category around the user's location (or map center)
    let poiLayer;
    const searchNearby = async (category) => {
      const center = coords.value || {
        lng: map.getCenter().lng,
        lat: map.getCenter().lat,
      };
      try {
        const { data } = await axios.get(
          `http://localhost:3000/api/nearby/${category}?proximity=${center.lng},${center.lat}`
        );
        if (poiLayer) map.removeLayer(poiLayer);
        if (!data.features || !data.features.length) return;
        poiLayer = leaflet.featureGroup();
        data.features.forEach((poi) => {
          const [lng, lat] = poi.geometry.coordinates;
          leaflet
            .circleMarker([lat, lng], {
              radius: 7,
              color: "#fff",
              weight: 2,
              fillColor: "#f59e0b",
              fillOpacity: 1,
            })
            .bindPopup(poi.properties.name)
            .addTo(poiLayer);
        });
        poiLayer.addTo(map);
        map.fitBounds(poiLayer.getBounds(), { padding: [60, 60] });
      } catch (err) {
        // silently ignore nearby-search errors
      }
    };

    const searchResults = ref(null);
    const openSearchResults = () => {
      searchResults.value = true;
    };

    const closeSearchResults = () => {
      searchResults.value = null;
    };

    const removeResult = () => {
      if (resultMarker.value) {
        map.removeLayer(resultMarker.value);
        resultMarker.value = null;
      }
      clearRoute();
    };

    return {
      coords,
      fetchCoords,
      geoMarker,
      geoError,
      geoErrorMessage,
      closeGeoError,
      getGeolocation,
      plotResult,
      searchResults,
      openSearchResults,
      closeSearchResults,
      removeResult,
      mapStyle,
      mapStyles,
      changeMapStyle,
      routeInfo,
      getDirections,
      searchNearby,
    };
  },
};
</script>
