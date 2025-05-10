<template>
  <div>
    <h3>Create New Project</h3>
    <form @submit.prevent="submitProject">
      <div>
        <label for="name">Name:</label>
        <input type="text" id="name" v-model="name" required/>
      </div>
      <div>
        <label for="description">Description:</label>
        <textarea id="description" v-model="description" required></textarea>
      </div>
      <div>
        <label for="goal">Goal (ETH):</label>
        <input type="number" id="goal" v-model.number="goalAmount" step="0.01" required min="0.01"/>
      </div>
      <div>
        <label for="duration">Duration (days):</label>
        <input type="number" id="duration" v-model.number="durationDays" required min="1"/>
      </div>
      <button type="submit" :disabled="isSubmitting">
        {{ isSubmitting ? 'Creating...' : 'Create Project' }}
      </button>
      <p v-if="error" style="color: red;">{{ error }}</p>
    </form>
  </div>
</template>

<script setup>
import {ref, defineEmits} from 'vue';
import ethService from '../services/ethereumService.js'; // Upravte cestu

const name = ref('');
const description = ref('');
const goalAmount = ref(0.1); // default 0.1 ETH
const durationDays = ref(7); // default 7 dní
const isSubmitting = ref(false);
const error = ref('');

const emit = defineEmits(['projectCreated']);

const submitProject = async () => {
  if (!name.value || !description.value || goalAmount.value <= 0 || durationDays.value <= 0) {
    error.value = "Please fill all fields correctly.";
    return;
  }
  isSubmitting.value = true;
  error.value = '';
  try {
    const durationInSeconds = durationDays.value * 24 * 60 * 60;
    await ethService.createProject(name.value, description.value, goalAmount.value, durationInSeconds);
    alert('Project created successfully!');
    emit('projectCreated'); // Informovat rodičovskou komponentu
    // Reset formuláře
    name.value = '';
    description.value = '';
    goalAmount.value = 0.1;
    durationDays.value = 7;
  } catch (err) {
    console.error('Failed to create project:', err);
    error.value = `Failed to create project: ${err.message || err?.data?.message || err}`;
    alert(error.value);
  } finally {
    isSubmitting.value = false;
  }
};
</script>