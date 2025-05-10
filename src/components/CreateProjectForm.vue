<template>
  <div>
    <h3>Vytvořit nový projekt</h3>
    <form @submit.prevent="submitProject">
      <div>
        <label for="name">Název projektu:</label>
        <input type="text" id="name" v-model="name" required/>
      </div>
      <div>
        <label for="description">Popis:</label>
        <textarea id="description" v-model="description" required></textarea>
      </div>
      <div>
        <label for="goal">Cíl (ETH):</label>
        <input type="number" id="goal" v-model.number="goalAmount" step="0.01" required min="0.01"/>
      </div>
      <div>
        <label for="duration">Délka v minutách:</label>
        <input type="number" id="duration" v-model.number="durationMinutes" required min="1"/>
      </div>
      <button type="submit" :disabled="isSubmitting">
        {{ isSubmitting ? 'vytváření...' : 'Vytvořit projekt' }}
      </button>
      <p v-if="error" style="color: red;">{{ error }}</p>
    </form>
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