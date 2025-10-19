// --- J P A Test Website - script.js (FINAL FIXES - Admin Button Fix & Credentials) ---

// --- 1. Global Variables and Initial Data Setup ---

// 🛑 APNI ASLI JSONBIN.IO DETAILS YAHAN DAALEIN 🛑
// Credentials provided by the user in the HTML:
const JSONBIN_URL = `https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`;
  
 
// 🛑 ------------------------------------------- 🛑

const ADMIN_USER = 'admin';
const ADMIN_PASS = 'admin123';
const DEFAULT_Q_TIME_SEC = 900; // 15 minutes

let studentName = '';
let currentSet = ''; 
let currentQuestionIndex = 0; 
let userAnswers = {}; 
let currentQuestionMap = [];
let currentOptionMaps = {}; 
let currentTestQuestions = {}; 

let quizTimerInterval;
let quizRemainingTime = DEFAULT_Q_TIME_SEC;
let selectedTestId = null; 

let studentResults = []; // Initialize as an empty array
let scheduledTests = []; // Initialize as an empty array

// Data containers
let adminSettings = JSON.parse(localStorage.getItem('adminSettings')) || {
    quizTime: DEFAULT_Q_TIME_SEC,
    positiveMark: 1, 
    negativeMark: 0, 
};

// Temporary storage for admin's set uploads
let tempNewTestQuestions = { A: null, B: null, C: null }; 


// --- 2. JSONBin API Functions (Centralized Data Handling) ---

// Fetch ALL data (results and scheduled tests) from the server
async function fetchAdminDataFromServer() {
    try {
        const response = await fetch(JSONBIN_URL + '/latest', { // Added /latest for current version
            method: 'GET',
            headers: { 'X-Master-Key': JSONBIN_API_KEY, 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch data: ${response.statusText}`);
        }

        const data = await response.json();
        
        // Ensure data.record exists and is an object before accessing properties
        if (data.record && typeof data.record === 'object') {
             studentResults = data.record.results || []; 
             scheduledTests = data.record.scheduledTests || []; 
             console.log("Data fetched successfully from server.");
        } else {
             // If record is missing or not structured as expected, initialize empty arrays
             studentResults = []; 
             scheduledTests = [];
             console.warn("Server data structure unexpected, initializing empty arrays.");
        }
        
        return { results: studentResults, tests: scheduledTests };
    } catch (error) {
        console.error("Error fetching admin data (Check JSONBIN URL/API Key/Permissions):", error);
        return { results: [], tests: [] }; 
    }
}

// Save data to the server (Used by both saveResultsToServer and saveScheduledTestsToServer internally)
async function saveAllDataToServer(dataToSave) {
     try {
        const response = await fetch(JSONBIN_URL, {
            method: 'PUT',
            headers: {
                'X-Master-Key': JSONBIN_API_KEY,
                'Content-Type': 'application/json',
                'X-Bin-Versioning': 'false' 
            },
            body: JSON.stringify(dataToSave) 
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to save data: ${response.statusText}. Response: ${errorText}`);
        }
        console.log("Data saved successfully to server.");
        return true;
    } catch (error) {
        console.error("Error saving data (Check JSONBIN URL/API Key/Permissions):", error);
        alert(`Data server par save nahi ho paya: ${error.message}`);
        return false;
    }
}


// Save ONLY student results to the server
async function saveResultsToServer() {
    // Fetch current scheduledTests before saving to avoid overwriting
    const currentData = await fetchAdminDataFromServer();
    const dataToSave = {
        results: studentResults,
        scheduledTests: currentData.tests 
    };
    return saveAllDataToServer(dataToSave);
}

// Save ONLY scheduledTests to the server
async function saveScheduledTestsToServer() {
    // Fetch current results before saving to avoid overwriting
    const currentData = await fetchAdminDataFromServer();
    const dataToSave = {
        results: currentData.results, 
        scheduledTests: scheduledTests 
    };
    return saveAllDataToServer(dataToSave);
}


// --- 3. Utility Functions & Progress Save/Resume ---

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

function showScreen(screenId) {
    document.querySelectorAll('section').forEach(section => {
        section.classList.add('hidden-section');
    });
    
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.remove('hidden-section');
        targetScreen.classList.add('active-section');
    } else {
        console.error(`Attempted to show non-existent screen: ${screenId}`);
    }


    document.querySelectorAll('.nav-links a').forEach(link => link.classList.remove('active'));
    // Ensure navigation links work correctly
    if (screenId === 'home-screen' || screenId === 'quiz-screen' || screenId === 'result-screen') {
        const homeLink = document.getElementById('home-link');
        if (homeLink) homeLink.classList.add('active');
    } else if (screenId === 'admin-login-screen' || screenId === 'admin-panel') {
        const adminLink = document.getElementById('admin-link');
        if (adminLink) adminLink.classList.add('active');
    }
}

function updateLiveDate() {
    const now = new Date();
    const dateElement = document.getElementById('live-date');
    if (dateElement) dateElement.textContent = now.toLocaleString();
}
setInterval(updateLiveDate, 1000);

// --- 4. Quiz Progress Save/Resume Logic ---

function saveQuizProgress() {
    if (currentSet && studentName) { 
        const progress = {
            name: studentName,
            set: currentSet,
            index: currentQuestionIndex,
            answers: userAnswers,
            time: quizRemainingTime,
            map: currentQuestionMap,
            optionMaps: currentOptionMaps,
            testId: selectedTestId
        };
        localStorage.setItem('jpaQuizProgress', JSON.stringify(progress));
    }
}

