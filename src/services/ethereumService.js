import {ethers} from 'ethers';
import {contractABI, contractAddress} from './const';

let provider;
let signer;
let crowdFundContract;

// Inicializace providera - buď přes Alchemy (read-only) nebo MetaMask (read-write)
const initProvider = async () => {
    if (window.ethereum) {
        // Použijeme providera z MetaMask, pokud je dostupný
        provider = new ethers.BrowserProvider(window.ethereum);
        try {
            // Požádáme o přístup k účtu, pokud ještě nebyl udělen
            // Tento krok je nutný pro získání signer-a a interakci s peněženkou
            await provider.send("eth_requestAccounts", []);
            signer = await provider.getSigner();
            crowdFundContract = new ethers.Contract(contractAddress, contractABI, signer);
            console.log("MetaMask provider initialized.");
        } catch (error) {
            console.error("User denied account access or MetaMask not found. Falling back to Alchemy provider (read-only).", error);
            // Fallback na Alchemy providera (read-only, pokud uživatel nepovolí MetaMask)
            provider = new ethers.JsonRpcProvider(`https://eth-sepolia.g.alchemy.com/v2/${alchemyApiKey}`);
            crowdFundContract = new ethers.Contract(contractAddress, contractABI, provider);
            console.log("Alchemy provider initialized (read-only).");
        }
    } else {
        // Pokud MetaMask není k dispozici, použijeme Alchemy jako výchozí (read-only)
        console.log('MetaMask not detected. Using Alchemy provider (read-only).');
        provider = new ethers.JsonRpcProvider(`https://eth-sepolia.g.alchemy.com/v2/${alchemyApiKey}`);
        crowdFundContract = new ethers.Contract(contractAddress, contractABI, provider);
    }
    return {provider, signer, crowdFundContract};
};


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
    console.log("Creating project with:", name, description, goalAmountWei, BigInt(durationInSeconds));

    try {
        const tx = await crowdFundContractWithSigner.createProject(
            name,
            description,
            goalAmountWei,
            BigInt(durationInSeconds)
        );
        await tx.wait(); // Počkat na potvrzení transakce
        console.log('Project created:', tx);
        return tx;
    } catch (error) {
        console.error('Error creating project:', error);
        throw error;
    }
}

async function contributeToProject(projectId, amountInEth) {
    const {crowdFundContractWithSigner} = await getSignerAndContract();

    const amountWei = ethers.parseEther(amountInEth.toString());

    try {
        const tx = await crowdFundContractWithSigner.contribute(projectId, {value: amountWei});
        await tx.wait();
        console.log('Contribution successful:', tx);
        return tx;
    } catch (error) {
        console.error('Error contributing to project:', error);
        throw error;
    }
}

async function claimProjectFunds(projectId) {
    const {crowdFundContractWithSigner} = await getSignerAndContract();

    try {
        const tx = await crowdFundContractWithSigner.claimFunds(projectId);
        await tx.wait();
        console.log('Funds claimed:', tx);
        return tx;
    } catch (error) {
        console.error('Error claiming funds:', error);
        throw error;
    }
}

async function triggerFailProject(projectId) {
    const {crowdFundContractWithSigner} = await getSignerAndContract();

    try {
        const tx = await crowdFundContractWithSigner.failProjectAfterDeadline(projectId);
        await tx.wait();
        console.log('Project failed and refunds enabled:', tx);
        return tx;
    } catch (error) {
        console.error('Error failing project:', error);
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
        // Můžeme to zkonvertovat na čistý objekt pro snazší použití
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
        console.error(`Error fetching details for project ${projectId}:`, error);
        throw error;
    }
}

async function getAllProjectIds() {
    if (!crowdFundContract) await initProvider();
    try {
        const ids = await crowdFundContract.getAllProjectIds();
        return ids.map(id => Number(id)); // konverze BigInt na Number
    } catch (error) {
        console.error("Error fetching all project IDs:", error);
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
        console.error(`Error fetching contribution for project ${projectId}, user ${userAddress}:`, error);
        throw error;
    }
}

async function getCurrentWalletAddress() {
    if (window.ethereum) {
        if (!provider) await initProvider(); // zajistí, že provider je inicializován
        const currentSigner = await provider.getSigner(); // get current signer
        if (currentSigner) {
            return await currentSigner.getAddress();
        }
    }
    return null; // pokud MetaMask není dostupný nebo není připojen účet
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

    // helper functions
    formatEther: ethers.formatEther,
    parseEther: ethers.parseEther,
};