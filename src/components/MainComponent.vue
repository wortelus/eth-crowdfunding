<template>
  <div>
    <div v-if="!walletAddress">
      <button class="btn btn-success" @click="connectWallet">Připojit peněženku</button>
    </div>
    <div v-else>
      <EthAvatar :address="walletAddress" :diameter="40"></EthAvatar>
      <span class="mx-2">Aktuálně připojená peněženka: {{ walletAddress }}</span>
      <button class="btn btn-success" @click="connectWallet">Znovu připojit peněženku</button>
    </div>
    <div>
      <hr/>
      <CreateProjectForm @projectCreated="fetchProjects"/>
      <hr/>
      <div class="row mt-4">
        <div class="col-3">
          <h2>Ongoing projekty</h2>
          <div v-if="loadingProjects">načítání projektů...</div>
          <div v-else>
            <ProjectCard
                v-for="project in ongoingProjects"
                :key="project.id"
                :project-data="project"
                @invest="handleInvest"
                @claim="handleClaim"
                @trigger-fail="handleTriggerFail"
                @claim-refund="handleClaimRefund"
            />
          </div>
        </div>
        <div class="col-3">
          <h2>Mé investice</h2>
          <div v-if="loadingMyInvestments">načítání investic...</div>
          <div v-else-if="ownProjects.length === 0 && walletAddress">Žádné investice.</div>
          <div v-else>
            <ProjectCard
                v-for="project in ownProjects"
                :key="project.id + '-own'"
                :project-data="project"
                @invest="handleInvest"
                @claim="handleClaim"
                @trigger-fail="handleTriggerFail"
                @claim-refund="handleClaimRefund"
            />
          </div>
        </div>
        <div class="col-3">
          <h2>Aktivní investice</h2>
          <div v-if="loadingMyInvestments">načítání investic...</div>
          <div v-else-if="myInvestedProjects.length === 0 && walletAddress">Žádné aktivní investice.</div>
          <div v-else>
            <ProjectCard
                v-for="project in myInvestedProjects"
                :key="project.id + '-invested'"
                :project-data="project"
                @invest="handleInvest"
                @claim="handleClaim"
                @trigger-fail="handleTriggerFail"
                @claim-refund="handleClaimRefund"
            />
          </div>
        </div>
        <div class="col-3">
          <h2>Neúspěšné projekty</h2>
          <div v-if="loadingUnsuccessful">načítání neuspěšných projektů...</div>
          <div v-else-if="unsuccessfulProjects.length === 0">Nic neuspěšného nebylo zatím nalezeno :)</div>
          <div v-else>
            <ProjectCard
                v-for="project in unsuccessfulProjects"
                :key="project.id + '-unsuccessful'"
                :project-data="project"
                @claim-refund="handleClaimRefund"
            />
          </div>
        </div>
      </div>
      <hr/>
      <div class="row mt-2">
        <div class="col-12">
          <h2>Všechny projekty</h2>
          <button :class="['btn', sortAscending ? 'btn-primary' : 'btn-secondary']"
              @click="sortProjectsByAge">{{ sortAscending ? 'Od nejnovějšího' : 'Od nejstaršího' }}</button>
          <div v-if="loadingProjects">načítání projektů...</div>
          <div v-else-if="allProjectsSorted.length === 0">Žádné projekty.</div>
          <div v-else>
            <ProjectCard
                v-for="project in allProjectsSorted"
                :key="project.id + '-all'"
                :project-data="project"
                @invest="handleInvest"
                @claim="handleClaim"
                @trigger-fail="handleTriggerFail"
                @claim-refund="handleClaimRefund"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import {ref, onMounted, onUnmounted, computed} from 'vue';
import ethService from '../services/ethereumService.js'
import CreateProjectForm from '../components/CreateProjectForm.vue'
import ProjectCard from '../components/ProjectCard.vue'
import EthAvatar from "@/components/EthAvatar.vue";
import {cleanupEventListeners, initializeEventListeners} from "@/assets/listeners.js";