function loadQuizProgress() {
    const progress = localStorage.getItem('jpaQuizProgress');
    if (progress) {
        return JSON.parse(progress);
    }
    return null;
}

// CheckResumeOption now relies on scheduledTests being loaded from server
function checkResumeOption() {
    const progress = loadQuizProgress();
    const resumeBtn = document.getElementById('resume-btn');
    
    if (progress && progress.time > 0) {
        // Use the globally loaded scheduledTests array
        const test = scheduledTests.find(t => t.id === progress.testId); 
        if (test && test.questions && test.questions[progress.set]) {
            if (resumeBtn) resumeBtn.classList.remove('hidden-section');
            return;
        }
    } 
    if (resumeBtn) resumeBtn.classList.add('hidden-section');
    localStorage.removeItem('jpaQuizProgress'); 
}

const resumeBtn = document.getElementById('resume-btn');
if(resumeBtn) {
    resumeBtn.addEventListener('click', () => {
        const progress = loadQuizProgress();
        if (!progress) return;

        const test = scheduledTests.find(t => t.id === progress.testId);
        if (!test || !test.questions || !test.questions[progress.set]) {
            alert("Cannot resume: The scheduled test or its question set is missing (check server data).");
            localStorage.removeItem('jpaQuizProgress');
            checkResumeOption();
            return;
        }
        
        const now = new Date().getTime();
        const endTime = new Date(test.startTime).getTime() + test.durationMinutes * 60 * 1000;

        if (now >= endTime) {
            alert("The test window has expired. Cannot resume, submitting the test now.");
            currentTestQuestions = test.questions;
            currentSet = progress.set;
            studentName = progress.name;
            userAnswers = progress.answers;
            currentQuestionMap = progress.map;
            currentOptionMaps = progress.optionMaps;
            selectedTestId = progress.testId;
            submitTest();
            return;
        }

        currentTestQuestions = test.questions; 
        studentName = progress.name;
        currentSet = progress.set;
        currentQuestionIndex = progress.index;
        userAnswers = progress.answers;
        quizRemainingTime = progress.time;
        currentQuestionMap = progress.map;
        currentOptionMaps = progress.optionMaps; 
        selectedTestId = progress.testId;

        const quizHeading = document.getElementById('quiz-welcome-heading');
        if (quizHeading) quizHeading.textContent = `${test.title}, ${studentName} (Selected Set: ${currentSet})`;
        startQuiz(true); 
    });
}


// --- 5. Home Page Initialization and Dynamic Test Listing Logic ---

async function updateHomePageData() {
    const posMark = document.getElementById('summary-pos-mark');
    if(posMark) posMark.textContent = adminSettings.positiveMark;
    const negMark = document.getElementById('summary-neg-mark');
    if(negMark) negMark.textContent = adminSettings.negativeMark;

    // Fetch latest data before rendering tests
    await fetchAdminDataFromServer(); 
    checkResumeOption(); // Re-check resume option with latest data
    renderScheduledTests();
}

const detailedRulesBtn = document.getElementById('show-detailed-rules');
if (detailedRulesBtn) {
    detailedRulesBtn.addEventListener('click', () => {
        const detailed = document.getElementById('detailed-rules-text');
        if (detailed) {
            detailed.classList.toggle('hidden-section');
            detailedRulesBtn.textContent = detailed.classList.contains('hidden-section') 
                ? 'Read Detailed Instructions 📖' 
                : 'Hide Instructions ⬆️';
        }
    });
}

const backToHomeBtn = document.getElementById('back-to-home');
if (backToHomeBtn) {
    backToHomeBtn.addEventListener('click', () => {
        showScreen('home-screen');
        const nameResult = document.getElementById('student-name-result');
        if (nameResult) nameResult.textContent = ''; 
        const testSetResult = document.getElementById('test-set-result');
        if (testSetResult) testSetResult.textContent = ''; 
        const studentNameInput = document.getElementById('student-name');
        if (studentNameInput) studentNameInput.value = ''; 
        currentTestQuestions = {}; 
        currentSet = '';
        selectedTestId = null; 
        updateHomePageData();
    });
}

function renderScheduledTests() {
    const container = document.getElementById('scheduled-test-list');
    if (!container) return; // Safely exit if container not found
    
    container.innerHTML = '';
    selectedTestId = null;
    currentSet = '';
    
    const rulesCard = document.getElementById('test-rules-card');
    if (rulesCard) rulesCard.classList.add('hidden-section');
    const inputContainer = document.getElementById('student-input-container');
    if (inputContainer) inputContainer.classList.add('hidden-section');
    const setContainer = document.getElementById('set-selection-container');
    if (setContainer) setContainer.classList.add('hidden-section');

    const liveTests = scheduledTests.filter(t => {
        const now = new Date().getTime();
        const startTime = new Date(t.startTime).getTime();
        const durationMs = t.durationMinutes * 60 * 1000;
        const endTime = startTime + durationMs;
        
        return now < endTime; 
    });

    if (liveTests.length === 0) {
        container.innerHTML = '<p id="no-tests-message" style="color: #666;">No tests scheduled currently.</p>';
        return;
    }

    liveTests.forEach(test => {
        const now = new Date().getTime();
        const startTime = new Date(test.startTime).getTime();
        const durationMs = test.durationMinutes * 60 * 1000;
        const endTime = startTime + durationMs;
        
        let status = 'upcoming';
        let statusText = `Starts: ${new Date(test.startTime).toLocaleString()}`;
        
        if (now >= startTime && now < endTime) {
            status = 'live';
            statusText = '🔴 LIVE NOW';
        }

        const availableSets = test.questions ? Object.keys(test.questions).filter(set => test.questions[set] && test.questions[set].length > 0) : [];
        const setInfo = availableSets.length > 0 ? `Sets: ${availableSets.join(', ')}` : 'Sets: N/A';

        const testButton = document.createElement('button');
        testButton.className = `set-btn scheduled-test-btn ${status}`;
        testButton.setAttribute('data-id', test.id);
        
        let bgColor = '';
        if (status === 'live') {
             bgColor = 'var(--danger-color)'; 
        } else if (status === 'upcoming') {
             bgColor = '#9e9e9e'; 
        }

        testButton.style.backgroundColor = bgColor;
        testButton.style.color = 'white';
        testButton.style.display = 'block';
        testButton.style.width = '100%';


        testButton.innerHTML = `
            <strong>${test.title} (${setInfo})</strong><br>
            <span style="font-size: 0.85em; font-weight: 500;">${statusText}</span>
        `;
        
        testButton.addEventListener('click', () => selectTest(test.id, status));
        container.appendChild(testButton);
    });
}

