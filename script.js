// --- Logic Functions ---

// Circle Method for Round Robin (Partial)
function generateInternalFixtures(teams) {
    let n = teams.length;
    let rounds = [];
    let fixedTeam = teams[0];
    let rotatingTeams = teams.slice(1);

    // Generate all rounds then slice
    for (let i = 0; i < n - 1; i++) {
        let roundMatches = [];
        // First pair
        roundMatches.push([fixedTeam, rotatingTeams[0]]);
        // Other pairs
        for (let j = 1; j < n / 2; j++) {
            roundMatches.push([rotatingTeams[j], rotatingTeams[rotatingTeams.length - j]]);
        }
        rounds.push(roundMatches);
        
        // Rotate
        rotatingTeams.push(rotatingTeams.shift());
    }
    return rounds.slice(0, 4); // Return first 4 rounds
}

// Cyclic Shift for Cross Group
function generateExternalFixtures(groupA, groupB) {
    let rounds = [];
    let n = groupA.length;
    for (let r = 0; r < 4; r++) {
        let roundMatches = [];
        for (let i = 0; i < n; i++) {
            let teamA = groupA[i];
            let teamBIndex = (i + r) % n;
            let teamB = groupB[teamBIndex];
            roundMatches.push([teamA, teamB]);
        }
        rounds.push(roundMatches);
    }
    return rounds;
}

function shuffle(array) {
    let currentIndex = array.length, randomIndex;
    while (currentIndex != 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
    return array;
}

// --- UI Functions ---

function generateSchedule() {
    const input = document.getElementById('teamsInput').value;
    const teams = input.split('\n').map(t => t.trim()).filter(t => t !== "");
    const errorMsg = document.getElementById('errorMsg');

    if (teams.length !== 16) {
        errorMsg.textContent = `❌ จำนวนทีมไม่ถูกต้อง: มี ${teams.length} ทีม (ต้องการ 16 ทีม)`;
        errorMsg.classList.remove('hidden');
        return;
    } else {
        errorMsg.classList.add('hidden');
    }

    // 1. Process Teams
    const shuffledTeams = shuffle([...teams]);
    const potA = shuffledTeams.slice(0, 8);
    const potB = shuffledTeams.slice(8, 16);

    // 2. Generate Rounds
    const internalA = generateInternalFixtures(potA);
    const internalB = generateInternalFixtures(potB);
    const external = generateExternalFixtures(potA, potB);

    let allRounds = [];
    
    // Phase 1: Internal (4 Days)
    for(let i=0; i<4; i++) {
        let combined = [...internalA[i], ...internalB[i]];
        combined = shuffle(combined);
        allRounds.push({ day: i+1, type: "Internal (Same Pot)", matches: combined });
    }

    // Phase 2: External (4 Days)
    for(let i=0; i<4; i++) {
        let matches = shuffle(external[i]);
        allRounds.push({ day: i+5, type: "External (Cross Pot)", matches: matches });
    }

    // 3. Render
    renderPots(potA, potB);
    renderSchedule(allRounds);

    // Show Results
    document.getElementById('resultsArea').classList.remove('hidden');
    // Scroll to results
    document.getElementById('resultsArea').scrollIntoView({ behavior: 'smooth' });
}

function renderPots(potA, potB) {
    const renderList = (teams, elId, badgeClass) => {
        const el = document.getElementById(elId);
        el.innerHTML = '';
        teams.forEach((team, idx) => {
            el.innerHTML += `<li class="flex justify-between items-center py-2 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition px-2 rounded">
                <span class="font-medium text-gray-700">${team}</span>
                <span class="text-xs font-mono bg-[var(--secondary)] text-primary px-2 py-1 rounded border border-primary/20">Seed ${idx+1}</span>
            </li>`;
        });
    };
    renderList(potA, 'potAList');
    renderList(potB, 'potBList');
}

function renderSchedule(rounds) {
    const tableBody = document.getElementById('scheduleTableBody');
    const dayView = document.getElementById('view-day');
    tableBody.innerHTML = '';
    dayView.innerHTML = '';

    rounds.forEach(round => {
        // List View
        round.matches.forEach(match => {
            const row = `<tr class="bg-white border-b hover:bg-[var(--secondary)] transition duration-150">
                <td class="px-4 py-3 font-bold text-primary">Day ${round.day}</td>
                <td class="px-4 py-3 text-xs text-gray-500 font-medium">${round.type}</td>
                <td class="px-4 py-3 text-right font-semibold text-blue-600">${match[0]}</td>
                <td class="px-4 py-3 text-center text-gray-400 text-xs">VS</td>
                <td class="px-4 py-3 text-left font-semibold text-red-600">${match[1]}</td>
                <td class="px-4 py-3 text-gray-500 text-xs">BO3</td>
            </tr>`;
            tableBody.innerHTML += row;
        });

        // Day View
        let dayCard = `<div class="bg-white rounded-lg p-0 border border-gray-200 overflow-hidden shadow-sm">
            <h3 class="font-bold text-gray-800 p-3 bg-gray-50 border-b flex justify-between items-center">
                <span class="text-primary"><i class="far fa-clock mr-1"></i> Match Day ${round.day}</span>
                <span class="text-xs font-normal bg-white px-2 py-1 rounded border text-gray-500">${round.type}</span>
            </h3>
            <div class="grid grid-cols-1 gap-2 p-3 bg-[var(--secondary)]">`;
        
        round.matches.forEach(match => {
            dayCard += `<div class="bg-white p-3 rounded shadow-sm flex justify-between items-center border border-gray-100 hover:shadow-md transition">
                <div class="w-5/12 text-right font-medium text-blue-700 truncate">${match[0]}</div>
                <div class="w-2/12 text-center">
                     <span class="text-[10px] font-bold text-white bg-gray-300 px-2 py-0.5 rounded-full">VS</span>
                </div>
                <div class="w-5/12 text-left font-medium text-red-700 truncate">${match[1]}</div>
            </div>`;
        });
        dayCard += `</div></div>`;
        dayView.innerHTML += dayCard;
    });
}

function switchTab(tab) {
    const listBtn = document.getElementById('tab-list');
    const dayBtn = document.getElementById('tab-day');
    const listView = document.getElementById('view-list');
    const dayView = document.getElementById('view-day');

    if (tab === 'list') {
        listBtn.className = "flex-1 py-2 text-center tab-active hover:bg-gray-50 transition";
        dayBtn.className = "flex-1 py-2 text-center tab-inactive hover:bg-gray-50 transition";
        listView.classList.remove('hidden');
        dayView.classList.add('hidden');
    } else {
        listBtn.className = "flex-1 py-2 text-center tab-inactive hover:bg-gray-50 transition";
        dayBtn.className = "flex-1 py-2 text-center tab-active hover:bg-gray-50 transition";
        listView.classList.add('hidden');
        dayView.classList.remove('hidden');
    }
}
