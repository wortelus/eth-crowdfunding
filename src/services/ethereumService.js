// pro Alchemy API
import {ethers} from 'ethers';
// SDK přímo pro Alchemy
// import { Network, Alchemy } from "alchemy-sdk";
import {contractABI, contractAddress, alchemyApiKey} from './const';

let provider;
let signer;
let crowdFundContract;

// 1/2 z hlavních funkcí
// inicializace providera - MetaMask (read-write) s fallbackem na Alchemy (read-only)
const initProvider = async () => {
    // window.ethereum je injected do browseru, zda je metamask dostupný
    if (window.ethereum) {
        // První pokus -> MetaMask, pokud je dostupný
        provider = new ethers.BrowserProvider(window.ethereum);
        try {
            // Požádáme o přístup k účtu, pokud ještě nebyl udělen
            // Tento krok je nutný pro získání signer-a a interakci s peněženkou
            await provider.send("eth_requestAccounts", []);
            signer = await provider.getSigner();
            crowdFundContract = new ethers.Contract(contractAddress, contractABI, signer);
            console.log("MetaMask initProvider dokončen úspěšně a kontrakt nastaven.");
        } catch (error) {
            console.error("Došlo k chybě během komunikace s MM providerem. " +
                "Uživatel odmítl přístup k účtu MetaMask nebo není dostupný, " +
                "zkoušíme Alchemy provider.");

            // fallback na Alchemy providera (read-only, pokud uživatel nepovolí MetaMask)
            provider = new ethers.JsonRpcProvider(`https://eth-sepolia.g.alchemy.com/${alchemyApiKey}`);
            // const settings = {
            //     apiKey: alchemyApiKey,
            //     network: Network.ETH_SEPOLIA,
            // };
            // const alchemy = new Alchemy(settings);
            crowdFundContract = new ethers.Contract(contractAddress, contractABI, provider);

            console.log("Alchemy provider nastaven úspěšně (read-only).");
        }
    } else {
        // Pokud MetaMask není k dispozici, použijeme Alchemy jako výchozí (read-only)
        console.log('MetaMask not detected. Using Alchemy provider (read-only).');
        provider = new ethers.JsonRpcProvider(`https://eth-sepolia.g.alchemy.com/${alchemyApiKey}`);
        crowdFundContract = new ethers.Contract(contractAddress, contractABI, provider);
    }
    return {provider, signer, crowdFundContract};
};

// 2/2 z hlavních funkcí
const getSignerAndContract = async () => {
    if (!signer || !crowdFundContract || !crowdFundContract.runner || crowdFundContract.runner.constructor.name !== 'Signer') {
        // Pokud signer není nastaven nebo kontrakt není připojen k signeru, pokusíme se znovu inicializovat s MetaMaskem
        if (window.ethereum) {
            provider = new ethers.BrowserProvider(window.ethereum);
            try {
                await provider.send("eth_requestAccounts", []);
                signer = await provider.getSigner();
                crowdFundContract = new ethers.Contract(contractAddress, contractABI, signer);
            } catch (error) {
                console.error("Failed to get signer:", error);
                throw new Error("MetaMask connection required for this action.");
            }
        } else {
            throw new Error("MetaMask is not available.");
        }
    }
    return {signer, crowdFundContractWithSigner: crowdFundContract};
};


//
// funkce pro interakci s kontraktem
//

async function createProject(name, description, goalAmountInEth, durationInSeconds) {
    const {crowdFundContractWithSigner} = await getSignerAndContract();

    const goalAmountWei = ethers.parseEther(goalAmountInEth.toString());
    console.log("tvorba následujícího projektu:", name, description, goalAmountWei, BigInt(durationInSeconds));

    try {
        const tx = await crowdFundContractWithSigner.createProject(
            name,
            description,
            goalAmountWei,
            BigInt(durationInSeconds)
        );
        await tx.wait(); // Počkat na potvrzení transakce
        console.log('SUCCESS: projekt vytvořen:', tx);
        return tx;
    } catch (error) {
        console.error('chyba při vytváření projektu:', error);
        throw error;
    }
}

