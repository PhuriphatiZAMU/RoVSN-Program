// ===========================
// MongoDB API Setup
// ===========================
let isServerOnline = false;
let API_URL = 'http://localhost:3000/api';
let HEALTH_PATH = '/health';
let SCHEDULE_PATH = '/schedules';

// Initialize API configuration
(function initializeAPI() {
    // In module scripts we must read globals via globalThis
    const cfg = (typeof globalThis !== 'undefined') ? globalThis.__api_config : undefined;
    if (cfg && cfg.baseURL) {
        API_URL = cfg.baseURL;
        if (cfg.endpoints && cfg.endpoints.health) {
            HEALTH_PATH = cfg.endpoints.health;
        }
        if (cfg.endpoints && cfg.endpoints.schedules) {
            SCHEDULE_PATH = cfg.endpoints.schedules;
        }
    }
    // Check server status on page load
    checkServerStatus();
})();

// Also re-check after DOM is ready to ensure elements exist
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(checkServerStatus, 0);
});

// Check MongoDB Server Connection Status
async function checkServerStatus() {
    const statusText = document.getElementById('statusText');
    const statusDot = document.getElementById('statusDot');
    const mainStatus = document.getElementById('dbConnectionStatus');
    const notify = document.getElementById('notificationArea');

    if (!statusText || !statusDot || !mainStatus) return;

    statusText.textContent = "Connecting...";
    statusDot.className = "w-2 h-2 rounded-full bg-yellow-500 mr-2 animate-pulse";
    mainStatus.innerHTML = '<span class="text-yellow-600"><i class="fas fa-spinner fa-spin"></i> Checking...</span>';

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        const healthUrl = `${API_URL}${HEALTH_PATH}`;
        const res = await fetch(healthUrl, { 
            method: 'GET',
            signal: controller.signal 
        });
        
        clearTimeout(timeoutId);
        
        if (res.ok) {
            isServerOnline = true;
            statusText.textContent = "MongoDB Online";
            statusDot.className = "w-2 h-2 rounded-full bg-green-500 mr-2";
            mainStatus.innerHTML = '<span class="text-green-600"><i class="fas fa-database"></i> Connected to MongoDB Server</span>';

            if (notify) {
                notify.classList.add('hidden');
            }
            console.log('[health] OK', healthUrl);
        } else {
            throw new Error("Server not ready");
        }
    } catch (e) {
        console.warn("[health] offline or blocked:", e?.message || e);
        isServerOnline = false;
        statusText.textContent = "Offline (Local)";
        statusDot.className = "w-2 h-2 rounded-full bg-gray-400 mr-2";
        mainStatus.innerHTML = '<span class="text-gray-600"><i class="fas fa-hdd"></i> Local Storage Mode (Server Offline)</span>';

        if (notify) {
            notify.className = "mb-6 p-4 rounded-lg border flex items-center bg-yellow-100 border-yellow-300 text-yellow-800";
            notify.innerHTML = `<i class=\"fas fa-exclamation-triangle mr-3 text-xl\"></i> ไม่พบ MongoDB Server ที่ ${API_URL}. กรุณาเปิด server ด้วยคำสั่ง <span class=\"font-mono bg-white px-2 py-1 rounded border ml-1\">node server.js</span> หรืออาจถูกบล็อกเพราะ mixed content หากเปิดผ่าน https ให้เรียกผ่าน http/localhost หรือใช้พร็อกซีเดียวกัน`;
            notify.classList.remove('hidden');
        }
    }
}

// Make checkServerStatus globally accessible
window.checkServerStatus = checkServerStatus;

// ===========================
// Helper Functions
// ===========================

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let skipTriggered = false;
let generatedData = null; // Store data to be saved
let modalHideTimeout = null;

function skipAnimation() {
    skipTriggered = true;
}

// ===========================
// Notification System
// ===========================

function showNotification(type, msg) {
    const notify = document.getElementById('notificationArea');
    if (!notify) return;

    const styles = {
        success: ['bg-green-100', 'border-green-300', 'text-green-800', 'fa-check-circle'],
        warning: ['bg-yellow-100', 'border-yellow-300', 'text-yellow-800', 'fa-exclamation-triangle'],
        info: ['bg-gray-100', 'border-gray-300', 'text-gray-800', 'fa-info-circle'],
        error: ['bg-red-100', 'border-red-300', 'text-red-800', 'fa-times-circle'],
        loading: ['bg-blue-50', 'border-blue-200', 'text-blue-800', 'fa-spinner fa-spin']
    };
    
    const s = styles[type] || styles.info;
    notify.className = `mb-6 p-4 rounded-lg border flex items-center ${s[0]} ${s[1]} ${s[2]}`;
    notify.innerHTML = `<i class="fas ${s[3]} mr-3 text-xl"></i> <span>${msg}</span>`;
    notify.classList.remove('hidden');
}

// ===========================
// Schedule Generation Logic
// ===========================

/**
 * Generate internal fixtures for a group using Round-Robin algorithm
 * @param {Array} teams - Array of team names
 * @returns {Array} Array of rounds, each containing matches as objects {blue, red}
 */
