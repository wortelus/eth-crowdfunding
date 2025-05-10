<template>
  <div ref="avatarContainer" class="eth-avatar"></div>
</template>

<script setup>
import {ref, onMounted, watch, nextTick} from 'vue';
import jazzicon from 'jazzicon';

const props = defineProps({
  address: {
    type: String,
    required: true
  },
  diameter: {
    type: Number,
    default: 40 // Výchozí velikost
  }
});

const avatarContainer = ref(null);

const generateAvatar = () => {
  if (props.address && avatarContainer.value) {
    avatarContainer.value.innerHTML = '';

    const numericSeed = parseInt(props.address.slice(2, 10), 16);
    const icon = jazzicon(props.diameter, numericSeed);

    avatarContainer.value.appendChild(icon);
  }
};

onMounted(async () => {
  // Počkat na další tick, aby byl avatarContainer určitě dostupný v DOM
  await nextTick();
  generateAvatar();
});

watch(() => [props.address, props.diameter], () => {
  nextTick(() => {
    generateAvatar();
  });
});
</script>

<style scoped>
.eth-avatar {
  display: inline-block;
  border-radius: 50%;
  overflow: hidden;
  vertical-align: middle;
}

.eth-avatar > div {
  /* Jazzicon generuje div obalující SVG */
  /* Aby se SVG správně zarovnalo */
  display: flex;
}
</style>