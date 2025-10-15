// --- J P A Test Website - script.js (V4 - Home Page Feature) ---

// --- 1. Global Variables and Initial Data Setup ---

const ADMIN_USER = 'admin';
const ADMIN_PASS = 'admin123';
const DEFAULT_Q_TIME_SEC = 900; // 15 minutes

let studentName = '';
let currentSet = '';
let currentQuestionIndex = 0; 
let userAnswers = {}; 
let currentQuestionMap = [];
let currentOptionMaps = {}; 

let quizTimerInterval;
let quizRemainingTime = DEFAULT_Q_TIME_SEC;
let currentEditingSet = '';

let studentResults = []; 

// Function to create a dummy question object
function createDummyQuestion(index, set) {
    return {
        id: `${set}-${index + 1}-${Date.now()}`, 
        questionNo: index + 1,
        text: `Dummy Question ${index + 1} for Set ${set}. (Change me in Admin Panel)`,
        imageURL: '', 
        options: ['Option A', 'Option B', 'Option C', 'Option D'],
        correctAnswer: 'A' 
    };
}

// Load Data from Local Storage
let questionsData = JSON.parse(localStorage.getItem('questionsData')) || {
    A: Array.from({ length: 40 }, (_, i) => createDummyQuestion(i, 'A')),
    B: Array.from({ length: 40 }, (_, i) => createDummyQuestion(i, 'B')),
    C: Array.from({ length: 40 }, (_, i) => createDummyQuestion(i, 'C')),
};

let adminSettings = JSON.parse(localStorage.getItem('adminSettings')) || {
    quizTime: DEFAULT_Q_TIME_SEC,
    positiveMark: 1, 
    negativeMark: 0, 
};

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
        return data.record.results || [];
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
updateLiveDate();

// --- 4. Quiz Progress Save/Resume Logic ---

function saveQuizProgress() {
    const progress = {
        name: studentName,
        set: currentSet,
        index: currentQuestionIndex,
        answers: userAnswers,
        time: quizRemainingTime,
        map: currentQuestionMap,
        optionMaps: currentOptionMaps 
    };
    localStorage.setItem('jpaQuizProgress', JSON.stringify(progress));
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
    if (progress && progress.time > 0 && questionsData[progress.set]) {
        resumeBtn.classList.remove('hidden-section');
    } else {
        resumeBtn.classList.add('hidden-section');
        localStorage.removeItem('jpaQuizProgress'); 
    }
}

document.getElementById('resume-btn').addEventListener('click', () => {
    const progress = loadQuizProgress();
    if (!progress) return;

    studentName = progress.name;
    currentSet = progress.set;
    currentQuestionIndex = progress.index;
    userAnswers = progress.answers;
    quizRemainingTime = progress.time;
    currentQuestionMap = progress.map;
    currentOptionMaps = progress.optionMaps; 

    document.getElementById('quiz-welcome-heading').textContent = `Welcome Back, ${studentName} (Set ${currentSet})`;
    startQuiz(true); 
});

// --- NEW: Home Page Initialization Logic ---

function updateHomePageData() {
    // 1. Update Rules Summary Card
    document.getElementById('summary-time').textContent = adminSettings.quizTime / 60;
    document.getElementById('summary-pos-mark').textContent = adminSettings.positiveMark;
    document.getElementById('summary-neg-mark').textContent = adminSettings.negativeMark;

    // 2. Update Set Buttons with Q-Count
    document.querySelectorAll('.set-btn').forEach(button => {
        const set = button.getAttribute('data-set');
        const qCount = questionsData[set] ? questionsData[set].length : 0;
        button.textContent = `Set ${set} (${qCount} Questions)`;
    });
}

// 3. Toggle detailed rules
document.getElementById('show-detailed-rules').addEventListener('click', () => {
    const detailed = document.getElementById('detailed-rules-text');
    detailed.classList.toggle('hidden-section');
    document.getElementById('show-detailed-rules').textContent = detailed.classList.contains('hidden-section') 
        ? 'Read Detailed Instructions 📖' 
        : 'Hide Instructions ⬆️';
});

// --- 5. Home Screen Logic ---