function selectTest(testId, status) {
    document.querySelectorAll('.scheduled-test-btn').forEach(btn => btn.classList.remove('selected'));
    
    const selectedBtn = document.querySelector(`.scheduled-test-btn[data-id="${testId}"]`);
    if (selectedBtn) selectedBtn.classList.add('selected');
    
    const selectedTest = scheduledTests.find(t => t.id === testId);
    selectedTestId = testId;
    currentTestQuestions = selectedTest ? selectedTest.questions || {} : {}; 
    currentSet = '';

    const availableSets = Object.keys(currentTestQuestions).filter(set => currentTestQuestions[set] && currentTestQuestions[set].length > 0);

    const summaryTime = document.getElementById('summary-time');
    if (summaryTime) summaryTime.textContent = selectedTest ? selectedTest.durationMinutes : 'N/A';
    
    const rulesCard = document.getElementById('test-rules-card');
    if (rulesCard) rulesCard.classList.remove('hidden-section');
    
    const startBtn = document.getElementById('start-test-btn');
    if (startBtn) startBtn.classList.add('hidden-section');
    
    const setContainer = document.getElementById('set-selection-container');
    if (setContainer) setContainer.classList.add('hidden-section');


    if (status === 'live' && availableSets.length > 0) {
        const inputContainer = document.getElementById('student-input-container');
        if (inputContainer) inputContainer.classList.remove('hidden-section');
        renderSetSelection(availableSets);
        if (setContainer) setContainer.classList.remove('hidden-section');

    } else if (status === 'live' && availableSets.length === 0) {
        alert("This test is live but no question sets are available (contact admin).");
        const inputContainer = document.getElementById('student-input-container');
        if (inputContainer) inputContainer.classList.add('hidden-section');
        if (rulesCard) rulesCard.classList.add('hidden-section');
    } else if (status === 'upcoming') {
        const inputContainer = document.getElementById('student-input-container');
        if (inputContainer) inputContainer.classList.add('hidden-section');
        if (rulesCard) rulesCard.classList.remove('hidden-section');
    }
}

function renderSetSelection(sets) {
    const container = document.getElementById('available-sets-list');
    if (!container) return;
    
    container.innerHTML = '';
    currentSet = ''; 

    sets.forEach(set => {
        const setButton = document.createElement('button');
        setButton.className = 'set-btn set-select-btn';
        setButton.textContent = `Set ${set}`;
        setButton.setAttribute('data-set', set);
        setButton.addEventListener('click', () => {
            selectSetForTest(set);
        });
        container.appendChild(setButton);
    });
}

function selectSetForTest(set) {
    currentSet = set;
    
    document.querySelectorAll('.set-select-btn').forEach(btn => btn.classList.remove('selected'));
    const selectedSetBtn = document.querySelector(`.set-select-btn[data-set="${set}"]`);
    if (selectedSetBtn) selectedSetBtn.classList.add('selected');

    const startButton = document.getElementById('start-test-btn');
    if (startButton) {
        startButton.textContent = `Start Test with Set ${set}`;
        startButton.classList.remove('hidden-section');
    }
}

const startTestBtn = document.getElementById('start-test-btn');
if (startTestBtn) {
    startTestBtn.addEventListener('click', async () => {
        if (!selectedTestId || !currentSet) {
            alert("Kripya pehle koi Test select karein aur phir ek Set select karein.");
            return;
        }
        
        const studentNameInput = document.getElementById('student-name');
        studentName = studentNameInput ? studentNameInput.value.trim() : '';
        
        if (studentName.length < 3) {
            alert("Kripya apna pura naam dalen (Please enter your full name).");
            return;
        }

        await fetchAdminDataFromServer(); // Get latest results and schedule
        const isAlreadySubmitted = studentResults.some(r => 
            r.name.toLowerCase() === studentName.toLowerCase() && r.testId === selectedTestId
        );

        if (isAlreadySubmitted) {
            alert("You Already Submit The Test. Aap yeh test dobara shuru nahi kar sakte hain.");
            return;
        }

        const test = scheduledTests.find(t => t.id === selectedTestId);
        if (!test) return; // Should not happen if selectedTestId is valid
        
        const now = new Date().getTime();
        const startTime = new Date(test.startTime).getTime();
        const durationMs = test.durationMinutes * 60 * 1000;
        const endTime = startTime + durationMs;
        
        if (now < startTime || now >= endTime) {
            alert("Yeh test abhi shuru nahi hua hai ya khatam ho chuka hai. Kripya list refresh karein.");
            renderScheduledTests(); 
            return;
        }

        const qCount = currentTestQuestions[currentSet] ? currentTestQuestions[currentSet].length : 0;
        if (qCount === 0) {
            alert(`Selected Set ${currentSet} mein koi questions nahi hain. Kripya Admin se sampark karein.`);
            return;
        }

        currentQuestionIndex = 0;
        userAnswers = {}; 
        quizRemainingTime = test.durationMinutes * 60;
        currentOptionMaps = {}; 

        const quizHeading = document.getElementById('quiz-welcome-heading');
        if (quizHeading) quizHeading.textContent = `${test.title}, ${studentName} (Selected Set: ${currentSet})`;

        currentQuestionMap = Array.from({ length: qCount }, (_, i) => i);
        shuffleArray(currentQuestionMap); 
        
        startQuiz(false); 
    });
}


