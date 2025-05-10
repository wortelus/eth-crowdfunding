// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract CrowdFund {
    struct Project {
        address payable creator;

        // detaily projktu
        string name;
        string description;

        // cílová částka v wei
        uint256 goalAmount;
        // současná částka v wei
        uint256 currentAmount;

        // Unix timestamp
        uint256 deadline;

        // dosáhli jsme cílového wei ?
        bool fundingGoalReached;

        // Projekt byl uzavřen (úspěšně nebo neúspěšně)
        bool closed;

        // mapování investorů na částku
        mapping(address => uint256) contributions;

        // pro refundaci
        address[] contributors;
    }

    // Globalni pole pro cely kontrakt
    // pocitadlo projektu
    uint256 public projectCounter;
    // mapping Id -> projekt
    mapping(uint256 => Project) public projects;

    //
    // eventy
    //
    event ProjectCreated(
        uint256 indexed projectId,
        address indexed creator,
        string name,
        uint256 goalAmount,
        uint256 deadline
    );

    event ContributionMade(
        uint256 indexed projectId,
        address indexed contributor,
        uint256 amount
    );
    event FundsClaimed(uint256 indexed projectId, address indexed creator, uint256 amount);
    event FundsRefunded(uint256 indexed projectId, address indexed contributor, uint256 amount);
    event ProjectFailed(uint256 indexed projectId);

    //
    // modifiery pro caste require
    // '_;' je místo, kde se vykoná kód originalní funkce
    modifier onlyProjectCreator(uint256 _projectId) {
        require(msg.sender == projects[_projectId].creator, "Pouze tvurce toto muze volat.");
        _;
    }

    modifier afterDeadline(uint256 _projectId) {
        require(block.timestamp >= projects[_projectId].deadline, "Deadline nebyl jeste dosazen.");
        _;
    }

    modifier beforeDeadline(uint256 _projectId) {
        require(block.timestamp < projects[_projectId].deadline, "Deadline jiz byl dosazen.");
        _;
    }

    modifier projectOpen(uint256 _projectId) {
        require(!projects[_projectId].closed, "Projekt uzavren.");
        _;
    }

    function createProject(
        string memory _name,
        string memory _description,
        uint256 _goalAmountInWei,
        uint256 _durationInSeconds
    ) public {
        require(_goalAmountInWei > 0, "Cil projektu musi byt vyssi nez 0");
        require(_durationInSeconds > 0, "Delka projektu musi byt vetsi nez 0 sekund");

        projectCounter++;
        Project storage newProject = projects[projectCounter];
        newProject.creator = payable(msg.sender);
        newProject.name = _name;
        newProject.description = _description;
        newProject.goalAmount = _goalAmountInWei;
        newProject.deadline = block.timestamp + _durationInSeconds;
        newProject.currentAmount = 0;
        newProject.fundingGoalReached = false;
        newProject.closed = false;

        emit ProjectCreated(
            projectCounter,
            msg.sender,
            _name,
            newProject.goalAmount,
            newProject.deadline
        );
    }

    function contribute(uint256 _projectId) public payable projectOpen(_projectId) beforeDeadline(_projectId) {
        require(msg.value > 0, "Treba je poslat alespon jeden wei...");

        // ziskat projekt z seznamu projektu dle jeho Id (parametr)
        Project storage project = projects[_projectId];

        // pokud je to první příspěvek od tohoto investora, přidej ho do seznamu přispěvatelů
        if (project.contributions[msg.sender] == 0) {
            project.contributors.push(msg.sender);
        }

        // pridat kontribuci pro mapping contribution -> uint256 wei a taky celkova castka ulozena
        project.contributions[msg.sender] += msg.value;
        project.currentAmount += msg.value;

        // pokud tato nova kontribuce presahla goal projektu, nastavme goalReached flag
        if (project.currentAmount >= project.goalAmount) {
            project.fundingGoalReached = true;
        }

        // emit event ContributionMade
        emit ContributionMade(_projectId, msg.sender, msg.value);
    }

    // sklizeni ovoce projektu po dosazeni cile
    function claimFunds(uint256 _projectId) public onlyProjectCreator(_projectId) afterDeadline(_projectId) projectOpen(_projectId) {
        Project storage project = projects[_projectId];

        // dosahl funding cile ?
        require(project.fundingGoalReached, "Funding gol nebyl dosazen.");

        // uzravreme projekt
        project.closed = true;
        uint256 amountToClaim = project.currentAmount;
        // projekt si vynuluje aktualni castku
        project.currentAmount = 0;

        // proslat na creatora projektu (project.creator) ETH
        (bool success, ) = project.creator.call{value: amountToClaim}("");
        require(success, "Failed to send funds to creator.");

        // emit FundsClaimed
        emit FundsClaimed(_projectId, project.creator, amountToClaim);
    }

    // tuto funkci může zavolat kdokoli po deadline, pokud cíl nebyl splněn.
    // kazdy investor si manualně uděla refund
    function failProjectAfterDeadline(uint256 _projectId) public afterDeadline(_projectId) projectOpen(_projectId) {
        Project storage project = projects[_projectId];
        require(!project.fundingGoalReached, "Project reached its goal or was already processed.");
        project.closed = true;
        emit ProjectFailed(_projectId);
        // zde by se dala implementovat logika pro automatické vrácení, ale je komplexní kvůli gas limitům
        // misto toho přidáme funkci claimRefund.
    }

    // funkce pro investory, co chcou sve penize zpet
    function claimRefund(uint256 _projectId) public projectOpen(_projectId) {
        Project storage project = projects[_projectId];
        // refund je možný:
        // 1. projekt je uzavřen (failProjectAfterDeadline) a cíl nebyl dosažen.
        // 2. pokud je po deadline a cíl nebyl dosažen (pokud failProjectAfterDeadline ještě nebyla zavolána).
        require(!project.fundingGoalReached, "Projekt dosahnul sveho cile, nemuze byt refunded");
        require(
            (project.closed) ||
            (block.timestamp > project.deadline),
            "Projekt musi preprocit deadline nebo byt oznacen za uzavreny pokud nebyl cil splnen.");


        uint256 amountToRefund = project.contributions[msg.sender];
        require(amountToRefund > 0, "No contribution to refund or already refunded.");

        // kontribuce investora je vynulovana a projektova ulozena hodnota currentAmount je snizena o danou kontribuci
        project.contributions[msg.sender] = 0;
        project.currentAmount -= amountToRefund;

        (bool success, ) = payable(msg.sender).call{value: amountToRefund}("");
        require(success, "Refund failed.");

        // pokud projekt ještě nebyl explicitně označen 'closed' (např. nikdo nezavolal failProjectAfterDeadline)
        // a toto je poslední refundace (nebo první), označíme ho jako closed
        if (!project.closed && block.timestamp > project.deadline && !project.fundingGoalReached) {
            project.closed = true;
            emit ProjectFailed(_projectId);
        }

        emit FundsRefunded(_projectId, msg.sender, amountToRefund);
    }

    //
    // gettery
    //

    function getProjectDetails(uint256 _projectId) public view returns (
        address creator,
        string memory name,
        string memory description,
        uint256 goalAmount,
        uint256 deadline,
        uint256 currentAmount,
        bool fundingGoalReached,
        bool closed
    ) {
        Project storage project = projects[_projectId];
        return (
            project.creator,
            project.name,
            project.description,
            project.goalAmount,
            project.deadline,
            project.currentAmount,
            project.fundingGoalReached,
            project.closed
        );
    }

    function getContribution(uint256 _projectId, address _contributor) public view returns (uint256) {
        return projects[_projectId].contributions[_contributor];
    }

    function getAllProjectIds() public view returns (uint256[] memory) {
        uint256[] memory ids = new uint256[](projectCounter);
        for (uint256 i = 0; i < projectCounter; i++) {
            ids[i] = i + 1;
        }
        return ids;
    }

    function getContributors(uint256 _projectId) public view returns (address[] memory) {
        return projects[_projectId].contributors;
    }
}