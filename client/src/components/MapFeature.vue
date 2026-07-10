<template>
  <div
    class="w-full md:w-auto absolute md:top-[40px] md:left-[60px] z-[2] flex gap-4 px-6 py-8 md:px-0 md:py-0 bg-transparent"
  >
    <!-- Search -->
    <div class="relative flex-1 md:min-w-[350px]">
      <!-- Input -->
      <input
        class="pl-9 pr-4 py-3 text-sm focus:outline-none w-full shadow-md"
        type="text"
        placeholder="Start your search"
        v-model="searchQuery"
        @input="search"
        @focus="$emit('openSearchResults')"
        @keydown.down.prevent="onArrowDown"
        @keydown.up.prevent="onArrowUp"
        @keydown.enter.prevent="onEnter"
        @keydown.esc="onEsc"
      />
      <!-- Search Icon -->
      <div class="absolute top-0 left-[8px] h-full flex items-center">
        <i class="fas fa-search"></i>
      </div>
      <!-- Search result -->
      <div class="absolute mt-2 w-full">
        <!-- Results -->
        <div
          v-if="searchQuery && searchResults"
          ref="scrollContainer"
          class="h-[200px] overflow-scroll bg-white rounded-md"
        >
          <!-- Loading -->
          <LoadingSpinner v-if="!searchData && !searchError" />
          <p v-else-if="searchError" class="px-4 py-3 text-xs text-red-500">
            {{ searchError }}
          </p>
          <p
            v-else-if="searchData.length === 0"
            class="px-4 py-3 text-xs text-slate-500"
          >
            No results found
          </p>
          <div v-else>
            <div
              class="result-item px-4 py-2 flex gap-x-2 cursor-pointer hover:bg-slate-600 hover:text-white"
              :class="{ 'bg-slate-600 text-white': index === highlightedIndex }"
              v-for="(result, index) in searchData"
              :key="index"
              @click="selectResult(result)"
              @mouseenter="highlightedIndex = index"
            >
              <i class="fas fa-map-marker-alt"></i>
              <p class="text-xs">{{ result.place_name_en }}</p>
            </div>
          </div>
        </div>
        <!-- Selected Search Result -->
        <div
          v-if="selectedResult"
          class="mt-[8px] px-4 py-3 bg-white rounded-md"
        >
          <div class="flex justify-between items-start gap-2">
            <h1 class="text-lg">{{ selectedResult.text }}</h1>
            <i
              @click="removeResult"
              class="far fa-times-circle cursor-pointer shrink-0 mt-1"
            ></i>
          </div>
          <p
            v-if="
              selectedResult.place_name_en &&
              selectedResult.place_name_en !== selectedResult.text
            "
            class="text-xs mb-1"
          >
            {{ selectedResult.place_name_en }}
          </p>
          <p v-if="selectedResult.properties?.category" class="text-xs">
            {{ selectedResult.properties.category }}
          </p>
          <!-- Directions -->
          <div class="mt-3 border-t pt-2">
            <!-- From (start point) -->
            <div class="relative mb-2">
              <input
                v-model="fromQuery"
                @input="searchFrom"
                type="text"
                placeholder="From: your location, or type a start"
                class="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:outline-none"
              />
              <div
                v-if="fromData && fromData.length"
                class="absolute z-10 mt-1 w-full max-h-[120px] overflow-auto bg-white rounded-md shadow-md"
              >
                <div
                  v-for="(f, i) in fromData"
                  :key="i"
                  @click="selectFrom(f)"
                  class="px-2 py-1 text-xs cursor-pointer hover:bg-slate-100"
                >
                  {{ f.place_name_en }}
                </div>
              </div>
            </div>
            <div class="flex gap-2">
              <button
                @click="requestDirections('driving')"
                class="flex items-center gap-1 px-2 py-1 text-xs rounded bg-slate-100 hover:bg-slate-200"
              >
                <i class="fas fa-car"></i> Drive
              </button>
              <button
                @click="requestDirections('walking')"
                class="flex items-center gap-1 px-2 py-1 text-xs rounded bg-slate-100 hover:bg-slate-200"
              >
                <i class="fas fa-person-walking"></i> Walk
              </button>
            </div>
            <p
              v-if="routeInfo && !routeInfo.error"
              class="text-xs mt-2 text-slate-700"
            >
              <i class="fas fa-route"></i>
              {{ (routeInfo.distance / 1000).toFixed(1) }} km ·
              {{ Math.round(routeInfo.duration / 60) }} min
              <span class="text-slate-400">({{ routeInfo.profile }})</span>
            </p>
            <p v-if="routeInfo && routeInfo.error" class="text-xs mt-2 text-red-500">
              {{ routeInfo.error }}
            </p>
          </div>
        </div>
      </div>
      <!-- Nearby category chips -->
      <div class="flex gap-2 mt-2 overflow-x-auto pb-1">
        <button
          v-for="cat in categories"
          :key="cat.query"
          @click="$emit('searchNearby', cat.query)"
          class="whitespace-nowrap px-3 py-1 text-xs rounded-full bg-white shadow-md hover:bg-slate-100"
        >
          {{ cat.label }}
        </button>
      </div>
    </div>

    <!-- Geolocation -->
    <div
      class="px-4 flex items-center shadow-md rounded-md min-h-[45px]"
      :class="{ 'bg-slate-600': coords, 'bg-white': !coords }"
      @click="$emit('getGeolocation')"
    >
      <i
        class="fas fa-location-arrow text-state-600 text-[18px]"
        :class="{ 'text-white': coords, 'animate-pulse': fetchCoords }"
      ></i>
    </div>
  </div>
</template>