// --- 6. Quiz Timer Logic ---
function startQuizTimer() {
    clearInterval(quizTimerInterval);
    const timerDisplay = document.getElementById('quiz-timer');
    if (!timerDisplay) return;
    
    const initialMinutes = Math.floor(quizRemainingTime / 60);
    const initialSeconds = quizRemainingTime % 60;
    timerDisplay.textContent = `${initialMinutes.toString().padStart(2, '0')}:${initialSeconds.toString().padStart(2, '0')}`;
    timerDisplay.style.color = 'var(--danger-color)'; 

    quizTimerInterval = setInterval(() => {
        if (quizRemainingTime <= 0) {
            clearInterval(quizTimerInterval);
            alert("Time's up! Your test will now be submitted automatically.");
            submitTest();
            return;
        }

        quizRemainingTime--;
        saveQuizProgress(); 
        const minutes = Math.floor(quizRemainingTime / 60);
        const seconds = quizRemainingTime % 60;
        timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        if (quizRemainingTime <= 60) {
            timerDisplay.style.color = '#FF0000'; 
        } else if (quizRemainingTime <= 300) {
            timerDisplay.style.color = '#FFA500'; 
        } else {
            timerDisplay.style.color = 'var(--danger-color)';
        }
    }, 1000);
}


// --- 7. Quiz Flow and UI Logic ---
function startQuiz(isResuming) {
    const questions = currentTestQuestions[currentSet];
    if (!questions || questions.length === 0) {
        alert(`Set ${currentSet} mein koi questions nahi hain.`);
        showScreen('home-screen');
        return;
    }
    
    showScreen('quiz-screen');
    loadQuestion(currentQuestionIndex);
    startQuizTimer(); 
    checkResumeOption(); 
}

function getShuffledOptions(displayIndex, originalOptions) {
    if (currentOptionMaps[displayIndex]) {
        const map = currentOptionMaps[displayIndex];
        return Object.keys(map).map(shuffledKey => ({
            shuffledLetter: shuffledKey,
            originalText: originalOptions[map[shuffledKey].charCodeAt(0) - 65],
            originalLetter: map[shuffledKey]
        }));
    }

    const originalLetters = ['A', 'B', 'C', 'D'];
    const shuffledLetters = ['A', 'B', 'C', 'D'];
    shuffleArray(shuffledLetters);

    const newMap = {};
    for (let i = 0; i < 4; i++) {
        newMap[shuffledLetters[i]] = originalLetters[i]; 
    }
    currentOptionMaps[displayIndex] = newMap; 

    return shuffledLetters.map(shuffledKey => ({
        shuffledLetter: shuffledKey,
        originalText: originalOptions[newMap[shuffledKey].charCodeAt(0) - 65],
        originalLetter: newMap[shuffledKey]
    }));
}

function loadQuestion(index) {
    if (index < 0 || index >= currentQuestionMap.length) return;
    
    currentQuestionIndex = index;
    saveQuizProgress();
    
    const originalQIndex = currentQuestionMap[index];
    const questions = currentTestQuestions[currentSet];
    if (!questions || originalQIndex >= questions.length) return;
    
    const question = questions[originalQIndex];
    
    const qCounter = document.getElementById('question-counter');
    if (qCounter) qCounter.textContent = `Q ${index + 1}/${currentQuestionMap.length}`;
    
    const qProgress = document.getElementById('question-progress');
    if (qProgress) qProgress.style.width = `${((index + 1) / currentQuestionMap.length) * 100}%`;
    
    let questionHTML = `<div class="question-text">${index + 1}. ${question.text}</div>`;
    
    const qImageDisplay = document.getElementById('question-image-display');
    if (qImageDisplay) {
        if (question.imageURL) {
            qImageDisplay.innerHTML = `<img src="${question.imageURL}" alt="Question Image">`;
        } else {
            qImageDisplay.innerHTML = '';
        }
    }

    const shuffledOptions = getShuffledOptions(index, question.options);
    
    questionHTML += '<ul class="options-list">';
    shuffledOptions.forEach(opt => {
        const isSelected = userAnswers[index] === opt.shuffledLetter ? 'selected' : '';
        questionHTML += `
            <li class="option-item ${isSelected}" data-option="${opt.shuffledLetter}">
                <span class="option-label">${opt.shuffledLetter}.</span>
                <span class="option-text">${opt.originalText}</span>
            </li>
        `;
    });
    questionHTML += '</ul>';
    
    const questionDisplay = document.getElementById('question-display');
    if (questionDisplay) {
        questionDisplay.innerHTML = questionHTML;

        questionDisplay.querySelectorAll('.option-item').forEach(item => {
            item.addEventListener('click', function() {
                const optionLetter = this.getAttribute('data-option');
                selectAnswer(optionLetter);
            });
        });
    }


    const prevBtn = document.getElementById('prev-btn');
    if (prevBtn) prevBtn.disabled = index === 0;
    
    const nextSubmitBtn = document.getElementById('next-submit-btn');
    if (nextSubmitBtn) {
        if (index === currentQuestionMap.length - 1) {
            nextSubmitBtn.textContent = 'Submit Test';
            nextSubmitBtn.classList.add('submit-btn');
        } else {
            nextSubmitBtn.textContent = 'Next';
            nextSubmitBtn.classList.remove('submit-btn');
        }
    }

    updateNavGrid(); 
}

