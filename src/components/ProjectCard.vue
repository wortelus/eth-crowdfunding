<template>
  <div class="project-card">
    <h4>{{ projectData.name }} (ID: {{ projectData.id }})</h4>
    <p><strong>Creator:</strong> {{ projectData.creator }}</p>
    <p><strong>Description:</strong> {{ projectData.description }}</p>
    <p>
      <strong>Goal:</strong> {{ formatEth(projectData.goalAmount) }} ETH
    </p>
    <p>
      <strong>Funded:</strong> {{ formatEth(projectData.currentAmount) }} ETH
      ({{ fundingPercentage.toFixed(2) }}%)
    </p>
    <p><strong>Deadline:</strong> {{ new Date(projectData.deadline * 1000).toLocaleString() }}</p>
    <p v-if="projectData.myContribution && formatEth(projectData.myContribution) > 0">
      <strong>Your Contribution:</strong> {{ formatEth(projectData.myContribution) }} ETH
    </p>
    <p><strong>Status:</strong> {{ projectStatus }}</p>

    <div v-if="!projectData.closed && projectData.deadline * 1000 > Date.now()">
      <input type="number" v-model.number="investAmount" placeholder="ETH to invest" step="0.01" min="0.001"/>
      <button @click="invest" :disabled="isProcessing">Invest</button>
    </div>

    <div
        v-if="isCreator && !projectData.closed && projectData.deadline * 1000 < Date.now() && projectData.fundingGoalReached">
      <button @click="claim" :disabled="isProcessing">Claim Funds</button>
    </div>

    <div v-if="!projectData.closed && projectData.deadline * 1000 < Date.now() && !projectData.fundingGoalReached">
      <button @click="triggerFail" :disabled="isProcessing">Mark as Failed (Enable Refunds)</button>
    </div>

    <div
        v-if="(projectData.closed && !projectData.fundingGoalReached) || (!projectData.closed && projectData.deadline * 1000 < Date.now() && !projectData.fundingGoalReached)">
      <button v-if="canClaimRefund" @click="claimRefund" :disabled="isProcessing">Claim Refund</button>
    </div>

    <p v-if="isProcessing" class="processing-message">Processing transaction...</p>
    <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
  </div>
</template>

<script setup>
import {ref, computed, defineProps, defineEmits, onMounted} from 'vue';
import ethService from '../services/ethereumService.js'; // Upravte cestu

const props = defineProps({
  projectData: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['invest', 'claim', 'trigger-fail', 'claim-refund']);

const investAmount = ref(0.01);
const isProcessing = ref(false);
const errorMessage = ref('');
const currentUserAddress = ref(null);

onMounted(async () => {
  currentUserAddress.value = await ethService.getCurrentWalletAddress();
});

const isCreator = computed(() => {
  return currentUserAddress.value && props.projectData.creator &&
      currentUserAddress.value.toLowerCase() === props.projectData.creator.toLowerCase();
});

const canClaimRefund = computed(() => {
  // Uživatel může nárokovat refundaci, pokud projekt selhal a on přispěl
  return props.projectData.myContribution && ethService.formatEther(props.projectData.myContribution) > 0;
});


const fundingPercentage = computed(() => {
  if (!props.projectData.goalAmount || props.projectData.goalAmount === 0n) return 0;
  // Používáme dělení s BigInt a pak konverzi na Number pro procenta
  const goal = BigInt(props.projectData.goalAmount);
  const current = BigInt(props.projectData.currentAmount);
  if (goal === 0n) return 0;
  return Number((current * 10000n / goal)) / 100; // Násobíme 10000 pro 2 desetinná místa
});

const projectStatus = computed(() => {
  const now = Date.now() / 1000; // aktuální čas v sekundách
  if (props.projectData.closed) {
    return props.projectData.fundingGoalReached ? 'Successfully Funded & Closed' : 'Failed & Closed';
  }
  if (props.projectData.deadline < now) {
    return props.projectData.fundingGoalReached ? 'Funding Goal Met (Awaiting Claim)' : 'Deadline Passed (Not Funded)';
  }
  return 'Ongoing';
});

const invest = async () => {
  if (investAmount.value <= 0) {
    errorMessage.value = "Investment amount must be greater than 0.";
    return;
  }
  isProcessing.value = true;
  errorMessage.value = '';
  try {
    emit('invest', {projectId: props.projectData.id, amount: investAmount.value});
    // Rodičovská komponenta se postará o alert a refresh
    investAmount.value = 0.01; // Reset
  } catch (e) {
    errorMessage.value = e.message || "Investment failed.";
  } finally {
    isProcessing.value = false;
  }
};

const claim = async () => {
  isProcessing.value = true;
  errorMessage.value = '';
  try {
    emit('claim', props.projectData.id);
  } catch (e) {
    errorMessage.value = e.message || "Claiming funds failed.";
  } finally {
    isProcessing.value = false;
  }
};

const triggerFail = async () => {
  isProcessing.value = true;
  errorMessage.value = '';
  try {
    emit('trigger-fail', props.projectData.id);
  } catch (e) {
    errorMessage.value = e.message || "Triggering project fail failed.";
  } finally {
    isProcessing.value = false;
  }
};

const claimRefund = async () => {
  isProcessing.value = true;
  errorMessage.value = '';
  try {
    emit('claim-refund', props.projectData.id);
  } catch (e) {
    errorMessage.value = e.message || "Claiming refund failed.";
  } finally {
    isProcessing.value = false;
  }
};

const formatEth = (weiValue) => {
  if (typeof weiValue === 'undefined' || weiValue === null) return '0';
  return ethService.formatEther(weiValue);
};

</script>

<style scoped>
.project-card {
  border: 1px solid #ccc;
  padding: 15px;
  margin-bottom: 15px;
  border-radius: 8px;
}

.project-card h4 {
  margin-top: 0;
}

.project-card input {
  margin-right: 10px;
}

.processing-message {
  color: orange;
  font-style: italic;
}

.error-message {
  color: red;
}
</style>