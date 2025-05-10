<template>
  <div>
    <h1>Crowdfunding Platform</h1>
    <div v-if="!walletAddress">
      <button @click="connectWallet">Connect Wallet</button>
    </div>
    <div v-else>
      <p>Connected: {{ walletAddress }}</p>
      <hr/>
      <CreateProjectForm @projectCreated="fetchProjects"/>
      <hr/>
      <h2>All Projects</h2>
      <button @click="sortProjectsByAge">{{ sortAscending ? 'Sort Newest First' : 'Sort Oldest First' }}</button>
      <div v-if="loadingProjects">Loading projects...</div>
      <div v-else>
        <ProjectCard
            v-for="project in sortedProjects"
            :key="project.id"
            :project-data="project"
            @invest="handleInvest"
            @claim="handleClaim"
            @trigger-fail="handleTriggerFail"
            @claim-refund="handleClaimRefund"
        />
      </div>
      <hr/>
      <h2>My Investments</h2>
      <div v-if="loadingMyInvestments">Loading my investments...</div>
      <div v-else-if="myInvestedProjects.length === 0 && walletAddress">No investments found.</div>
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
      <hr/>
      <h2>Unsuccessful Completed Projects</h2>
      <div v-if="loadingUnsuccessful">Loading unsuccessful projects...</div>
      <div v-else-if="unsuccessfulProjects.length === 0">No unsuccessful projects found.</div>
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
</template>

<script setup>
import {ref, onMounted, computed} from 'vue';
import ethService from '../services/ethereumService.js'
import CreateProjectForm from '../components/CreateProjectForm.vue'
import ProjectCard from '../components/ProjectCard.vue'

const walletAddress = ref(null);
const allProjects = ref([]);
const loadingProjects = ref(false);
const loadingMyInvestments = ref(false);
const loadingUnsuccessful = ref(false);
const sortAscending = ref(true); // true = oldest first

const connectWallet = async () => {
  try {
    await ethService.initProvider(); // Toto by mělo požádat o připojení, pokud je třeba
    walletAddress.value = await ethService.getCurrentWalletAddress();
    if (walletAddress.value) {
      fetchProjects();
      fetchMyInvestments();
    }
  } catch (error) {
    console.error("Failed to connect wallet:", error);
    alert("Failed to connect wallet. Make sure MetaMask is installed and unlocked.");
  }
};

const fetchProjects = async () => {
  if (!walletAddress.value && !ethService.hasReadOnlyProvider()) { // Přidejte si metodu hasReadOnlyProvider do ethService
    console.log("Cannot fetch projects, no provider.");
    // Můžete se pokusit inicializovat read-only provider zde, pokud je to žádoucí
    // await ethService.initProvider(); // pokud initProvider umí fallback na Alchemy
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
    console.error('Failed to fetch projects:', error);
    alert('Failed to fetch projects. See console for details.');
  } finally {
    loadingProjects.value = false;
  }
};

const fetchMyInvestments = async () => {
  if (!walletAddress.value) return;
  loadingMyInvestments.value = true;
  // Pro 'My Investments' projdeme všechny projekty a zkontrolujeme naši investici
  // Efektivnější by bylo mít v kontraktu funkci, která vrátí projekty, do kterých uživatel investoval,
  // nebo poslouchat eventy a ukládat si je lokálně.
  // Pro jednoduchost teď znovu projdeme allProjects nebo je znovu načteme, pokud je to potřeba.
  if (allProjects.value.length === 0) {
    await fetchProjects(); // Ujistíme se, že máme data
  }
  // Filtrování se provede v computed property `myInvestedProjects`
  loadingMyInvestments.value = false;
};


const sortedProjects = computed(() => {
  // Filtrujeme pouze nedokončené projekty
  const unfinished = allProjects.value.filter(p => !p.closed && p.deadline * 1000 > Date.now());
  return [...unfinished].sort((a, b) => {
    // Předpokládáme, že ID projektu roste s časem (novější projekty mají vyšší ID)
    // Nebo pokud máte creationTimestamp, použijte ten. Náš kontrakt nemá explicitní creationTimestamp,
    // ale ID implicitně slouží tomuto účelu.
    return sortAscending.value ? a.id - b.id : b.id - a.id;
  });
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
    alert('Investment successful!');
    fetchProjects(); // Refresh project list
    fetchMyInvestments();
  } catch (error) {
    console.error('Investment failed:', error);
    alert(`Investment failed: ${error.message || error?.data?.message || error}`);
  }
};

const handleClaim = async (projectId) => {
  try {
    await ethService.claimProjectFunds(projectId);
    alert('Funds claimed successfully!');
    fetchProjects();
  } catch (error) {
    console.error('Claiming funds failed:', error);
    alert(`Claiming funds failed: ${error.message || error?.data?.message || error}`);
  }
};

const handleTriggerFail = async (projectId) => {
  try {
    await ethService.triggerFailProject(projectId);
    alert('Project marked as failed, refunds can be claimed.');
    fetchProjects();
  } catch (error) {
    console.error('Triggering project fail failed:', error);
    alert(`Triggering project fail failed: ${error.message || error?.data?.message || error}`);
  }
};

const handleClaimRefund = async (projectId) => {
  try {
    await ethService.claimRefundForProject(projectId);
    alert('Refund claimed successfully!');
    fetchProjects();
    fetchMyInvestments(); // Aktualizovat i moje investice (částka by měla být 0)
  } catch (error) {
    console.error('Claiming refund failed:', error);
    alert(`Claiming refund failed: ${error.message || error?.data?.message || error}`);
  }
};

onMounted(async () => {
  // Zkusit se připojit automaticky, pokud už byla peněženka dříve povolena
  if (window.ethereum && window.ethereum.selectedAddress) {
    await connectWallet();
  } else {
    // Pokud není peněženka připojena, můžeme stále načíst projekty přes Alchemy (read-only)
    // To vyžaduje, aby initProvider() v ethService.js uměl nastavit read-only providera,
    // pokud MetaMask není dostupný nebo povolen.
    try {
      await ethService.initProvider(); // Inicializuje Alchemy providera, pokud není MetaMask
      fetchProjects(); // Načte projekty pomocí Alchemy
    } catch (e) {
      console.warn("Could not initialize read-only provider automatically.", e)
    }
  }
  // Poslouchání změn účtu v MetaMask
  if (window.ethereum) {
    window.ethereum.on('accountsChanged', async (accounts) => {
      if (accounts.length > 0) {
        walletAddress.value = accounts[0];
        await ethService.initProvider(); // Re-inicializuj providera s novým účtem
        fetchProjects();
        fetchMyInvestments();
      } else {
        walletAddress.value = null;
        allProjects.value = []; // Vyčistit projekty, pokud se uživatel odpojí
        // Můžete se pokusit znovu načíst přes Alchemy, pokud chcete
      }
    });
    window.ethereum.on('chainChanged', () => {
      window.location.reload(); // Jednoduchý způsob, jak se vypořádat se změnou sítě
    });
  }
});

// Pomocné funkce pro konverzi BigInt na ETH string pro zobrazení
const formatEth = (weiValue) => {
  if (typeof weiValue === 'undefined' || weiValue === null) return '0';
  return ethService.formatEther(weiValue);
};

</script>

<style>
/* Přidejte si nějaké základní styly */
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