function selectAnswer(optionLetter) {
    const questionOptions = document.getElementById('question-display').querySelectorAll('.option-item');
    questionOptions.forEach(opt => opt.classList.remove('selected'));
    
    const selectedOptionElement = document.getElementById('question-display').querySelector(`.option-item[data-option="${optionLetter}"]`);
    if (selectedOptionElement) {
        selectedOptionElement.classList.add('selected');
    }
    
    userAnswers[currentQuestionIndex] = optionLetter;
    saveQuizProgress(); 
    updateNavGrid(); 
}

function updateNavGrid() {
    const grid = document.getElementById('question-nav-grid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    for (let i = 0; i < currentQuestionMap.length; i++) {
        let statusClass = 'unattempted';
        if (userAnswers[i]) {
            statusClass = 'attempted';
        }
        if (i === currentQuestionIndex) {
            statusClass = 'current'; 
        }
        
        const qBtn = document.createElement('button');
        qBtn.className = `nav-q-btn ${statusClass}`;
        qBtn.textContent = i + 1;
        qBtn.onclick = () => loadQuestion(i);
        grid.appendChild(qBtn);
    }
}

const prevBtn = document.getElementById('prev-btn');
if (prevBtn) prevBtn.addEventListener('click', () => loadQuestion(currentQuestionIndex - 1));

const nextSubmitBtn = document.getElementById('next-submit-btn');
if (nextSubmitBtn) {
    nextSubmitBtn.addEventListener('click', () => {
        if (currentQuestionIndex < currentQuestionMap.length - 1) {
            loadQuestion(currentQuestionIndex + 1);
        } else {
            submitTest();
        }
    });
}


// --- 8. Result Calculation and Submission ---
function calculateResult() {
    const totalQ = currentQuestionMap.length;
    let correct = 0;
    let incorrect = 0;
    let attempted = 0;
    let score = 0;

    const positiveMark = adminSettings.positiveMark;
    const negativeMark = adminSettings.negativeMark;
    const maxScore = totalQ * positiveMark;
    
    for (let i = 0; i < totalQ; i++) {
        const originalQIndex = currentQuestionMap[i];
        const question = currentTestQuestions[currentSet][originalQIndex];
        const userAnswer = userAnswers[i]; 
        
        if (userAnswer) {
            attempted++;
            const optionMap = currentOptionMaps[i];
            const originalUserAnswer = optionMap ? optionMap[userAnswer] : userAnswer; 

            if (originalUserAnswer === question.correctAnswer) {
                correct++;
                score += positiveMark;
            } else {
                incorrect++;
                score += negativeMark;
            }
        }
    }

    return { totalQ, attempted, correct, incorrect, score, maxScore };
}


function submitTest() {
    clearInterval(quizTimerInterval);
    localStorage.removeItem('jpaQuizProgress'); 

    const result = calculateResult();
    const finalResult = {
        name: studentName,
        set: currentSet,
        date: new Date().toISOString(), 
        score: result.score,
        totalQ: result.totalQ,
        attempted: result.attempted,
        incorrect: result.incorrect,
        userAnswers: userAnswers, 
        questionMap: currentQuestionMap, 
        optionMaps: currentOptionMaps,
        testId: selectedTestId, 
    };
    
    studentResults.push(finalResult);
    saveResultsToServer(); 

    endQuiz(result);
}

function endQuiz(result) {
    const nameResult = document.getElementById('student-name-result');
    if (nameResult) nameResult.textContent = studentName;
    const testSetResult = document.getElementById('test-set-result');
    if (testSetResult) testSetResult.textContent = currentSet;
    const totalQ = document.getElementById('total-q');
    if (totalQ) totalQ.textContent = result.totalQ;
    const attemptedQ = document.getElementById('attempted-q');
    if (attemptedQ) attemptedQ.textContent = result.attempted;
    const incorrectQ = document.getElementById('incorrect-q');
    if (incorrectQ) incorrectQ.textContent = result.incorrect;
    const nonAttemptedQ = document.getElementById('non-attempted-q');
    if (nonAttemptedQ) nonAttemptedQ.textContent = result.totalQ - result.attempted;
    const finalScore = document.getElementById('final-score');
    if (finalScore) finalScore.textContent = result.score;
    const maxScore = document.getElementById('max-score');
    if (maxScore) maxScore.textContent = result.maxScore;
    
    showScreen('result-screen');
}


// --- 9. Admin Panel: Login, Settings, and Test Scheduler Logic ---

const adminLoginForm = document.getElementById('admin-login-form');
if (adminLoginForm) {
    adminLoginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = document.getElementById('admin-username').value;
        const password = document.getElementById('admin-password').value;

        if (username === ADMIN_USER && password === ADMIN_PASS) {
            showScreen('admin-panel');
            // Fetch latest data for Admin Panel view
            fetchAdminDataFromServer().then(() => {
                const adminUsername = document.getElementById('admin-username');
                if (adminUsername) adminUsername.value = '';
                const adminPassword = document.getElementById('admin-password');
                if (adminPassword) adminPassword.value = '';
                
                tempNewTestQuestions = { A: null, B: null, C: null }; 
                renderAdminScheduledList();
                updateSetUploadStatus(); 
            });
        } else {
            alert('Invalid Admin Credentials!');
        }
    });
}