const walletAddress = ref(null);
const allProjects = ref([]);
const loadingProjects = ref(false);
const loadingMyInvestments = ref(false);
const loadingUnsuccessful = ref(false);
const sortAscending = ref(true); // true = nejstarší nahoře

// Připojení peněženky
const connectWallet = async () => {
  try {
    // hlavní inicializační funkce
    // pokud je třeba, připojí se
    await ethService.initProvider();
    walletAddress.value = await ethService.getCurrentWalletAddress();

    if (walletAddress.value) {
      fetchProjects();
      fetchMyInvestments();
    }

  } catch (error) {
    console.error("Selhání při připojování peněženky:", error);
    alert("Selhání při připojování peněženky. Zkontrolujte konzoli pro více informací.");
  }
};

const fetchProjects = async () => {
  if (!walletAddress.value && !ethService.hasReadOnlyProvider()) {
    console.log("Nemohu fetchnout projekty, protože nemám peněženku a ani read-only providera.");
    return;
  }
  loadingProjects.value = true;
  try {
    const projectIds = await ethService.getAllProjectIds();
    const projectPromises = projectIds.map(async (id) => {
      const details = await ethService.getProjectDetails(id);
      const myContribution = walletAddress.value ? await ethService.getMyContribution(id, walletAddress.value) : ethService.parseEther("0");
      return {
        id,
        creator: details.creator,
        name: details.name,
        description: details.description,
        goalAmount: details.goalAmount, // BigInt
        deadline: Number(details.deadline), // Unix timestamp (BigInt to Number)
        currentAmount: details.currentAmount, // BigInt
        fundingGoalReached: details.fundingGoalReached,
        closed: details.closed,
        myContribution: myContribution // BigInt
      };
    });
    allProjects.value = await Promise.all(projectPromises);
  } catch (error) {
    console.error('chyba při načítání projektů:', error);
    alert('Selhalo načítání projektů: ' + (error.message || error?.data?.message || error));
  } finally {
    loadingProjects.value = false;
  }
};

const fetchMyInvestments = async () => {
  // tohle asi není třeba
  // if (!walletAddress.value) return;
  // loadingMyInvestments.value = true;
  // if (allProjects.value.length === 0) {
  //   await fetchProjects();
  // }
  // loadingMyInvestments.value = false;
};

const allProjectsSorted = computed(() => {
  const projectsCopy = [...allProjects.value];

  if (sortAscending.value) {
    return projectsCopy.sort((a, b) => a.deadline - b.deadline); // Řadíme podle deadlinu, od nejstaršího
  } else {
    return projectsCopy.sort((a, b) => b.deadline - a.deadline); // Řadíme podle deadlinu, od nejnovějšího
  }
});

const ongoingProjects = computed(() => {
  // pouze nedokončené projekty
  return allProjects.value.filter(p => !p.closed && p.deadline * 1000 > Date.now());
});

const ownProjects = computed(() => {
  if (!walletAddress.value) return [];
  return allProjects.value.filter(p => p.creator && p.creator.toLowerCase() === walletAddress.value.toLowerCase());
});

const myInvestedProjects = computed(() => {
  if (!walletAddress.value) return [];
  return allProjects.value.filter(p => p.myContribution && ethService.formatEther(p.myContribution) > 0);
});

const unsuccessfulProjects = computed(() => {
  const now = Date.now() / 1000; // aktuální čas v sekundách
  return allProjects.value.filter(p => p.closed && !p.fundingGoalReached && p.deadline < now);
});


const sortProjectsByAge = () => {
  sortAscending.value = !sortAscending.value;
};

