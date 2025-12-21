// ===========================
// Firebase Setup
// ===========================
let db = null;
let auth = null;
let currentUser = null;
let appId = 'default-app-id';
let firebaseEnabled = false;

// Initialize Firebase asynchronously
(async function initializeFirebase() {
    // Check if Firebase config exists
    const hasFirebaseConfig = typeof __firebase_config !== 'undefined' && __firebase_config;

    if (hasFirebaseConfig) {
        // Firebase is configured - import and initialize
        try {
            const { initializeApp } = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js");
            const { getFirestore, collection, addDoc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js");
            const { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js");

            const firebaseConfig = JSON.parse(__firebase_config);
            const app = initializeApp(firebaseConfig);
            auth = getAuth(app);
            db = getFirestore(app);
            appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
            firebaseEnabled = true;

            // Store Firebase functions globally for later use
            window.firebaseModules = { collection, addDoc, serverTimestamp };

            // Initialize Authentication
            const initAuth = async () => {
                const statusEl = document.getElementById('dbStatus');
                try {
                    if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                        await signInWithCustomToken(auth, __initial_auth_token);
                    } else {
                        await signInAnonymously(auth);
                    }
                } catch (error) {
                    console.error("Auth Error:", error);
                    if (statusEl) {
                        statusEl.innerHTML = `<div class="w-2 h-2 rounded-full bg-red-500 mr-2"></div> Error`;
                        statusEl.classList.add('text-red-500');
                    }
                }
            };

            onAuthStateChanged(auth, (user) => {
                currentUser = user;
                const statusEl = document.getElementById('dbStatus');
                const dotEl = document.getElementById('dbStatusDot');
                const textEl = document.getElementById('dbStatusText');
                if (user) {
                    // Prefer granular status elements if present
                    if (dotEl) {
                        dotEl.classList.remove('bg-gray-400', 'bg-red-500');
                        dotEl.classList.add('bg-green-500');
                    }
                    if (textEl) {
                        textEl.textContent = 'Connected';
                        textEl.classList.remove('text-gray-500', 'text-red-500');
                        textEl.classList.add('text-green-600');
                    } else if (statusEl) {
                        statusEl.innerHTML = `<div class="w-2 h-2 rounded-full bg-green-500 mr-2"></div> Connected`;
                        statusEl.classList.remove('text-gray-500');
                        statusEl.classList.add('text-green-600');
                    }
                } else {
                    if (dotEl) {
                        dotEl.classList.remove('bg-green-500');
                        dotEl.classList.add('bg-gray-400');
                    }
                    if (textEl) {
                        textEl.textContent = 'Disconnected';
                        textEl.classList.remove('text-green-600');
                        textEl.classList.add('text-gray-500');
                    } else if (statusEl) {
                        statusEl.innerHTML = `<div class="w-2 h-2 rounded-full bg-gray-400 mr-2"></div> Disconnected`;
                        statusEl.classList.add('text-gray-500');
                    }
                }
            });

            await initAuth();
        } catch (error) {
            console.error("Firebase initialization error:", error);
            firebaseEnabled = false;
            const statusEl = document.getElementById('dbStatus');
            if (statusEl) {
                statusEl.innerHTML = `<div class="w-2 h-2 rounded-full bg-yellow-500 mr-2"></div> Offline`;
                statusEl.classList.add('text-yellow-600');
            }
        }
    } else {
        // No Firebase config - run in standalone mode
        console.log("Running in standalone mode (no Firebase configuration detected)");
        const statusEl = document.getElementById('dbStatus');
        if (statusEl) {
            statusEl.innerHTML = `<div class="w-2 h-2 rounded-full bg-gray-400 mr-2"></div> No Database`;
            statusEl.classList.add('text-gray-500');
        }
    }
})();

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
// Modal Helpers
// ===========================

function hideStatusModal() {
    const modal = document.getElementById('statusModal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');

    if (modalHideTimeout) {
        clearTimeout(modalHideTimeout);
        modalHideTimeout = null;
    }
}

function showStatusModal({ title, message, type = 'info', autoCloseMs = 0 }) {
    const modal = document.getElementById('statusModal');
    const titleEl = document.getElementById('statusModalTitle');
    const messageEl = document.getElementById('statusModalMessage');
    const iconEl = document.getElementById('statusModalIcon');

    if (!modal || !titleEl || !messageEl || !iconEl) return;

    const tone = {
        success: { bg: 'bg-green-100', text: 'text-green-700', icon: 'fa-check-circle' },
        error: { bg: 'bg-red-100', text: 'text-red-700', icon: 'fa-triangle-exclamation' },
        info: { bg: 'bg-blue-100', text: 'text-blue-700', icon: 'fa-circle-info' },
        warning: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: 'fa-circle-exclamation' }
    }[type] || { bg: 'bg-blue-100', text: 'text-blue-700', icon: 'fa-circle-info' };

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    titleEl.textContent = title || '';
    messageEl.textContent = message || '';

    iconEl.className = `fas ${tone.icon} ${tone.text}`;
    modal.querySelector('.status-badge').className = `status-badge inline-flex items-center space-x-2 px-3 py-2 rounded-full text-sm font-semibold ${tone.bg} ${tone.text}`;

    if (modalHideTimeout) clearTimeout(modalHideTimeout);
    if (autoCloseMs > 0) {
        modalHideTimeout = setTimeout(hideStatusModal, autoCloseMs);
    }
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
// Database Save Logic
// ===========================

/**
 * Save tournament data to Firestore
 */
async function saveDataToFirestore() {
    if (!firebaseEnabled) {
        showStatusModal({
            title: 'ไม่สามารถบันทึกได้',
            message: 'Firebase ยังไม่ถูกตั้งค่า กรุณาตั้งค่า Firebase configuration แล้วลองใหม่อีกครั้ง (ดู README.md)',
            type: 'warning'
        });
        return;
    }

    if (!currentUser) {
        showStatusModal({
            title: 'กำลังเชื่อมต่อฐานข้อมูล',
            message: 'กรุณารอสักครู่ ระบบกำลังเชื่อมต่อกับ Database',
            type: 'info',
            autoCloseMs: 2200
        });
        return;
    }
    if (!generatedData) return;

    const saveBtn = document.getElementById('saveToDbBtn');
    const originalContent = saveBtn?.innerHTML;
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i> กำลังบันทึก...`;
    }

    try {
        // Get Firebase modules from global storage
        const { collection, addDoc, serverTimestamp } = window.firebaseModules;

        // Save to top-level collection to match requested schema
        const collectionRef = collection(db, 'tournament_schedules');

        await addDoc(collectionRef, {
            ...generatedData,
            savedAt: serverTimestamp(),
            userId: currentUser.uid
        });

        if (saveBtn) {
            saveBtn.innerHTML = `<i class="fas fa-check mr-2"></i> บันทึกสำเร็จ!`;
            saveBtn.classList.remove('bg-green-500', 'hover:bg-green-600');
            saveBtn.classList.add('bg-gray-400');
        }
        
        showStatusModal({
            title: 'บันทึกสำเร็จ',
            message: 'ข้อมูลตารางการแข่งขันถูกบันทึกลงฐานข้อมูลเรียบร้อยแล้ว',
            type: 'success',
            autoCloseMs: 2600
        });

    } catch (e) {
        console.error("Error adding document: ", e);
        if (saveBtn) {
            saveBtn.innerHTML = `<i class="fas fa-exclamation-triangle mr-2"></i> ลองใหม่อีกครั้ง`;
            saveBtn.disabled = false;
        }

        // If debug status box exists, surface error there
        const statusBox = document.getElementById('systemStatusBox');
        const statusMessage = document.getElementById('statusMessage');
        if (statusBox && statusMessage) {
            statusBox.classList.remove('hidden');
            statusBox.classList.add('bg-red-50', 'border-red-200', 'text-red-800');
            statusMessage.textContent = `Save Error: ${e.message}`;
        }

        showStatusModal({
            title: 'บันทึกไม่สำเร็จ',
            message: `เกิดข้อผิดพลาดในการบันทึก: ${e.message}`,
            type: 'error'
        });
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
        potA: potA,
        potB: potB,
        schedule: allRounds,
        totalTeams: teams.length
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

    // Automatically save data to Firebase
    if (firebaseEnabled) {
        await saveDataToFirestore();
    }
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

window.addEventListener('load', () => {
    const loadingScreen = document.getElementById('loadingScreen');

    setTimeout(() => {
        loadingScreen.classList.add('opacity-0');

        setTimeout(() => {
            loadingScreen.style.display = 'none';
        }, 700);
    }, 2000);
});

// Event listeners for buttons and tabs
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('tab-list')?.addEventListener('click', () => switchTab('list'));
    document.getElementById('tab-day')?.addEventListener('click', () => switchTab('day'));
    document.getElementById('skipBtn')?.addEventListener('click', skipAnimation);
    document.getElementById('generateBtn')?.addEventListener('click', generateSchedule);

    const statusModal = document.getElementById('statusModal');
    const statusModalClose = document.getElementById('statusModalClose');
    statusModalClose?.addEventListener('click', hideStatusModal);
    statusModal?.addEventListener('click', (e) => {
        if (e.target === statusModal) hideStatusModal();
    });
});

// Make functions globally accessible for inline event handlers
window.switchTab = switchTab;
window.skipAnimation = skipAnimation;
window.generateSchedule = generateSchedule;
