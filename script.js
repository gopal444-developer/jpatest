// --- J P A Test Website - script.js (V11 - Top Incorrect Multi-Test & Date Fix) ---

// --- 1. Global Variables and Initial Data Setup ---

const ADMIN_USER = 'admin';
const ADMIN_PASS = 'admin123';
const DEFAULT_Q_TIME_SEC = 900; // 15 minutes

let studentName = '';
let currentSet = ''; // Track the set selected by the student
let currentQuestionIndex = 0; 
let userAnswers = {}; 
let currentQuestionMap = [];
let currentOptionMaps = {}; 
let currentTestQuestions = {}; // Holds questions for the active scheduled test

let quizTimerInterval;
let quizRemainingTime = DEFAULT_Q_TIME_SEC;
let selectedTestId = null; // Track the currently selected scheduled test ID

let studentResults = []; 

// Data containers
let adminSettings = JSON.parse(localStorage.getItem('adminSettings')) || {
    quizTime: DEFAULT_Q_TIME_SEC,
    positiveMark: 1, 
    negativeMark: 0, 
};

// Scheduled Tests data structure now includes 'questions' key
let scheduledTests = JSON.parse(localStorage.getItem('scheduledTests')) || [];

// Temporary storage for admin's set uploads before scheduling a new test
let tempNewTestQuestions = { A: null, B: null, C: null }; 


// --- 2. JSONBin API Functions (Centralized Data Handling) ---

