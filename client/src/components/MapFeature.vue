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
        @focus="$emit('toggleSearchResults')"
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
          class="h-[200px] overflow-scroll bg-white rounded-md"
        >
          <!-- Loading -->
          <LoadingSpinner v-if="!searchData" />
          <div v-else>
            <div
              class="px-4 py-2 flex gap-x-2 cursor-pointer hover:bg-slate-600 hover:text-white"
              v-for="(result, index) in searchData"
              :key="index"
              @click="selectResult(result)"
            >
              <i class="fas fa-map-marker-alt"></i>
              <p class="text-xs">{{ result.place_name_en }}</p>
            </div>
          </div>
        </div>
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
import { ref } from "vue";
import axios from "axios";
import LoadingSpinner from "./LoadingSpinner";
export default {
  props: ["coords", "fetchCoords", "searchResults"],
  components: { LoadingSpinner },
  setup(props, { emit }) {
    //search value that user is typing
    const searchQuery = ref(null);
    //data value from API
    const searchData = ref(null);
    //set timeout
    const queryTimeout = ref(null);

    const search = () => {
      clearTimeout(queryTimeout.value);
      searchData.value = null;
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
          const getData = await axios.get(
            `http://localhost:3000/api/search/${searchQuery.value}?${params}`
          );
          searchData.value = getData.data.features;
          console.log(searchData.value);
        }
      }, 750);
    };

    const selectResult = (result) => {
      emit("plotResult", result.geometry);
    };

    return { searchData, searchQuery, queryTimeout, search, selectResult };
  },
};
</script>
