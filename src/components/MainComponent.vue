<template>
  <div>
    <div v-if="!walletAddress">
      <button @click="connectWallet">Připojit peněženku</button>
    </div>
    <div v-else>
      <p>Connected: {{ walletAddress }}</p>
      <hr/>
      <CreateProjectForm @projectCreated="fetchProjects"/>
      <hr/>
      <h2>All Projects</h2>
      <button @click="sortProjectsByAge">{{ sortAscending ? 'Od nejnovějšího' : 'Od nejstaršího' }}</button>
      <div v-if="loadingProjects">načítání projektů...</div>
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
      <h2>Moje investice do projektů</h2>
      <div v-if="loadingMyInvestments">načítání investic...</div>
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
      <h2>Neúspěšné dokončené projekty</h2>
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
    // await ethService.initProvider();
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
  // pouze nedokončené projekty
  const unfinished = allProjects.value.filter(p => !p.closed && p.deadline * 1000 > Date.now());
  return [...unfinished].sort((a, b) => {
    // předpokládáme, že id reprezentuje posloupnost vytvoření projektů
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

onMounted(async () => {
  // nejdříve se pokusíme připojit k peněžence, pokud je dostupná
  if (window.ethereum && window.ethereum.selectedAddress) {
    await connectWallet();
  } else {
    // Pokud není peněženka připojena, můžeme stále načíst projekty přes Alchemy (read-only)
    // To vyžaduje, aby initProvider() v ethService.js uměl nastavit read-only providera,
    // pokud MetaMask není dostupný nebo povolen.
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