<script>
import { ref, nextTick } from "vue";
import axios from "axios";
import LoadingSpinner from "./LoadingSpinner";
export default {
  props: ["coords", "fetchCoords", "searchResults", "routeInfo"],
  components: { LoadingSpinner },
  setup(props, { emit }) {
    //search value that user is typing
    const searchQuery = ref(null);
    //data value from API
    const searchData = ref(null);
    //error message shown when a search request fails
    const searchError = ref(null);
    //set timeout
    const queryTimeout = ref(null);
    //store user selected results
    const selectedResult = ref(null);
    //keyboard-highlighted result index (-1 = none)
    const highlightedIndex = ref(-1);
    //ref to the scrollable results container
    const scrollContainer = ref(null);
    //quick "nearby" categories (label + Mapbox POI query)
    const categories = [
      { label: "☕ Coffee", query: "coffee" },
      { label: "🍽️ Food", query: "restaurant" },
      { label: "🏨 Hotels", query: "hotel" },
      { label: "⛽ Gas", query: "gas_station" },
      { label: "🏧 ATM", query: "atm" },
      { label: "💊 Pharmacy", query: "pharmacy" },
    ];
    //"From" (start point) autocomplete for directions
    const fromQuery = ref("");
    const fromData = ref(null);
    const fromSelected = ref(null);
    const fromTimeout = ref(null);

    const search = () => {
      clearTimeout(queryTimeout.value);
      searchData.value = null;
      searchError.value = null;
      highlightedIndex.value = -1;
      //keep the results dropdown open while typing (e.g. after a prior selection)
      emit("openSearchResults");
      //emptying the search box resets any active selection + map marker
      if (!searchQuery.value) {
        if (selectedResult.value) {
          selectedResult.value = null;
          emit("removeResult");
        }
        return;
      }
      queryTimeout.value = setTimeout(async () => {
        if (searchQuery.value !== "") {
          const params = new URLSearchParams({
            fuzzyMatch: true,
            language: "en",
            limit: 10,
            proximity: props.coords
              ? `${props.coords.lng}, ${props.coords.lat}`
              : "0,0",
          });
          try {
            const getData = await axios.get(
              `http://localhost:3000/api/search/${searchQuery.value}?${params}`
            );
            searchData.value = getData.data.features;
          } catch (err) {
            searchData.value = [];
            searchError.value =
              "Couldn't reach the search service. Please try again.";
          }
        }
      }, 750);
    };

    //debounced geocoding search for the "From" start-point field
    const searchFrom = () => {
      clearTimeout(fromTimeout.value);
      fromData.value = null;
      fromSelected.value = null;
      if (!fromQuery.value) return;
      fromTimeout.value = setTimeout(async () => {
        try {
          const params = new URLSearchParams({
            fuzzyMatch: true,
            language: "en",
            limit: 5,
            proximity: props.coords
              ? `${props.coords.lng},${props.coords.lat}`
              : "0,0",
          });
          const { data } = await axios.get(
            `http://localhost:3000/api/search/${fromQuery.value}?${params}`
          );
          fromData.value = data.features;
        } catch (err) {
          fromData.value = [];
        }
      }, 600);
    };

    //pick a start point from the "From" suggestions
    const selectFrom = (result) => {
      fromSelected.value = {
        name: result.place_name_en,
        center: result.center,
      };
      fromQuery.value = result.place_name_en;
      fromData.value = null;
    };

    //ask the parent for directions; pass the chosen start (or null = my location)
    const requestDirections = (profile) => {
      emit(
        "getDirections",
        profile,
        fromSelected.value ? fromSelected.value.center : null
      );
    };

    const selectResult = (result) => {
      selectedResult.value = result;
      //reflect the chosen place in the input instead of the partial query
      searchQuery.value = result.text;
      emit("plotResult", result.geometry);
    };

    const removeResult = () => {
      selectedResult.value = null;
      //also clear the search box and any stale results
      searchQuery.value = null;
      searchData.value = null;
      fromQuery.value = "";
      fromData.value = null;
      fromSelected.value = null;
      emit("removeResult");
    };

    //scroll the highlighted item into view within the dropdown
    const scrollHighlightedIntoView = () => {
      nextTick(() => {
        const items = scrollContainer.value?.querySelectorAll(".result-item");
        items?.[highlightedIndex.value]?.scrollIntoView({ block: "nearest" });
      });
    };

    //move highlight down (wraps to top)
    const onArrowDown = () => {
      if (!searchData.value || !searchData.value.length) return;
      highlightedIndex.value =
        (highlightedIndex.value + 1) % searchData.value.length;
      scrollHighlightedIntoView();
    };

    //move highlight up (wraps to bottom)
    const onArrowUp = () => {
      if (!searchData.value || !searchData.value.length) return;
      highlightedIndex.value =
        highlightedIndex.value <= 0
          ? searchData.value.length - 1
          : highlightedIndex.value - 1;
      scrollHighlightedIntoView();
    };

    //select the currently highlighted result
    const onEnter = () => {
      const result = searchData.value?.[highlightedIndex.value];
      if (result) selectResult(result);
    };

    //clear the highlight
    const onEsc = () => {
      highlightedIndex.value = -1;
    };

    return {
      searchData,
      searchError,
      searchQuery,
      queryTimeout,
      search,
      selectResult,
      selectedResult,
      removeResult,
      categories,
      fromQuery,
      fromData,
      fromSelected,
      searchFrom,
      selectFrom,
      requestDirections,
      highlightedIndex,
      scrollContainer,
      onArrowDown,
      onArrowUp,
      onEnter,
      onEsc,
    };
  },
};
</script>