async function fetchResultsFromServer() {
    try {
        const response = await fetch(JSONBIN_URL, {
            method: 'GET',
            headers: { 'X-Master-Key': JSONBIN_API_KEY, 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch: ${response.statusText}`);
        }

        const data = await response.json();
        studentResults = data.record.results || []; 
        return studentResults;
    } catch (error) {
        console.error("Error fetching results:", error);
        return []; 
    }
}

async function saveResultsToServer() {
    try {
        const response = await fetch(JSONBIN_URL, {
            method: 'PUT',
            headers: {
                'X-Master-Key': JSONBIN_API_KEY,
                'Content-Type': 'application/json',
                'X-Bin-Versioning': 'false' 
            },
            body: JSON.stringify({ results: studentResults }) 
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Failed to save: ${response.statusText} - ${errorData.message}`);
        }
        return true;
    } catch (error) {
        console.error("Error saving results:", error);
        alert(`Result server par save nahi ho paya: ${error.message}`);
        return false;
    }
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
    document.getElementById(screenId).classList.remove('hidden-section');

    document.querySelectorAll('.nav-links a').forEach(link => link.classList.remove('active'));
    if (screenId === 'home-screen' || screenId === 'quiz-screen' || screenId === 'result-screen') {
        document.getElementById('home-link').classList.add('active');
    } else if (screenId === 'admin-login-screen' || screenId === 'admin-panel') {
        document.getElementById('admin-link').classList.add('active');
    }
}

function updateLiveDate() {
    const now = new Date();
    document.getElementById('live-date').textContent = now.toLocaleString();
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

function checkResumeOption() {
    const progress = loadQuizProgress();
    const resumeBtn = document.getElementById('resume-btn');
    
    if (progress && progress.time > 0) {
        const test = scheduledTests.find(t => t.id === progress.testId);
        if (test && test.questions && test.questions[progress.set]) {
            resumeBtn.classList.remove('hidden-section');
            return;
        }
    } 
    resumeBtn.classList.add('hidden-section');
    localStorage.removeItem('jpaQuizProgress'); 
}

document.getElementById('resume-btn').addEventListener('click', () => {
    const progress = loadQuizProgress();
    if (!progress) return;

    const test = scheduledTests.find(t => t.id === progress.testId);
    if (!test || !test.questions || !test.questions[progress.set]) {
         alert("Cannot resume: The scheduled test or its question set is missing.");
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

    document.getElementById('quiz-welcome-heading').textContent = `Welcome Back, ${studentName} (Set ${currentSet})`;
    startQuiz(true); 
});

// --- 5. Home Page Initialization and Dynamic Test Listing Logic ---

function updateHomePageData() {
    document.getElementById('summary-pos-mark').textContent = adminSettings.positiveMark;
    document.getElementById('summary-neg-mark').textContent = adminSettings.negativeMark;

    renderScheduledTests();
}

document.getElementById('show-detailed-rules').addEventListener('click', () => {
    const detailed = document.getElementById('detailed-rules-text');
    detailed.classList.toggle('hidden-section');
    document.getElementById('show-detailed-rules').textContent = detailed.classList.contains('hidden-section') 
        ? 'Read Detailed Instructions 📖' 
        : 'Hide Instructions ⬆️';
});

document.getElementById('back-to-home').addEventListener('click', () => {
    showScreen('home-screen');
    document.getElementById('student-name-result').textContent = ''; 
    document.getElementById('test-set-result').textContent = ''; 
    document.getElementById('student-name').value = ''; 
    currentTestQuestions = {}; 
    currentSet = '';
    selectedTestId = null; 
    checkResumeOption();
    updateHomePageData();
});

function renderScheduledTests() {
    const container = document.getElementById('scheduled-test-list');
    container.innerHTML = '';
    selectedTestId = null;
    currentSet = '';
    document.getElementById('test-rules-card').classList.add('hidden-section');
    document.getElementById('student-input-container').classList.add('hidden-section');
    document.getElementById('set-selection-container').classList.add('hidden-section');

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
    selectedBtn.classList.add('selected');
    
    const selectedTest = scheduledTests.find(t => t.id === testId);
    selectedTestId = testId;
    currentTestQuestions = selectedTest.questions || {}; 
    currentSet = '';

    const availableSets = Object.keys(currentTestQuestions).filter(set => currentTestQuestions[set] && currentTestQuestions[set].length > 0);


    document.getElementById('summary-time').textContent = selectedTest.durationMinutes;
    document.getElementById('test-rules-card').classList.remove('hidden-section');
    document.getElementById('start-test-btn').classList.add('hidden-section');
    document.getElementById('set-selection-container').classList.add('hidden-section');


    if (status === 'live' && availableSets.length > 0) {
        document.getElementById('student-input-container').classList.remove('hidden-section');
        renderSetSelection(availableSets);
        document.getElementById('set-selection-container').classList.remove('hidden-section');

    } else if (status === 'live' && availableSets.length === 0) {
        alert("This test is live but no question sets are available (contact admin).");
        document.getElementById('student-input-container').classList.add('hidden-section');
        document.getElementById('test-rules-card').classList.add('hidden-section');
    } else if (status === 'upcoming') {
        document.getElementById('student-input-container').classList.add('hidden-section');
        document.getElementById('test-rules-card').classList.remove('hidden-section');
    }
}

function renderSetSelection(sets) {
    const container = document.getElementById('available-sets-list');
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
    document.querySelector(`.set-select-btn[data-set="${set}"]`).classList.add('selected');

    const startButton = document.getElementById('start-test-btn');
    startButton.textContent = `Start Test with Set ${set}`;
    startButton.classList.remove('hidden-section');
}

document.getElementById('start-test-btn').addEventListener('click', async () => {
    if (!selectedTestId || !currentSet) {
        alert("Kripya pehle koi Test select karein aur phir ek Set select karein.");
        return;
    }
    
    studentName = document.getElementById('student-name').value.trim();
    if (studentName.length < 3) {
        alert("Kripya apna pura naam dalen (Please enter your full name).");
        return;
    }

    await fetchResultsFromServer(); 
    const isAlreadySubmitted = studentResults.some(r => 
        r.name.toLowerCase() === studentName.toLowerCase() && r.testId === selectedTestId
    );

    if (isAlreadySubmitted) {
        alert("You Already Submit The Test. Aap yeh test dobara shuru nahi kar sakte hain.");
        return;
    }

    const test = scheduledTests.find(t => t.id === selectedTestId);
    
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

    document.getElementById('quiz-welcome-heading').textContent = `${test.title}, ${studentName} (Selected Set: ${currentSet})`;

    currentQuestionMap = Array.from({ length: qCount }, (_, i) => i);
    shuffleArray(currentQuestionMap); 
    
    startQuiz(false); 
});


// --- 6. Quiz Timer Logic ---
function startQuizTimer() {
    clearInterval(quizTimerInterval);
    const timerDisplay = document.getElementById('quiz-timer');
    
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
    const question = currentTestQuestions[currentSet][originalQIndex];
    
    document.getElementById('question-counter').textContent = `Q ${index + 1}/${currentQuestionMap.length}`;
    document.getElementById('question-progress').style.width = `${((index + 1) / currentQuestionMap.length) * 100}%`;
    
    let questionHTML = `<div class="question-text">${index + 1}. ${question.text}</div>`;
    
    if (question.imageURL) {
        document.getElementById('question-image-display').innerHTML = `<img src="${question.imageURL}" alt="Question Image">`;
    } else {
        document.getElementById('question-image-display').innerHTML = '';
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
    questionDisplay.innerHTML = questionHTML;

    questionDisplay.querySelectorAll('.option-item').forEach(item => {
        item.addEventListener('click', function() {
            const optionLetter = this.getAttribute('data-option');
            selectAnswer(optionLetter);
        });
    });


    document.getElementById('prev-btn').disabled = index === 0;
    const nextSubmitBtn = document.getElementById('next-submit-btn');
    if (index === currentQuestionMap.length - 1) {
        nextSubmitBtn.textContent = 'Submit Test';
        nextSubmitBtn.classList.add('submit-btn');
    } else {
        nextSubmitBtn.textContent = 'Next';
        nextSubmitBtn.classList.remove('submit-btn');
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

document.getElementById('prev-btn').addEventListener('click', () => loadQuestion(currentQuestionIndex - 1));
document.getElementById('next-submit-btn').addEventListener('click', () => {
    if (currentQuestionIndex < currentQuestionMap.length - 1) {
        loadQuestion(currentQuestionIndex + 1);
    } else {
        submitTest();
    }
});


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
        // Using toISOString for consistent date string storage
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
    document.getElementById('student-name-result').textContent = studentName;
    document.getElementById('test-set-result').textContent = currentSet;
    document.getElementById('total-q').textContent = result.totalQ;
    document.getElementById('attempted-q').textContent = result.attempted;
    document.getElementById('incorrect-q').textContent = result.incorrect;
    document.getElementById('non-attempted-q').textContent = result.totalQ - result.attempted;
    document.getElementById('final-score').textContent = result.score;
    document.getElementById('max-score').textContent = result.maxScore;
    
    showScreen('result-screen');
}


// --- 9. Admin Panel: Login, Settings, and Test Scheduler Logic ---

document.getElementById('admin-login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const username = document.getElementById('admin-username').value;
    const password = document.getElementById('admin-password').value;

    if (username === ADMIN_USER && password === ADMIN_PASS) {
        showScreen('admin-panel');
        fetchResultsFromServer(); 
        document.getElementById('admin-username').value = '';
        document.getElementById('admin-password').value = '';
        
        tempNewTestQuestions = { A: null, B: null, C: null }; 
        renderAdminScheduledList();
        updateSetUploadStatus(); 
    } else {
        alert('Invalid Admin Credentials!');
    }
});


function saveAdminSettings(type) {
    if (type === 'marking') {
        adminSettings.positiveMark = parseInt(document.getElementById('positive-mark').value);
        adminSettings.negativeMark = parseInt(document.getElementById('negative-mark').value);
        alert('Marking scheme saved locally!');
    }
    localStorage.setItem('adminSettings', JSON.stringify(adminSettings));
    updateHomePageData();
}

document.getElementById('positive-mark').value = adminSettings.positiveMark;
document.getElementById('negative-mark').value = adminSettings.negativeMark;


// --- Question Upload Functions ---

function updateSetUploadStatus() {
    ['A', 'B', 'C'].forEach(set => {
        const statusSpan = document.getElementById(`status-${set}`);
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
                    // Use a more robust ID format
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

// --- Test Scheduling Functions ---

function saveScheduledTests() {
    localStorage.setItem('scheduledTests', JSON.stringify(scheduledTests));
    renderAdminScheduledList();
    updateHomePageData();
}

function scheduleNewTest() {
    const title = document.getElementById('test-title').value.trim();
    const dateTimeValue = document.getElementById('schedule-datetime').value;
    const duration = parseInt(document.getElementById('schedule-duration').value);

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

    scheduledTests.push(newTest);
    saveScheduledTests();
    alert(`Test "${title}" successfully scheduled with Sets: ${availableSets.join(', ')}!`);
    
    document.getElementById('test-title').value = '';
    document.getElementById('schedule-datetime').value = '';
    document.getElementById('schedule-duration').value = '15';
    tempNewTestQuestions = { A: null, B: null, C: null };
    document.getElementById('import-set-A').value = ''; 
    document.getElementById('import-set-B').value = ''; 
    document.getElementById('import-set-C').value = ''; 
    updateSetUploadStatus();
}

function renderAdminScheduledList() {
    const container = document.getElementById('scheduled-admin-list');
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
        const questionCount = availableSets.length > 0 ? test.questions[availableSets[0]].length : 0;
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

function deleteScheduledTest(id) {
    if (confirm("Are you sure you want to delete this scheduled test? This will not delete submitted results.")) {
        scheduledTests = scheduledTests.filter(test => test.id !== id);
        saveScheduledTests();
    }
}


// --- 10. Admin Panel: Result Display and Analytics (Date Fix) ---

document.getElementById('student-result-btn').addEventListener('click', () => {
    document.getElementById('top-incorrect-section').classList.add('hidden-section'); 
    
    const resultSection = document.getElementById('student-result-section');
    resultSection.classList.toggle('hidden-section');
    
    if (!resultSection.classList.contains('hidden-section')) {
        fetchResultsFromServer().then(renderResultTable);
    }
});

function renderResultTable(results = studentResults) {
    const tbody = document.getElementById('result-table-body');
    tbody.innerHTML = '';
    const search = document.getElementById('student-search').value.toLowerCase();

    const filteredResults = results.filter(r => r.name.toLowerCase().includes(search));

    // **FIXED**: Sorting logic using Date object. Since 'r.date' is now stored as ISO string, this should work correctly.
    filteredResults.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); 

    filteredResults.forEach(r => {
        const row = tbody.insertRow();
        row.insertCell().textContent = r.name;
        row.insertCell().textContent = r.set;
        // Display using local format
        row.insertCell().textContent = new Date(r.date).toLocaleString(); 
        const maxScore = r.totalQ * adminSettings.positiveMark;
        row.insertCell().textContent = `${r.score} / ${maxScore}`;
    });
}

document.getElementById('student-search').addEventListener('input', () => renderResultTable());

document.getElementById('clear-data-btn').addEventListener('click', async () => {
    if (confirm('Are you sure you want to CLEAR ALL STUDENT RESULTS from the server? This action is irreversible.')) {
        studentResults = [];
        const success = await saveResultsToServer();
        if (success) {
            alert('All student results cleared successfully!');
            renderResultTable();
        }
    }
});

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

document.getElementById('download-data-btn').addEventListener('click', () => {
    if (studentResults.length > 0) {
        downloadCSV(studentResults);
    } else {
        alert('No results available to download.');
    }
});


// --- 11. Admin Panel: Top Incorrect Questions Logic (MODIFIED) ---

document.getElementById('top-incorrect-btn').addEventListener('click', () => {
    document.getElementById('student-result-section').classList.add('hidden-section');
    
    const incorrectSection = document.getElementById('top-incorrect-section');
    incorrectSection.classList.toggle('hidden-section');
    
    if (!incorrectSection.classList.contains('hidden-section')) {
        fetchResultsFromServer().then(results => {
            if (results && results.length > 0) {
                // Fetch scheduled tests again to ensure we have the question content for analysis
                const allScheduledTests = JSON.parse(localStorage.getItem('scheduledTests')) || [];
                // Pass scheduledTests to the analysis function
                const incorrectData = calculateIncorrectFrequencies(results, allScheduledTests);
                displayTopIncorrectQuestions(incorrectData);
            } else {
                document.getElementById('incorrect-list-container').innerHTML = '<p style="text-align: center; color: var(--danger-color);">No student results found on the server to analyze.</p>';
            }
        });
    }
});

// **MODIFIED**: This function now tracks incorrect counts per SET *and* per TEST
function calculateIncorrectFrequencies(results, scheduledTests) {
    // Structure: { TestID: { Set: { CompositeQID: { data... } } } }
    const incorrectCounts = {}; 

    results.forEach(result => {
        const set = result.set;
        const testId = result.testId;
        
        const currentTest = scheduledTests.find(t => t.id === testId);
        if (!currentTest || !currentTest.questions || !currentTest.questions[set]) return;
        const testQuestions = currentTest.questions[set];

        // Initialize structure for this test/set combination if it doesn't exist
        if (!incorrectCounts[testId]) {
            incorrectCounts[testId] = { A: {}, B: {}, C: {} };
        }
        
        for (const shuffledIndex in result.userAnswers) {
            const userAnswer = result.userAnswers[shuffledIndex]; 
            const originalQIndex = result.questionMap[shuffledIndex]; 
            const question = testQuestions[originalQIndex];

            const optionMap = result.optionMaps[shuffledIndex];
            const originalUserAnswer = optionMap ? optionMap[userAnswer] : userAnswer;

            if (userAnswer && originalUserAnswer !== question.correctAnswer) {
                // Key is the question's original ID/Index within the set
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

    // Flatten and sort the data for display, grouped by Test, then Set
    const sortedIncorrectData = [];
    for (const testId in incorrectCounts) {
        for (const set in incorrectCounts[testId]) {
             // Sort questions within this set/test by incorrect count
            const sortedQuestions = Object.values(incorrectCounts[testId][set]).sort((a, b) => b.count - a.count);
            sortedIncorrectData.push(...sortedQuestions);
        }
    }
    
    return sortedIncorrectData;
}


function displayTopIncorrectQuestions(topIncorrectData) {
    const container = document.getElementById('incorrect-list-container');
    container.innerHTML = ''; 
    
    if (topIncorrectData.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #666;">No incorrect attempts recorded across all tests.</p>';
        return;
    }

    // Group the data by Test Title for cleaner display
    const groupedByTest = topIncorrectData.reduce((acc, q) => {
        const key = `${q.testTitle} (ID: ${q.testId})`;
        if (!acc[key]) acc[key] = [];
        acc[key].push(q);
        return acc;
    }, {});
    
    // Display each test's incorrect questions separately
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
            const previewText = q.text.length > 60 ? q.text.substring(0, 60) + '...' : q.text;

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


// --- 12. Initial Setup and Navigation Fix ---

document.getElementById('home-link').addEventListener('click', (e) => {
    e.preventDefault();
    
    const isQuizActive = !document.getElementById('quiz-screen').classList.contains('hidden-section');
    
    if (isQuizActive) {
        if (!confirm('Aapka test abhi chal raha hai. Kya aap sach mein Home screen par jaana chahte hain? Aisa karne par test **automatically submit/end** ho jayega.')) {
            return; 
        }
        submitTest(); 
        return;
    }
    
    showScreen('home-screen');
    checkResumeOption();
    updateHomePageData();
});

document.getElementById('admin-link').addEventListener('click', (e) => {
    e.preventDefault();
    showScreen('admin-login-screen');
});


document.addEventListener('DOMContentLoaded', () => {
    updateHomePageData();
    checkResumeOption();
    updateLiveDate(); 
});
