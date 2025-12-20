// ===========================
// Helper Functions
// ===========================

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let skipTriggered = false;

function skipAnimation() {
    skipTriggered = true;
}

// ===========================
// Schedule Generation Logic
// ===========================

/**
 * Generate internal fixtures for a group using Round-Robin algorithm
 * @param {Array} teams - Array of team names
 * @returns {Array} Array of rounds, each containing matches
 */
function generateInternalFixtures(teams) {
    const n = teams.length;
    const rounds = [];
    const fixedTeam = teams[0];
    let rotatingTeams = teams.slice(1);

    for (let i = 0; i < n - 1; i++) {
        const roundMatches = [];
        roundMatches.push([fixedTeam, rotatingTeams[0]]);

        for (let j = 1; j < n / 2; j++) {
            roundMatches.push([rotatingTeams[j], rotatingTeams[rotatingTeams.length - j]]);
        }

        rounds.push(roundMatches);
        rotatingTeams.push(rotatingTeams.shift());
    }

    return rounds.slice(0, 4);
}

/**
 * Generate external fixtures between two groups
 * @param {Array} groupA - First group of teams
 * @param {Array} groupB - Second group of teams
 * @returns {Array} Array of rounds with cross-group matches
 */
function generateExternalFixtures(groupA, groupB) {
    const rounds = [];
    const n = groupA.length;

    for (let r = 0; r < 4; r++) {
        const roundMatches = [];

        for (let i = 0; i < n; i++) {
            const teamA = groupA[i];
            const teamBIndex = (i + r) % n;
            const teamB = groupB[teamBIndex];
            roundMatches.push([teamA, teamB]);
        }

        rounds.push(roundMatches);
    }

    return rounds;
}

/**
 * Shuffle array using Fisher-Yates algorithm
 * @param {Array} array - Array to shuffle
 * @returns {Array} Shuffled array
 */
function shuffle(array) {
    let currentIndex = array.length;

    while (currentIndex !== 0) {
        const randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }

    return array;
}

// ===========================
// Animation & Reveal Logic
// ===========================

/**
 * Run the schedule reveal animation
 * @param {Array} schedule - Complete schedule with all rounds
 */
async function runScheduleReveal(schedule) {
    const modal = document.getElementById('revealModal');
    const dayBadge = document.getElementById('revealDayBadge');
    const phaseText = document.getElementById('revealPhase');
    const teamAEl = document.getElementById('revealTeamA');
    const teamBEl = document.getElementById('revealTeamB');
    const counter = document.getElementById('matchCounter');
    const progressBar = document.getElementById('revealProgressBar');

    skipTriggered = false;
    modal.classList.remove('hidden');

    const DISPLAY_DELAY = 10000; // 10 seconds per match

    let totalMatches = 0;
    schedule.forEach(r => totalMatches += r.matches.length);
    let currentMatchCount = 0;

    for (const round of schedule) {
        if (skipTriggered) break;

        for (let i = 0; i < round.matches.length; i++) {
            if (skipTriggered) break;

            const match = round.matches[i];
            currentMatchCount++;

            // Update UI
            dayBadge.textContent = `Match Day ${round.day}`;
            phaseText.textContent = round.type;

            // Reset animation
            teamAEl.parentElement.parentElement.classList.remove('animate-scale-up');
            teamBEl.parentElement.parentElement.classList.remove('animate-scale-up');
            void teamAEl.offsetWidth; // Trigger reflow

            // Set content
            teamAEl.textContent = match[0];
            teamBEl.textContent = match[1];
            counter.textContent = `Match ${i + 1} of ${round.matches.length} (Total Progress: ${Math.round((currentMatchCount / totalMatches) * 100)}%)`;
            progressBar.style.width = `${(currentMatchCount / totalMatches) * 100}%`;

            // Add animation
            teamAEl.parentElement.parentElement.classList.add('animate-scale-up');
            teamBEl.parentElement.parentElement.classList.add('animate-scale-up');

            await sleep(DISPLAY_DELAY);
        }
    }

    modal.classList.add('hidden');
}

// ===========================
// Main Controller
// ===========================

/**
 * Generate and display the tournament schedule
 */
async function generateSchedule() {
    const input = document.getElementById('teamsInput').value;
    const teams = input.split('\n').map(t => t.trim()).filter(t => t !== "");
    const errorMsg = document.getElementById('errorMsg');
    const resultsArea = document.getElementById('resultsArea');
    const btn = document.getElementById('generateBtn');

    // Validation
    if (teams.length !== 16) {
        errorMsg.textContent = `❌ จำนวนทีมไม่ถูกต้อง: มี ${teams.length} ทีม (ต้องการ 16 ทีม)`;
        errorMsg.classList.remove('hidden');
        return;
    } else {
        errorMsg.classList.add('hidden');
    }

    btn.disabled = true;
    resultsArea.classList.add('hidden');

    // Process teams
    const shuffledTeams = shuffle([...teams]);
    const potA = shuffledTeams.slice(0, 8);
    const potB = shuffledTeams.slice(8, 16);

    // Generate rounds
    const internalA = generateInternalFixtures(potA);
    const internalB = generateInternalFixtures(potB);
    const external = generateExternalFixtures(potA, potB);

    const allRounds = [];

    // Phase 1: Internal (4 Days)
    for (let i = 0; i < 4; i++) {
        let combined = [...internalA[i], ...internalB[i]];
        combined = shuffle(combined);
        allRounds.push({ 
            day: i + 1, 
            type: "Internal (Same Pot)", 
            matches: combined 
        });
    }

    // Phase 2: External (4 Days)
    for (let i = 0; i < 4; i++) {
        const matches = shuffle(external[i]);
        allRounds.push({ 
            day: i + 5, 
            type: "External (Cross Pot)", 
            matches: matches 
        });
    }

    // Render background data
    renderPots(potA, potB);
    renderSchedule(allRounds);

    // Run reveal animation
    await runScheduleReveal(allRounds);

    // Show final tables
    resultsArea.classList.remove('hidden');
    resultsArea.scrollIntoView({ behavior: 'smooth' });
    btn.disabled = false;
}