function saveAdminSettings(type) {
    if (type === 'marking') {
        const posMark = document.getElementById('positive-mark');
        if (posMark) adminSettings.positiveMark = parseInt(posMark.value);
        const negMark = document.getElementById('negative-mark');
        if (negMark) adminSettings.negativeMark = parseInt(negMark.value);
        alert('Marking scheme saved locally!');
    }
    localStorage.setItem('adminSettings', JSON.stringify(adminSettings));
    updateHomePageData();
}

const posMarkInput = document.getElementById('positive-mark');
if (posMarkInput) posMarkInput.value = adminSettings.positiveMark;
const negMarkInput = document.getElementById('negative-mark');
if (negMarkInput) negMarkInput.value = adminSettings.negativeMark;


// --- Question Upload Functions ---

function updateSetUploadStatus() {
    ['A', 'B', 'C'].forEach(set => {
        const statusSpan = document.getElementById(`status-${set}`);
        if (!statusSpan) return;
        
        if (tempNewTestQuestions[set]) {
            statusSpan.textContent = `${set}: ${tempNewTestQuestions[set].length} Qs Loaded`;
            statusSpan.style.color = 'var(--success-color)';
        } else {
            statusSpan.textContent = `${set}: Not Loaded`;
            statusSpan.style.color = '#666';
        }
    });
}

function loadSetQuestions(event, set) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
            
            if (Array.isArray(importedData) && importedData.every(q => q.text && q.options && q.correctAnswer)) {
                
                const sanitizedData = importedData.map((q, index) => ({
                    ...q,
                    id: q.id || `${set}_Q${index + 1}` 
                }));

                tempNewTestQuestions[set] = sanitizedData;
                updateSetUploadStatus();
                alert(`Set ${set} loaded successfully with ${sanitizedData.length} questions!`);
            } else {
                alert(`Set ${set} upload failed: File must be a JSON array of valid question objects (with 'text', 'options', 'correctAnswer').`);
                tempNewTestQuestions[set] = null;
                updateSetUploadStatus();
            }
        } catch (error) {
            alert(`Set ${set} upload failed: Error parsing JSON file.`);
            tempNewTestQuestions[set] = null;
            updateSetUploadStatus();
            console.error('Import Error:', error);
        }
    };
    reader.readAsText(file);
}

// Global functions for file input change events (assumes HTML has these IDs/functions)
// These lines must be outside DOMContentLoaded to be callable from inline HTML `onchange`
window.loadSetQuestions = loadSetQuestions;
window.saveAdminSettings = saveAdminSettings; 
window.deleteScheduledTest = deleteScheduledTest; 


// --- Test Scheduling Functions (MODIFIED FOR SERVER SAVE) ---

// **MODIFIED**: This function is now async and saves to the server
async function saveScheduledTests() {
    // localStorage.setItem('scheduledTests', JSON.stringify(scheduledTests)); // Removed Local Storage Save
    const success = await saveScheduledTestsToServer();
    if (success) {
        renderAdminScheduledList();
        updateHomePageData();
    }
}

const scheduleTestBtn = document.getElementById('schedule-test-btn');
// FIX: Changed to onclick="scheduleNewTest()" in HTML, so no need for this event listener
// if (scheduleTestBtn) scheduleTestBtn.addEventListener('click', scheduleNewTest);

async function scheduleNewTest() {
    const title = document.getElementById('test-title').value.trim();
    const dateTimeValue = document.getElementById('schedule-datetime').value;
    const durationInput = document.getElementById('schedule-duration');
    const duration = durationInput ? parseInt(durationInput.value) : 0;

    if (!title || !dateTimeValue || !duration || duration <= 0) {
        alert("Kripya sabhi fields sahi tarah se bharein.");
        return;
    }
    
    const availableSets = Object.keys(tempNewTestQuestions).filter(set => tempNewTestQuestions[set] !== null);

    if (availableSets.length === 0) {
         alert("Kripya kam se kam ek Question Set (A, B, ya C) ki file upload karein.");
        return;
    }

    const startTime = new Date(dateTimeValue);
    if (isNaN(startTime.getTime())) {
         alert("Invalid Date or Time selected.");
        return;
    }

    const scheduledQuestions = {};
    availableSets.forEach(set => {
        scheduledQuestions[set] = tempNewTestQuestions[set];
    });

    const newTest = {
        id: `SCH-${Date.now()}`,
        title: title,
        startTime: startTime.toISOString(), 
        durationMinutes: duration,
        questions: scheduledQuestions, 
    };

    scheduledTests.push(newTest); // Add to the global array
    await saveScheduledTests(); // Save the updated array to server
    alert(`Test "${title}" successfully scheduled with Sets: ${availableSets.join(', ')}!`);
    
    document.getElementById('test-title').value = '';
    document.getElementById('schedule-datetime').value = '';
    if (durationInput) durationInput.value = '15';
    tempNewTestQuestions = { A: null, B: null, C: null };
    
    // Clear file inputs after scheduling
    const importA = document.getElementById('import-set-A');
    if (importA) importA.value = '';
    const importB = document.getElementById('import-set-B');
    if (importB) importB.value = '';
    const importC = document.getElementById('import-set-C');
    if (importC) importC.value = '';

    updateSetUploadStatus();
}

