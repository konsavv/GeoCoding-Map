<template>
  <div class="h-screen relative">
    <div id="map" class="h-full z-[1]"></div>
  </div>
</template>

<script>
import leaflet from "leaflet";
import { onMounted, ref } from "vue";
export default {
  name: "HomeView",
  components: {},
  setup() {
    let map;
    onMounted(() => {
      //init map
      map = leaflet.map("map").setView([28.538336, -81.379234], 10);

      //add tile layer
      leaflet
        .tileLayer(
          `https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token=${process.env.VUE_APP_API_KEY}`,
          {
            accessToken: process.env.VUE_APP_API_KEY,
            maxZoom: 18,
            id: "mapbox/streets-v11",
            tileSize: 512,
            zoomOffset: -1,
            attribution:
              '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          }
        )
        .addTo(map);

      getGeolocation();
    });
    //store user coordinates
    const coords = ref(null);
    //display loading animation between the time we start fetching the chords and by the time we finish and we have the chords
    const fetchCoords = ref(null);
    //store the marker
    const geoMarker = ref(null);

    const getGeolocation = () => {
      //check session storage for coords
      if (sessionStorage.geItem("coords")) {
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
      console.log(err);
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
    return { coords, geoMarker };
  },
};
</script>
