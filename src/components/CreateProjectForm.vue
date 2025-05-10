<template>
  <div class="container mt-4">
    <h3 class="mb-4">Vytvořit nový projekt</h3>
    <form @submit.prevent="submitProject" class="row align-items-center">
      <div class="col-auto mx-2">
        <label for="name" class="form-label mb-0">Název projektu:</label>
        <input type="text" id="name" v-model="name" class="form-control" required/>
      </div>
      <div class="col-auto mx-2">
        <label for="description" class="form-label mb-0">Popis:</label>
        <input type="text" id="description" v-model="description" class="form-control" required/>
      </div>
      <div class="col-auto mx-2">
        <label for="goal" class="form-label mb-0">Cíl (ETH):</label>
        <input type="number" id="goal" v-model.number="goalAmount" step="0.01" min="0.01" class="form-control"
               required/>
      </div>
      <div class="col-auto mx-2">
        <label for="duration" class="form-label mb-0">Délka (min):</label>
        <input type="number" id="duration" v-model.number="durationMinutes" min="1" class="form-control" required/>
      </div>
      <button type="submit" class="btn btn-primary" :disabled="isSubmitting">
        {{ isSubmitting ? 'Vytváření...' : 'Vytvořit projekt' }}
      </button>
    </form>
    <div v-if="error" class="mt-2 text-danger">{{ error }}</div>
  </div>
</template>

<script setup>
import {ref, defineEmits} from 'vue';
import ethService from '../services/ethereumService.js';

const name = ref('');
const description = ref('');
const goalAmount = ref(0.1); // default 0.1 ETH
const durationMinutes = ref(10); // default 10 min
const isSubmitting = ref(false);
const error = ref('');

const emit = defineEmits(['projectCreated']);

const submitProject = async () => {
  // sanity check
  if (!name.value || !description.value || goalAmount.value <= 0 || durationMinutes.value <= 0) {
    error.value = "Please fill all fields correctly.";
    return;
  }

  // fresh stavu formuláře
  isSubmitting.value = true;
  error.value = '';

  try {
    // minuty -> sekundy
    const durationInSeconds = durationMinutes.value * 60;

    // ETH SERVICE - vytvoření projektu
    await ethService.createProject(name.value, description.value, goalAmount.value, durationInSeconds);
    alert('projekt úspěšně vytvořen');

    // vyhození události pro rodičovskou komponentu
    emit('projectCreated');

    // Reset formuláře
    name.value = '';
    description.value = '';
    goalAmount.value = 0.1;
    durationMinutes.value = 10;
  } catch (err) {
    console.error('Failed to create project:', err);
    error.value = `Failed to create project: ${err.message || err?.data?.message || err}`;
    alert(error.value);
  } finally {
    isSubmitting.value = false;
  }
};
</script>