document.querySelectorAll('.set-btn').forEach(button => {
    button.addEventListener('click', (e) => {
        studentName = document.getElementById('student-name').value.trim();
        if (studentName.length < 3) {
            alert("Kripya apna pura naam dalen (Please enter your full name).");
            return;
        }

        currentSet = e.target.getAttribute('data-set');
        if (questionsData[currentSet].length === 0) {
            alert(`Set ${currentSet} mein koi questions nahi hain. Kripya Admin se sampark karein.`);
            return;
        }

        currentQuestionIndex = 0;
        userAnswers = {}; 
        quizRemainingTime = adminSettings.quizTime; 
        currentOptionMaps = {}; 

        document.getElementById('quiz-welcome-heading').textContent = `Welcome, ${studentName} (Set ${currentSet})`;

        const qCount = questionsData[currentSet].length;
        currentQuestionMap = Array.from({ length: qCount }, (_, i) => i);
        shuffleArray(currentQuestionMap); 
        
        startQuiz(false); 
    });
});

document.getElementById('back-to-home').addEventListener('click', () => {
    showScreen('home-screen');
    document.getElementById('student-name-result').textContent = ''; 
    document.getElementById('test-set-result').textContent = ''; 
    document.getElementById('student-name').value = ''; 
    checkResumeOption();
    updateHomePageData(); // Update home data when returning
});

// --- 6. Quiz Timer Logic ---

function startQuizTimer() {
    clearInterval(quizTimerInterval);
    const timerDisplay = document.getElementById('quiz-timer');
    
    const initialMinutes = Math.floor(quizRemainingTime / 60);
    const initialSeconds = quizRemainingTime % 60;
    timerDisplay.textContent = `${initialMinutes.toString().padStart(2, '0')}:${initialSeconds.toString().padStart(2, '0')}`;
    timerDisplay.style.color = 'var(--danger-color)'; // Reset to default danger color

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


// --- 7. Quiz Start/Loading Logic ---

function startQuiz(isResuming) {
    const currentQuestions = questionsData[currentSet];
    if (!currentQuestions || currentQuestions.length === 0) {
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

    return shuffledLetters.map((shuffledKey, i) => ({
        shuffledLetter: shuffledKey,
        originalText: originalOptions[i],
        originalLetter: originalLetters[i] 
    }));
}

function loadQuestion(displayIndex) {
    const currentQuestions = questionsData[currentSet];
    const qCount = currentQuestions.length;

    if (displayIndex >= qCount) {
        submitTest();
        return;
    }

    currentQuestionIndex = displayIndex;
    
    const originalIndex = currentQuestionMap[displayIndex]; 
    const question = currentQuestions[originalIndex]; 
    const display = document.getElementById('question-display');
    const imageDisplay = document.getElementById('question-image-display');
    
    const progressPercentage = ((displayIndex + 1) / qCount) * 100;
    document.getElementById('question-progress').style.width = `${progressPercentage}%`;
    document.getElementById('question-counter').textContent = `Q ${displayIndex + 1}/${qCount}`;
    
    imageDisplay.innerHTML = question.imageURL 
        ? `<img src="${question.imageURL}" alt="Question Image" onerror="this.style.display='none';">`
        : '';
        
    const shuffledOptionsData = getShuffledOptions(displayIndex, question.options);

    display.innerHTML = `
        <p class="question-text">Question No. ${displayIndex + 1}: ${question.text}</p>
        <ul class="options-list">
            ${shuffledOptionsData.map((opt, i) => {
                const optionValue = shuffledOptionsData[i].shuffledLetter; 

                return `
                    <li class="option-item" data-display-index="${displayIndex}" data-option="${optionValue}">
                        <span class="option-label">${optionValue}.</span> ${opt.originalText}
                    </li>
                `;
            }).join('')}
        </ul>
    `;
    
    const selected = userAnswers[displayIndex]; 
    if (selected) {
        document.querySelector(`.option-item[data-option="${selected}"]`).classList.add('selected');
    }

    document.querySelectorAll('.option-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const option = e.currentTarget.getAttribute('data-option'); 
            userAnswers[displayIndex] = option; 
            document.querySelectorAll(`.option-item[data-display-index="${displayIndex}"]`).forEach(o => o.classList.remove('selected'));
            e.currentTarget.classList.add('selected');
            saveQuizProgress(); 
            renderQuestionNavGrid(); 
        });
    });

    const nextBtn = document.getElementById('next-submit-btn');
    const prevBtn = document.getElementById('prev-btn');

    prevBtn.disabled = displayIndex === 0;

    if (displayIndex === qCount - 1) {
        nextBtn.textContent = 'Submit';
        nextBtn.classList.add('submit-btn');
    } else {
        nextBtn.textContent = 'Next';
        nextBtn.classList.remove('submit-btn');
    }
    
    renderQuestionNavGrid(); 
}