// ===========================
// Render Functions
// ===========================

/**
 * Render the pot assignments (Pot A and Pot B)
 * @param {Array} potA - Teams in Pot A
 * @param {Array} potB - Teams in Pot B
 */
function renderPots(potA, potB) {
    const renderList = (teams, elId) => {
        const el = document.getElementById(elId);
        el.innerHTML = '';

        teams.forEach((team, idx) => {
            el.innerHTML += `
                <li class="flex justify-between items-center py-2 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition px-2 rounded">
                    <span class="font-medium text-gray-700">${team}</span>
                    <span class="text-xs font-mono bg-[var(--secondary)] text-primary px-2 py-1 rounded border border-primary/20">Seed ${idx + 1}</span>
                </li>
            `;
        });
    };

    renderList(potA, 'potAList');
    renderList(potB, 'potBList');
}

/**
 * Render the complete schedule in both table and day views
 * @param {Array} rounds - All rounds with matches
 */
function renderSchedule(rounds) {
    const tableBody = document.getElementById('scheduleTableBody');
    const dayView = document.getElementById('view-day');
    tableBody.innerHTML = '';
    dayView.innerHTML = '';

    let rowDelay = 0;

    rounds.forEach(round => {
        // List View (Table)
        round.matches.forEach(match => {
            const row = `
                <tr class="bg-white border-b hover:bg-[var(--secondary)] transition duration-150 animate-fade-in" 
                    style="animation-delay: ${rowDelay}ms; animation-fill-mode: both;">
                    <td class="px-4 py-3 font-bold text-primary">Day ${round.day}</td>
                    <td class="px-4 py-3 text-xs text-gray-500 font-medium">${round.type}</td>
                    <td class="px-4 py-3 text-right font-semibold text-blue-600">${match[0]}</td>
                    <td class="px-4 py-3 text-center text-gray-400 text-xs">VS</td>
                    <td class="px-4 py-3 text-left font-semibold text-red-600">${match[1]}</td>
                    <td class="px-4 py-3 text-gray-500 text-xs">BO3</td>
                </tr>
            `;
            tableBody.innerHTML += row;
        });

        rowDelay += 50;

        // Day View (Cards)
        let dayCard = `
            <div class="bg-white rounded-lg p-0 border border-gray-200 overflow-hidden shadow-sm animate-fade-in" 
                 style="animation-delay: ${rowDelay}ms; animation-fill-mode: both;">
                <h3 class="font-bold text-gray-800 p-3 bg-gray-50 border-b flex justify-between items-center">
                    <span class="text-primary"><i class="far fa-clock mr-1"></i> Match Day ${round.day}</span>
                    <span class="text-xs font-normal bg-white px-2 py-1 rounded border text-gray-500">${round.type}</span>
                </h3>
                <div class="grid grid-cols-1 gap-2 p-3 bg-[var(--secondary)]">
        `;

        round.matches.forEach(match => {
            dayCard += `
                <div class="bg-white p-3 rounded shadow-sm flex justify-between items-center border border-gray-100 hover:shadow-md transition">
                    <div class="w-5/12 text-right font-medium text-blue-700 truncate">${match[0]}</div>
                    <div class="w-2/12 text-center">
                        <span class="text-[10px] font-bold text-white bg-gray-300 px-2 py-0.5 rounded-full">VS</span>
                    </div>
                    <div class="w-5/12 text-left font-medium text-red-700 truncate">${match[1]}</div>
                </div>
            `;
        });

        dayCard += `</div></div>`;
        dayView.innerHTML += dayCard;
    });
}

/**
 * Switch between table and day view tabs
 * @param {string} tab - 'list' or 'day'
 */
function switchTab(tab) {
    const listBtn = document.getElementById('tab-list');
    const dayBtn = document.getElementById('tab-day');
    const listView = document.getElementById('view-list');
    const dayView = document.getElementById('view-day');

    if (tab === 'list') {
        listBtn.className = "flex-1 py-2 text-center tab-active transition duration-300";
        dayBtn.className = "flex-1 py-2 text-center tab-inactive transition duration-300";
        listView.classList.remove('hidden');
        dayView.classList.add('hidden');
    } else {
        listBtn.className = "flex-1 py-2 text-center tab-inactive transition duration-300";
        dayBtn.className = "flex-1 py-2 text-center tab-active transition duration-300";
        listView.classList.add('hidden');
        dayView.classList.remove('hidden');
    }
}

// ===========================
// Window Load Event
// ===========================

window.addEventListener('load', () => {
    const loadingScreen = document.getElementById('loadingScreen');

    setTimeout(() => {
        loadingScreen.classList.add('opacity-0');

        setTimeout(() => {
            loadingScreen.style.display = 'none';
        }, 700);
    }, 2000);
});