const handleInvest = async ({projectId, amount}) => {
  try {
    await ethService.contributeToProject(projectId, amount);
    alert('Investice do projektu proběhla úspěšně!');
    // refresh seznam projektů a investic
    fetchProjects();
    fetchMyInvestments();
  } catch (error) {
    console.error('chyba při investici:', error);
    alert(`Investice do projektu selhala: ${error.message || error?.data?.message || error}`);
  }
};

const handleClaim = async (projectId) => {
  try {
    await ethService.claimProjectFunds(projectId);
    alert('Úspěšně jste získali prostředky projektu! Gratuluji!');
    // refresh seznam projektů
    fetchProjects();
  } catch (error) {
    console.error('chyba při získávání prostředků:', error);
    alert(`Získávání prostředků projektu selhalo: ${error.message || error?.data?.message || error}`);
  }
};

const handleTriggerFail = async (projectId) => {
  try {
    await ethService.triggerFailProject(projectId);
    alert('Projekt byl úspěšně označen jako neúspěšný. Všichni investoři mohou nyní požádat o refundaci.');
    // refresh seznam projektů
    fetchProjects();
  } catch (error) {
    console.error('chyba při označování projektu jako neúspěšného:', error);
    alert(`Označování projektu jako neúspěšného selhalo: ${error.message || error?.data?.message || error}`);
  }
};

const handleClaimRefund = async (projectId) => {
  try {
    await ethService.claimRefundForProject(projectId);
    alert('Úspěšně jste získali refundaci za projekt!');
    // refresh seznam projektů a investic
    fetchProjects();
    fetchMyInvestments();
  } catch (error) {
    console.error('chyba při získávání refundace:', error);
    alert(`Získávání refundace projektu selhalo: ${error.message || error?.data?.message || error}`);
  }
};

const handleAccountChanged = async (accounts) => {
  if (accounts.length > 0) {
    console.log("Nový účet připojen:", accounts[0]);
    walletAddress.value = accounts[0];
    await ethService.initProvider(); // Re-inicializuj providera s novým účtem
    fetchProjects();
    fetchMyInvestments();
  } else {
    walletAddress.value = null;
    allProjects.value = [];
    // načíst znovu přes Alchemy
    await ethService.initProvider();
    fetchProjects();
    fetchMyInvestments();
    console.log("Peněženka odpojena.");
  }
};

const handleChainChanged = () => {
  console.log("chainChanged - sit zmenena, obnovuji stránku.");
  window.location.reload();
};

onMounted(async () => {
  // nejdříve se pokusíme připojit k peněžence, pokud je dostupná
  if (window.ethereum && window.ethereum.selectedAddress) {
    await connectWallet();
  } else {
    console.log('MetaMask není připojen, pokusím se inicializovat read-only provider.');
    try {
      await ethService.initProvider(); // Inicializuje Alchemy providera, pokud není MetaMask
      fetchProjects(); // Načte projekty pomocí Alchemy
    } catch (e) {
      console.warn("Could not initialize read-only provider automatically.", e)
    }
  }

  // Poslouchání změn účtu v MetaMask
  if (window.ethereum) {
    window.ethereum.on('accountsChanged', handleAccountChanged);
    window.ethereum.on('chainChanged', handleChainChanged);
  }

  await initializeEventListeners(ethService, fetchProjects);
});

onUnmounted(() => {
  if (window.ethereum) {
    window.ethereum.removeListener('accountsChanged', handleAccountChanged);
    window.ethereum.removeListener('chainChanged', handleChainChanged);
  }
  cleanupEventListeners();
});

// Pomocné funkce pro konverzi BigInt na ETH string pro zobrazení
const formatEth = (weiValue) => {
  if (typeof weiValue === 'undefined' || weiValue === null) return '0';
  return ethService.formatEther(weiValue);
};

</script>

<style>
hr {
  margin: 20px 0;
}

button {
  margin: 5px;
  padding: 8px 12px;
  cursor: pointer;
}

input {
  margin: 5px;
  padding: 8px;
}
</style>