document.getElementById('next-submit-btn').addEventListener('click', () => {
    const qCount = questionsData[currentSet].length;
    if (currentQuestionIndex === qCount - 1) {
        submitTest();
    } else {
        loadQuestion(currentQuestionIndex + 1);
        saveQuizProgress(); 
    }
});

document.getElementById('prev-btn').addEventListener('click', () => {
    if (currentQuestionIndex > 0) {
        loadQuestion(currentQuestionIndex - 1);
        saveQuizProgress(); 
    }
});

function renderQuestionNavGrid() {
    const gridContainer = document.getElementById('question-nav-grid');
    const qCount = currentQuestionMap.length;
    gridContainer.innerHTML = '';

    for (let i = 0; i < qCount; i++) {
        const btn = document.createElement('button');
        btn.textContent = i + 1;
        btn.classList.add('nav-q-btn');
        btn.setAttribute('data-q-index', i);

        if (i === currentQuestionIndex) {
            btn.classList.add('current');
        } else if (userAnswers[i]) {
            btn.classList.add('attempted');
        } else {
            btn.classList.add('unattempted');
        }

        btn.addEventListener('click', () => {
            loadQuestion(i);
            saveQuizProgress();
        });

        gridContainer.appendChild(btn);
    }
}

async function submitTest() {
    clearInterval(quizTimerInterval);

    const qCount = currentQuestionMap.length;
    let attempted = 0;
    let correctAnswers = 0; 
    let incorrectAnswers = 0;
    let finalScore = 0;

    for (let displayIndex = 0; displayIndex < qCount; displayIndex++) {
        const originalIndex = currentQuestionMap[displayIndex];
        const question = questionsData[currentSet][originalIndex];
        const userAnswer = userAnswers[displayIndex]; 
        
        if (userAnswer) {
            attempted++;
            
            const originalSelectedLetter = currentOptionMaps[displayIndex][userAnswer]; 
            
            if (originalSelectedLetter === question.correctAnswer) {
                correctAnswers++;
                finalScore += adminSettings.positiveMark;
            } else {
                incorrectAnswers++;
                finalScore += adminSettings.negativeMark;
            }
        }
    }

    const nonAttempted = qCount - attempted;
    const maxScore = qCount * adminSettings.positiveMark;
    
    localStorage.removeItem('jpaQuizProgress'); 

    const result = {
        name: studentName,
        set: currentSet,
        date: new Date().toLocaleString(),
        score: finalScore,
        totalQ: qCount,
        attemptedQ: attempted,
        incorrectQ: incorrectAnswers,
        maxScore: maxScore
    };
    
    studentResults.push(result);
    const saved = await saveResultsToServer(); 
    
    if (saved) {
        console.log("Results saved centrally via JSONBin.io");
    } else {
        alert("Warning: Test submitted, but failed to save results centrally. Check your API key/Bin ID.");
    }

    document.getElementById('student-name-result').textContent = studentName;
    document.getElementById('test-set-result').textContent = currentSet;
    document.getElementById('total-q').textContent = qCount;
    document.getElementById('attempted-q').textContent = attempted;
    document.getElementById('incorrect-q').textContent = incorrectAnswers;
    document.getElementById('non-attempted-q').textContent = nonAttempted;
    document.getElementById('final-score').textContent = finalScore;
    document.getElementById('max-score').textContent = maxScore;

    showScreen('result-screen');
}


// --- 8. Admin Panel Logic ---

document.getElementById('admin-link').addEventListener('click', (e) => {
    e.preventDefault();
    if (document.getElementById('admin-panel').classList.contains('hidden-section')) {
        showScreen('admin-login-screen');
    } else {
        showScreen('admin-panel');
    }
});

document.getElementById('home-link').addEventListener('click', (e) => {
    e.preventDefault();
    showScreen('home-screen');
    checkResumeOption();
    updateHomePageData(); // Update home data when navigating
});

document.getElementById('admin-login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const username = document.getElementById('admin-username').value;
    const password = document.getElementById('admin-password').value;

    if (username === ADMIN_USER && password === ADMIN_PASS) {
        showScreen('admin-panel');
        document.getElementById('q-time').value = adminSettings.quizTime;
        document.getElementById('positive-mark').value = adminSettings.positiveMark;
        document.getElementById('negative-mark').value = adminSettings.negativeMark;
        document.getElementById('admin-login-form').reset();
    } else {
        alert('Invalid Login ID or Password');
    }
});