async function contributeToProject(projectId, amountInEth) {
    const {crowdFundContractWithSigner} = await getSignerAndContract();

    const amountWei = ethers.parseEther(amountInEth.toString());

    try {
        const tx = await crowdFundContractWithSigner.contribute(projectId, {value: amountWei});
        await tx.wait();
        console.log('SUCCESS: přispění k projektu:', tx);
        return tx;
    } catch (error) {
        console.error('chyba při přispění k projektu:', error);
        throw error;
    }
}

async function claimProjectFunds(projectId) {
    const {crowdFundContractWithSigner} = await getSignerAndContract();

    try {
        const tx = await crowdFundContractWithSigner.claimFunds(projectId);
        await tx.wait();
        console.log('SUCCESS: převzetí prostředků projektu:', tx);
        return tx;
    } catch (error) {
        console.error('chyba při převzetí prostředků projektu:', error);
        throw error;
    }
}

async function triggerFailProject(projectId) {
    const {crowdFundContractWithSigner} = await getSignerAndContract();

    try {
        const tx = await crowdFundContractWithSigner.failProjectAfterDeadline(projectId);
        await tx.wait();
        console.log('Selhání projektu vytriggerováno:', tx);
        return tx;
    } catch (error) {
        console.error('chyba při triggerování selhání projektu:', error);
        throw error;
    }
}

async function claimRefundForProject(projectId) {
    const {crowdFundContractWithSigner} = await getSignerAndContract();
    try {
        const tx = await crowdFundContractWithSigner.claimRefund(projectId);
        await tx.wait();
        console.log('Refund claimed:', tx);
        return tx;
    } catch (error) {
        console.error('Error claiming refund:', error);
        throw error;
    }
}


//
// read only funkce
//

async function getProjectDetails(projectId) {
    if (!crowdFundContract) await initProvider(); // zajistí inicializaci, pokud ještě neproběhla
    try {
        const details = await crowdFundContract.getProjectDetails(projectId);

        // ethers.js v6 vrací výsledky jako pole/objekt s pojmenovanými i indexovanými klíči
        // vrátíme to jako objekt s pojmenovanými klíči
        return {
            creator: details[0],
            name: details[1],
            description: details[2],
            goalAmount: details[3], // BigInt
            deadline: details[4],   // BigInt (timestamp)
            currentAmount: details[5], // BigInt
            fundingGoalReached: details[6],
            closed: details[7]
        };
    } catch (error) {
        console.error(`chyba při získávání údajů pro projekt ${projectId}:`, error);
        throw error;
    }
}

async function getAllProjectIds() {
    if (!crowdFundContract) await initProvider();
    try {
        const ids = await crowdFundContract.getAllProjectIds();
        return ids.map(id => Number(id)); // konverze BigInt na Number
    } catch (error) {
        console.error("chyba při získávání všech ID projektů:", error);
        throw error;
    }
}

async function getMyContribution(projectId, userAddress) {
    if (!crowdFundContract) await initProvider();
    if (!userAddress) {
        const currentSigner = await provider.getSigner();
        userAddress = await currentSigner.getAddress();
    }
    try {
        return await crowdFundContract.getContribution(projectId, userAddress); // BigInt
    } catch (error) {
        console.error(`chyba při získávání příspěvku pro projekt ${projectId} od uživatele ${userAddress}:`, error);
        throw error;
    }
}

async function getCurrentWalletAddress() {
    if (window.ethereum) {
        // zajistí, že provider je inicializován
        if (!provider) await initProvider();
        if (!signer) return null;
        const currentSigner = await provider.getSigner(); // get current signer
        if (currentSigner) {
            return await currentSigner.getAddress();
        }
    }

    console.error("MetaMask nebo jiný Ethereum provider není dostupný.");
    return null; // pokud MetaMask není dostupný nebo není připojen účet
}

function getContractInstance() {
    if (!crowdFundContract) {
        console.error("Kontrakt není inicializován.");
        return null;
    }
    return crowdFundContract;
}

function hasReadOnlyProvider() {
    return provider !== null && signer === undefined;
}


export default {
    initProvider,

    // možná není třeba -> volá se interně
    getSignerAndContract,

    createProject,
    contributeToProject,
    claimProjectFunds,
    triggerFailProject,
    claimRefundForProject,
    getProjectDetails,
    getAllProjectIds,
    getMyContribution,
    getCurrentWalletAddress,
    hasReadOnlyProvider,
    getContractInstance,

    // helper functions
    formatEther: ethers.formatEther,
    parseEther: ethers.parseEther,
};