function generateInternalFixtures(teams) {
    const n = teams.length;
    const rounds = [];
    const fixedTeam = teams[0];
    let rotatingTeams = teams.slice(1);

    for (let i = 0; i < n - 1; i++) {
        const roundMatches = [];
        // Changed from array [A, B] to object {blue: A, red: B} for Firestore compatibility
        roundMatches.push({ blue: fixedTeam, red: rotatingTeams[0] });

        for (let j = 1; j < n / 2; j++) {
            roundMatches.push({ blue: rotatingTeams[j], red: rotatingTeams[rotatingTeams.length - j] });
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
 * @returns {Array} Array of rounds with cross-group matches as objects {blue, red}
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
            // Changed from array [A, B] to object {blue: A, red: B} for Firestore compatibility
            roundMatches.push({ blue: teamA, red: teamB });
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

            // Set content - Using object properties instead of array indices
            teamAEl.textContent = match.blue;
            teamBEl.textContent = match.red;
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
// Database Save Logic (MongoDB + LocalStorage Fallback)
// ===========================

/**
 * Save tournament data to MongoDB or LocalStorage
 */
async function saveDataToMongoDB(data) {
    showNotification('loading', 'กำลังบันทึกข้อมูล...');

    if (isServerOnline) {
        try {
            const response = await fetch(`${API_URL}${SCHEDULE_PATH}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            
            if (response.ok) {
                const result = await response.json();
                showNotification('success', `✅ บันทึกข้อมูลลง MongoDB สำเร็จ! (Document ID: ${result._id || result.id || 'saved'})`);
                return true;
            } else {
                throw new Error(`Server returned error: ${response.status}`);
            }
        } catch (e) {
            console.error('MongoDB save error:', e);
            // Fallback to local storage
            saveToLocalStorage(data);
            showNotification('warning', '⚠️ ไม่สามารถติดต่อ MongoDB Server ได้ - บันทึกลง Local Storage แทน');
            return false;
        }
    } else {
        // Server is offline, use localStorage
        saveToLocalStorage(data);
        showNotification('info', 'ℹ️ โหมด Offline: บันทึกลง Local Storage เรียบร้อย (MongoDB Server ไม่ได้เปิด)');
        return false;
    }
}

/**
 * Save to browser's localStorage as fallback
 */
function saveToLocalStorage(data) {
    try {
        const saved = JSON.parse(localStorage.getItem('rov_tournaments') || '[]');
        const dataWithId = { ...data, _id: `local_${Date.now()}`, savedAt: new Date().toISOString() };
        saved.push(dataWithId);
        localStorage.setItem('rov_tournaments', JSON.stringify(saved));
        console.log('Data saved to localStorage:', dataWithId._id);
    } catch (e) {
        console.error('LocalStorage save error:', e);
        showNotification('error', '❌ เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    }
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
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> กำลังสร้างตาราง...';
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

    // Store Data for Saving
    generatedData = {
        teams: teams,
        potA: potA,
        potB: potB,
        schedule: allRounds,
        totalTeams: teams.length,
        createdAt: new Date().toISOString()
    };

    // Render background data
    renderPots(potA, potB);
    renderSchedule(allRounds);

    // Run reveal animation
    await runScheduleReveal(allRounds);

    // Show final tables
    resultsArea.classList.remove('hidden');
    resultsArea.scrollIntoView({ behavior: 'smooth' });
    
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-play-circle mr-2"></i> สร้างและบันทึก (Generate & Save)';

    // Automatically save data to MongoDB (or localStorage fallback)
    await saveDataToMongoDB(generatedData);
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
                    <td class="px-4 py-3 text-right font-semibold text-blue-600">${match.blue}</td>
                    <td class="px-4 py-3 text-center text-gray-400 text-xs">VS</td>
                    <td class="px-4 py-3 text-left font-semibold text-red-600">${match.red}</td>
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
                    <div class="w-5/12 text-right font-medium text-blue-700 truncate">${match.blue}</div>
                    <div class="w-2/12 text-center">
                        <span class="text-[10px] font-bold text-white bg-gray-300 px-2 py-0.5 rounded-full">VS</span>
                    </div>
                    <div class="w-5/12 text-left font-medium text-red-700 truncate">${match.red}</div>
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
// Window Load Event & Event Listeners
// ===========================

function hideLoadingScreen() {
    const loadingScreen = document.getElementById('loadingScreen');
    if (!loadingScreen) return;
    loadingScreen.classList.add('opacity-0');
    setTimeout(() => {
        loadingScreen.style.display = 'none';
    }, 700);
}

// Hide loader as soon as DOM is ready (faster than waiting for all assets)
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(hideLoadingScreen, 500);
});

// Safety: also hide on full load in case DOMContentLoaded was missed
window.addEventListener('load', () => {
    setTimeout(hideLoadingScreen, 0);
});

// Event listeners for buttons and tabs
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('tab-list')?.addEventListener('click', () => switchTab('list'));
    document.getElementById('tab-day')?.addEventListener('click', () => switchTab('day'));
    document.getElementById('skipBtn')?.addEventListener('click', skipAnimation);
    document.getElementById('generateBtn')?.addEventListener('click', generateSchedule);
});

// Make functions globally accessible for inline event handlers
window.switchTab = switchTab;
window.skipAnimation = skipAnimation;
window.generateSchedule = generateSchedule;
