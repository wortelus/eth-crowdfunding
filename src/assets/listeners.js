// src/services/listeners.js  (nebo kamkoliv si ho umístíte)

let crowdFundContractInstance = null;
let localEthService = null; // uložíme si referenci na ethService
let localHandleAllFetches = null; // uložíme si referenci na callback

export const initializeEventListeners = async (ethServiceInstance, handleAllFetchesCallback) => {
    if (!ethServiceInstance || !handleAllFetchesCallback) {
        console.error("initializeEventListeners: Chybí ethServiceInstance nebo handleAllFetchesCallback.");
        return;
    }

    localEthService = ethServiceInstance;
    localHandleAllFetches = handleAllFetchesCallback;

    try {
        // získání instance kontraktu
        crowdFundContractInstance = localEthService.getContractInstance();

        if (!crowdFundContractInstance) {
            // pokus o inicializaci, pokud instance stále není dostupná
            console.log("Instance kontraktu není ihned dostupná, pokouším se inicializovat ethService...");
            await localEthService.initProvider(); // Ujistíme se, že je služba inicializována
            crowdFundContractInstance = localEthService.getContractInstance();
        }

        console.log("LISTENERS.JS: Nastavuji posluchače eventů pro kontrakt:", crowdFundContractInstance.target);

        crowdFundContractInstance.on("ProjectCreated", (projectId, creator, name, goalAmount, deadline, eventDetails) => {
            console.log("LISTENERS.JS - EVENT: ProjectCreated zachycen!");
            localHandleAllFetches();
        });

        crowdFundContractInstance.on("ContributionMade", (projectId, contributor, amount, eventDetails) => {
            console.log("LISTENERS.JS - EVENT: ContributionMade zachycen!");
            localHandleAllFetches();
        });

        crowdFundContractInstance.on("FundsClaimed", (projectId, creator, amount, eventDetails) => {
            console.log("LISTENERS.JS - EVENT: FundsClaimed zachycen!");
            localHandleAllFetches();
        });

        crowdFundContractInstance.on("FundsRefunded", (projectId, contributor, amount, eventDetails) => {
            console.log("LISTENERS.JS - EVENT: FundsRefunded zachycen!");
            localHandleAllFetches();
        });

        crowdFundContractInstance.on("ProjectFailed", (projectId, eventDetails) => {
            console.log("LISTENERS.JS - EVENT: ProjectFailed zachycen!");
            localHandleAllFetches();
        });

        console.log("LISTENERS.JS: Posluchače eventů úspěšně nastaveny.");

    } catch (error) {
        console.error("LISTENERS.JS: Chyba při nastavování posluchačů eventů:", error);
    }
};


// odstranění posluchačů eventů
export const cleanupEventListeners = () => {
    if (crowdFundContractInstance) {
        console.log("LISTENERS.JS: Odstraňuji posluchače eventů.");
        // Odstraní všechny listenery pro všechny eventy na této instanci
        crowdFundContractInstance.removeAllListeners();
        // uvolníme reference
        crowdFundContractInstance = null;
        localEthService = null;
        localHandleAllFetches = null;
    } else {
        console.log("LISTENERS.JS: Nebyli žádní posluchači k odstranění nebo instance kontraktu není dostupná.");
    }
};