function saveAdminSettings(type) {
    if (type === 'time') {
        const newTime = parseInt(document.getElementById('q-time').value);
        if (newTime >= 60) {
            adminSettings.quizTime = newTime;
            alert(`Quiz Time set to ${newTime} seconds.`);
        } else {
            alert('Time must be at least 60 seconds.');
        }
    } else if (type === 'marking') {
         const posMark = parseInt(document.getElementById('positive-mark').value);
         const negMark = parseInt(document.getElementById('negative-mark').value);
         
         if (posMark > 0) {
            adminSettings.positiveMark = posMark;
            adminSettings.negativeMark = negMark;
            alert(`Marking Scheme set: +${posMark} for Correct, ${negMark} for Incorrect.`);
         } else {
            alert('Positive Mark must be greater than 0.');
         }
    }
    localStorage.setItem('adminSettings', JSON.stringify(adminSettings));
    updateHomePageData(); // Update home page summary after saving
}


// --- 9. Answer Key Editor (CRUD with Image URL) Functions ---

function openAnswerKeyEditor(set) {
    currentEditingSet = set;
    document.getElementById('editing-set-name').textContent = set;
    document.getElementById('answer-key-editor').classList.remove('hidden-section');
    renderAnswerKeyQuestions(set);
}

function closeAnswerKeyEditor() {
    document.getElementById('answer-key-editor').classList.add('hidden-section');
    currentEditingSet = '';
}

function renderAnswerKeyQuestions(set) {
    const container = document.getElementById('questions-list-container');
    const questions = questionsData[set];
    container.innerHTML = ''; 

    if (!questions || questions.length === 0) {
        container.innerHTML = '<p>No questions found for this set. Click "Add New Question" to begin.</p>';
        return;
    }

    questions.forEach((q, index) => {
        const qElement = document.createElement('div');
        qElement.className = 'answer-key-item';
        qElement.innerHTML = `
            <h4 style="margin-top: 10px; color: #303f9f;">Q${index + 1}: Question Text:</h4>
            <textarea id="q-text-${set}-${index}" style="width: 100%; min-height: 60px;">${q.text}</textarea>
            
            <h4 style="margin-top: 10px; color: #303f9f;">Question Image URL (Optional):</h4>
            <input type="text" id="q-image-${set}-${index}" value="${q.imageURL || ''}" placeholder="Paste full image URL here (e.g., from Google Drive/Imgur)">
            
            <h4 style="margin-top: 10px; color: #303f9f;">Options (A, B, C, D):</h4>
            ${q.options.map((opt, i) => `
                <input type="text" id="q-opt-${set}-${index}-${i}" value="${opt}" placeholder="Option ${String.fromCharCode(65 + i)}">
            `).join('')}
            
            <h4 style="margin-top: 10px; color: #303f9f;">Correct Answer (Original Letter):</h4>
            <select id="q-ans-${set}-${index}">
                <option value="A" ${q.correctAnswer === 'A' ? 'selected' : ''}>A</option>
                <option value="B" ${q.correctAnswer === 'B' ? 'selected' : ''}>B</option>
                <option value="C" ${q.correctAnswer === 'C' ? 'selected' : ''}>C</option>
                <option value="D" ${q.correctAnswer === 'D' ? 'selected' : ''}>D</option>
            </select>
            <button class="delete-q-btn" onclick="deleteQuestion(${index})">Delete Q${index + 1}</button>
            <hr style="margin: 15px 0; border-color: #ddd;">
        `;
        container.appendChild(qElement);
    });
}

function addNewQuestion() {
    if (!currentEditingSet) return;
    const questions = questionsData[currentEditingSet];
    const newIndex = questions.length;
    const newQ = createDummyQuestion(newIndex, currentEditingSet); 
    questions.push(newQ);
    renderAnswerKeyQuestions(currentEditingSet);
    alert(`Question ${newIndex + 1} added. Click 'Save Changes' to finalize.`);
}

function deleteQuestion(index) {
    if (!currentEditingSet) return;
    if (confirm(`Are you sure you want to delete Question ${index + 1} from Set ${currentEditingSet}?`)) {
        questionsData[currentEditingSet].splice(index, 1);
        questionsData[currentEditingSet].forEach((q, i) => q.questionNo = i + 1);
        renderAnswerKeyQuestions(currentEditingSet);
        alert(`Question ${index + 1} deleted. Click 'Save Changes' to finalize.`);
    }
}