function renderAdminScheduledList() {
    const container = document.getElementById('scheduled-admin-list');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (scheduledTests.length === 0) {
        container.innerHTML = '<p style="font-size: 0.9em; color: #999;">No scheduled tests yet.</p>';
        return;
    }

    scheduledTests.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

    const list = document.createElement('ul');
    list.style.listStyleType = 'none';
    list.style.padding = '0';
    
    scheduledTests.forEach(test => {
        const item = document.createElement('li');
        item.style.borderBottom = '1px dashed #eee';
        item.style.padding = '10px 0';
        
        const startTime = new Date(test.startTime).toLocaleString();
        
        const availableSets = test.questions ? Object.keys(test.questions).filter(set => test.questions[set] && test.questions[set].length > 0) : [];
        // Attempt to find a question count for display, assuming sets have equal question numbers
        let questionCount = 0;
        if (availableSets.length > 0) {
            const firstSetQuestions = test.questions[availableSets[0]];
            questionCount = firstSetQuestions ? firstSetQuestions.length : 0;
        }
        
        const setInfo = availableSets.length > 0 ? `Sets: ${availableSets.join(', ')} (${questionCount} Qs each)` : 'Sets: N/A';
        
        item.innerHTML = `
            <p><strong>${test.title} (${setInfo})</strong></p>
            <p style="font-size: 0.9em; margin-top: 5px;">
                Start: ${startTime} | Duration: ${test.durationMinutes} min
                <button onclick="deleteScheduledTest('${test.id}')" style="background-color: var(--danger-color); padding: 5px 10px; margin-left: 10px; float: right;">Delete</button>
            </p>
        `;
        list.appendChild(item);
    });
    container.appendChild(list);
}

// **MODIFIED**: This function is now async and saves to the server
async function deleteScheduledTest(id) {
    if (confirm("Are you sure you want to delete this scheduled test? This will remove it from all student devices.")) {
        scheduledTests = scheduledTests.filter(test => test.id !== id);
        await saveScheduledTests(); // Save the removal to server
    }
}


// --- 10. Admin Panel: Result Display and Analytics ---

const studentResultBtn = document.getElementById('student-result-btn');
if (studentResultBtn) {
    studentResultBtn.addEventListener('click', () => {
        const topIncorrectSection = document.getElementById('top-incorrect-section');
        if (topIncorrectSection) topIncorrectSection.classList.add('hidden-section'); 
        
        const resultSection = document.getElementById('student-result-section');
        if (resultSection) {
            resultSection.classList.toggle('hidden-section');
            
            if (!resultSection.classList.contains('hidden-section')) {
                // Fetch latest data before rendering results
                fetchAdminDataFromServer().then(renderResultTable);
            }
        }
    });
}

function renderResultTable(results = studentResults) {
    const tbody = document.getElementById('result-table-body');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    const searchInput = document.getElementById('student-search');
    const search = searchInput ? searchInput.value.toLowerCase() : '';

    const filteredResults = studentResults.filter(r => r.name.toLowerCase().includes(search)); // Use global studentResults

    // FIX: Sorting logic uses Date object and ISO string format
    filteredResults.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); 

    filteredResults.forEach(r => {
        const row = tbody.insertRow();
        row.insertCell().textContent = r.name;
        row.insertCell().textContent = r.set;
        row.insertCell().textContent = new Date(r.date).toLocaleString(); 
        const maxScore = r.totalQ * adminSettings.positiveMark;
        row.insertCell().textContent = `${r.score} / ${maxScore}`;
    });
}

const studentSearch = document.getElementById('student-search');
if (studentSearch) studentSearch.addEventListener('input', () => renderResultTable());

const clearDataBtn = document.getElementById('clear-data-btn');
if (clearDataBtn) {
    clearDataBtn.addEventListener('click', async () => {
        if (confirm('Are you sure you want to CLEAR ALL STUDENT RESULTS from the server? This action is irreversible.')) {
            studentResults = [];
            const success = await saveResultsToServer();
            if (success) {
                alert('All student results cleared successfully!');
                renderResultTable();
            }
        }
    });
}

