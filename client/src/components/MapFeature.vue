<template>
  <div
    class="w-full md:w-auto absolute md:top-[40px] md:left-[60px] z-[2] flex gap-4 px-6 py-8 md:px-0 md:py-0 bg-transparent"
  >
    <!-- Geolocation -->
    <div
      class="px-4 bg-white flex items-center shadow-md rounded-md min-h-[45px]"
      :class="{ 'bg-slate-600': coords }"
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
export default {
  props: ["coords", "fetchCoords"],
};
</script>