function saveAnswerKeyChanges() {
    if (!currentEditingSet) return;

    const questions = questionsData[currentEditingSet];
    let changesMade = false;

    questions.forEach((q, index) => {
        const newTextElement = document.getElementById(`q-text-${currentEditingSet}-${index}`);
        const newImageElement = document.getElementById(`q-image-${currentEditingSet}-${index}`);
        const newAnswerElement = document.getElementById(`q-ans-${currentEditingSet}-${index}`);

        const newText = newTextElement.value.trim();
        if (newText !== q.text) {
            q.text = newText;
            changesMade = true;
        }
        
        const newImageURL = newImageElement.value.trim();
        if (newImageURL !== q.imageURL) {
            q.imageURL = newImageURL;
            changesMade = true;
        }
        
        let newOptions = [];
        for (let i = 0; i < 4; i++) {
            const optElement = document.getElementById(`q-opt-${currentEditingSet}-${index}-${i}`);
            newOptions.push(optElement.value);
            if (optElement.value !== q.options[i]) {
                changesMade = true;
            }
        }
        q.options = newOptions;

        const newAnswer = newAnswerElement.value;
        if (newAnswer !== q.correctAnswer) {
            q.correctAnswer = newAnswer;
            changesMade = true;
        }
    });

    if (changesMade) {
        localStorage.setItem('questionsData', JSON.stringify(questionsData));
        alert(`Answer Key and Questions for Set ${currentEditingSet} saved successfully!`);
        updateHomePageData(); // Update home data after question change
    } else {
        alert("No changes were detected.");
    }
    
    closeAnswerKeyEditor();
}

// --- New: Import/Export Utility Functions ---

function exportQuestionsData() {
    const dataStr = JSON.stringify(questionsData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

    const exportFileName = 'jpa_question_bank_backup.json';

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileName);
    linkElement.click();
    alert("Question data exported successfully as JSON file.");
}

function importQuestionsData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const importedData = JSON.parse(e.target.result);
            if (importedData.A && importedData.B && importedData.C && Array.isArray(importedData.A)) {
                
                if (confirm("Are you sure you want to overwrite all existing question data with the imported JSON?")) {
                    questionsData = importedData;
                    localStorage.setItem('questionsData', JSON.stringify(questionsData));
                    alert("Question data imported successfully! Changes will be active immediately.");
                    document.getElementById('import-file-input').value = '';
                    updateHomePageData(); // Update home data after import
                }
            } else {
                alert("Import failed: The file format is invalid. It must contain A, B, and C set arrays.");
            }
        } catch (error) {
            alert("Import failed: Could not parse JSON file.");
            console.error("Import Error:", error);
        }
    };
    reader.readAsText(file);
}


// --- 10. Admin Result Table Logic ---

const resultSection = document.getElementById('student-result-section');
document.getElementById('student-result-btn').addEventListener('click', async () => {
    resultSection.classList.toggle('hidden-section');
    if (!resultSection.classList.contains('hidden-section')) {
        studentResults = await fetchResultsFromServer(); 
        renderResultsTable(studentResults);
    }
});

document.getElementById('student-search').addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const filteredResults = studentResults.filter(r => 
        r.name.toLowerCase().includes(searchTerm)
    );
    renderResultsTable(filteredResults);
});

function renderResultsTable(results) {
    const tableBody = document.getElementById('result-table-body');
    tableBody.innerHTML = ''; 

    if (results.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No results found.</td></tr>';
        return;
    }

    results.forEach(result => {
        const row = tableBody.insertRow();
        row.insertCell().textContent = result.name;
        row.insertCell().textContent = result.set;
        row.insertCell().textContent = result.date;
        row.insertCell().textContent = `${result.score} / ${result.maxScore}`;
    });
}

document.getElementById('clear-data-btn').addEventListener('click', async () => {
    if (confirm("Are you sure you want to clear ALL student results? This action is permanent.")) {
        studentResults = [];
        const cleared = await saveResultsToServer();
        
        if (cleared) {
            renderResultsTable(studentResults);
            alert("All student data cleared from server.");
        } else {
            alert("Failed to clear data on the server.");
        }
    }
});

document.getElementById('download-data-btn').addEventListener('click', () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Student Name,Set,Date,Total Questions,Attempted,Incorrect,Score,Max Score\n";
    
    studentResults.forEach(result => {
        const row = [
            `"${result.name.replace(/"/g, '""')}"`, 
            result.set,
            `"${result.date}"`,
            result.totalQ,
            result.attemptedQ,
            result.incorrectQ,
            result.score,
            result.maxScore
        ].join(',');
        csvContent += row + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', "JPA_Student_Results.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    alert("Results downloaded as CSV.");
});


// --- 11. Initialization ---

async function initializeApp() {
    checkResumeOption(); 
    updateHomePageData(); // Load all home page data on startup
    showScreen('home-screen');
}

initializeApp();