function downloadCSV(data, filename = 'student_results.csv') {
    let csvContent = "Student Name,Set,Date,Score,Total Q,Attempted,Incorrect,Test ID\n"; 

    data.forEach(item => {
        csvContent += `${item.name},${item.set},"${new Date(item.date).toLocaleString()}",${item.score},${item.totalQ},${item.attempted},${item.incorrect},${item.testId || 'N/A'}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) { 
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

const downloadDataBtn = document.getElementById('download-data-btn');
if (downloadDataBtn) {
    downloadDataBtn.addEventListener('click', () => {
        if (studentResults.length > 0) {
            downloadCSV(studentResults);
        } else {
            alert('No results available to download.');
        }
    });
}


// --- 11. Admin Panel: Top Incorrect Questions Logic ---

const topIncorrectBtn = document.getElementById('top-incorrect-btn');
if (topIncorrectBtn) {
    topIncorrectBtn.addEventListener('click', () => {
        const resultSection = document.getElementById('student-result-section');
        if (resultSection) resultSection.classList.add('hidden-section');
        
        const incorrectSection = document.getElementById('top-incorrect-section');
        if (incorrectSection) {
            incorrectSection.classList.toggle('hidden-section');
            
            if (!incorrectSection.classList.contains('hidden-section')) {
                // Fetch latest data before analysis
                fetchAdminDataFromServer().then(({ results, tests }) => {
                    const incorrectList = document.getElementById('incorrect-list-container');
                    if (!incorrectList) return;

                    if (results && results.length > 0) {
                        const incorrectData = calculateIncorrectFrequencies(results, tests);
                        displayTopIncorrectQuestions(incorrectData);
                    } else {
                        incorrectList.innerHTML = '<p style="text-align: center; color: var(--danger-color);">No student results found on the server to analyze.</p>';
                    }
                });
            }
        }
    });
}


function calculateIncorrectFrequencies(results, scheduledTests) {
    const incorrectCounts = {}; 

    results.forEach(result => {
        const set = result.set;
        const testId = result.testId;
        
        const currentTest = scheduledTests.find(t => t.id === testId);
        if (!currentTest || !currentTest.questions || !currentTest.questions[set]) return;
        const testQuestions = currentTest.questions[set];

        // Group by test ID and set, for robust tracking
        if (!incorrectCounts[testId]) {
            incorrectCounts[testId] = {};
        }
        if (!incorrectCounts[testId][set]) {
            incorrectCounts[testId][set] = {};
        }
        
        for (const shuffledIndex in result.userAnswers) {
            const userAnswer = result.userAnswers[shuffledIndex]; 
            const originalQIndex = result.questionMap[shuffledIndex]; 
            
            if (originalQIndex >= testQuestions.length) continue; // Safety check
            
            const question = testQuestions[originalQIndex];

            const optionMap = result.optionMaps[shuffledIndex];
            const originalUserAnswer = optionMap ? optionMap[userAnswer] : userAnswer;

            if (userAnswer && originalUserAnswer !== question.correctAnswer) {
                const qKey = question.id || `Q${originalQIndex + 1}`; 
                
                incorrectCounts[testId][set][qKey] = (incorrectCounts[testId][set][qKey] || { 
                    id: qKey, 
                    testId: testId,
                    testTitle: currentTest.title,
                    set: set,
                    originalQIndex: originalQIndex, 
                    text: question.text, 
                    correctAnswer: question.correctAnswer,
                    count: 0 
                });
                incorrectCounts[testId][set][qKey].count++;
            }
        }
    });

    const sortedIncorrectData = [];
    for (const testId in incorrectCounts) {
        for (const set in incorrectCounts[testId]) {
            const sortedQuestions = Object.values(incorrectCounts[testId][set]).sort((a, b) => b.count - a.count);
            sortedIncorrectData.push(...sortedQuestions);
        }
    }
    
    return sortedIncorrectData;
}


function displayTopIncorrectQuestions(topIncorrectData) {
    const container = document.getElementById('incorrect-list-container');
    if (!container) return;
    
    container.innerHTML = ''; 
    
    if (topIncorrectData.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #666;">No incorrect attempts recorded across all tests.</p>';
        return;
    }

    const groupedByTest = topIncorrectData.reduce((acc, q) => {
        const key = `${q.testTitle} (ID: ${q.testId})`;
        if (!acc[key]) acc[key] = [];
        acc[key].push(q);
        return acc;
    }, {});
    
    for (const testKey in groupedByTest) {
        const questionsList = groupedByTest[testKey];
        
        let tableHTML = `
            <div class="admin-section" style="border-left: 5px solid var(--danger-color); margin-bottom: 25px;">
                <h4 style="color: var(--danger-color);">${testKey}</h4>
                <table style="width: 100%; margin-top: 10px; font-size: 0.9em;">
                    <thead>
                        <tr>
                            <th style="width: 5%;">Set</th>
                            <th style="width: 5%;">Q#</th>
                            <th style="width: 50%;">Question Preview</th>
                            <th style="width: 15%; text-align: center;">Correct Ans</th>
                            <th style="width: 25%; text-align: center;">Total Incorrect Attempts</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        questionsList.forEach(q => { 
            const previewText = q.text ? (q.text.length > 60 ? q.text.substring(0, 60) + '...' : q.text) : 'N/A';

            tableHTML += `
                <tr>
                    <td style="font-weight: bold;">${q.set}</td>
                    <td>${q.originalQIndex + 1}</td>
                    <td>${previewText}</td>
                    <td style="text-align: center; color: var(--success-color); font-weight: bold;">${q.correctAnswer || 'N/A'}</td>
                    <td style="text-align: center; color: var(--danger-color); font-weight: bold;">${q.count}</td>
                </tr>
            `;
        });

        tableHTML += `</tbody></table></div>`;
        container.innerHTML += tableHTML;
    }
}


// --- 12. Initial Setup and Navigation Fix (Admin Button Fix Here) ---

document.addEventListener('DOMContentLoaded', () => {
    // HOME LINK FIX
    const homeLink = document.getElementById('home-link');
    if (homeLink) {
        homeLink.addEventListener('click', (e) => {
            e.preventDefault();
            
            const quizScreen = document.getElementById('quiz-screen');
            const isQuizActive = quizScreen && !quizScreen.classList.contains('hidden-section');
            
            if (isQuizActive) {
                if (!confirm('Aapka test abhi chal raha hai. Kya aap sach mein Home screen par jaana chahte hain? Aisa karne par test **automatically submit/end** ho jayega.')) {
                    return; 
                }
                submitTest(); 
                return;
            }
            
            showScreen('home-screen');
            updateHomePageData();
        });
    }

    // 🛑 ADMIN LINK FIX 🛑
    // Yeh code Admin link button par click hone par "admin-login-screen" ko show karega.
    const adminLink = document.getElementById('admin-link');
    if (adminLink) {
        console.log("Admin Link found and event listener attached."); 

        adminLink.addEventListener('click', (e) => {
            e.preventDefault();
            console.log("Admin Link clicked. Navigating to admin-login-screen."); 
            showScreen('admin-login-screen');
        });
    } else {
        console.error("Error: Admin link with ID 'admin-link' not found in HTML.");
    }

    // Initial Load: Fetch all data and then update UI
    fetchAdminDataFromServer().then(updateHomePageData); 
    updateLiveDate(); 
});
