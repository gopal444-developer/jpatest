// --- J P A Test Website - script.js (JSONBin.io Integrated Version) ---
// Note: Is code mein aapka data centralized server (JSONBin.io) par save hoga.

// --- 1. Global Variables and Initial Data Setup ---

const ADMIN_USER = 'admin';
const ADMIN_PASS = 'admin123';
const DEFAULT_Q_COUNT = 40;
const DEFAULT_Q_TIME_SEC = 900; // 15 minutes
const Q_MARK = 1;

let studentName = '';
let currentSet = '';
let currentQuestionIndex = 0;
let userAnswers = {};
let quizTimerInterval;
let quizRemainingTime = DEFAULT_Q_TIME_SEC;
let currentEditingSet = '';

// Student results ab server se load honge.
let studentResults = []; 

// Function to create a dummy question object
function createDummyQuestion(index, set) {
    return {
        questionNo: index + 1,
        text: `Dummy Question ${index + 1} for Set ${set}. (Change me in Admin Panel)`,
        options: ['Option A', 'Option B', 'Option C', 'Option D'],
        correctAnswer: 'A' 
    };
}

// Load Questions and Admin settings from Local Storage 
let questionsData = JSON.parse(localStorage.getItem('questionsData')) || {
    A: Array.from({ length: DEFAULT_Q_COUNT }, (_, i) => createDummyQuestion(i, 'A')),
    B: Array.from({ length: DEFAULT_Q_COUNT }, (_, i) => createDummyQuestion(i, 'B')),
    C: Array.from({ length: DEFAULT_Q_COUNT }, (_, i) => createDummyQuestion(i, 'C')),
};

let adminSettings = JSON.parse(localStorage.getItem('adminSettings')) || {
    questionCount: DEFAULT_Q_COUNT,
    quizTime: DEFAULT_Q_TIME_SEC,
};


// --- 2. JSONBin API Functions (Centralized Data Handling) ---

// Data ko server se fetch karne ka function
async function fetchResultsFromServer() {
    try {
        const response = await fetch(JSONBIN_URL, {
            method: 'GET',
            headers: {
                'X-Master-Key': JSONBIN_API_KEY,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch: ${response.statusText}`);
        }

        const data = await response.json();
        // Server se 'results' array nikalenge
        return data.record.results || [];
    } catch (error) {
        console.error("Error fetching results:", error);
        alert("Results server se load nahi ho paye. Kripya console mein error dekhein.");
        return [];
    }
}

// Naye result ko server par save (update) karne ka function
async function saveResultsToServer() {
    try {
        const response = await fetch(JSONBIN_URL, {
            method: 'PUT', // PUT method to replace the entire data
            headers: {
                'X-Master-Key': JSONBIN_API_KEY,
                'Content-Type': 'application/json',
                'X-Bin-Versioning': 'false' 
            },
            // Pure studentResults array ko JSONBin ke andar { results: [...] } structure mein bhejna
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


// --- 3. Utility Functions (Show/Hide Screens & Date) ---

function showScreen(screenId) {
    document.querySelectorAll('section').forEach(section => {
        section.classList.add('hidden-section');
    });
    document.getElementById(screenId).classList.remove('hidden-section');

    // Update Navbar Active state
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


// --- 4. Home Screen Logic ---

document.querySelectorAll('.set-btn').forEach(button => {
    button.addEventListener('click', (e) => {
        studentName = document.getElementById('student-name').value.trim();
        if (studentName.length < 3) {
            alert("Kripya apna pura naam dalen (Please enter your full name).");
            return;
        }

        currentSet = e.target.getAttribute('data-set');
        currentQuestionIndex = 0;
        userAnswers = {}; 
        quizRemainingTime = adminSettings.quizTime; 

        document.getElementById('quiz-welcome-heading').textContent = `Welcome to Set ${currentSet}`;

        startQuiz();
    });
});

document.getElementById('back-to-home').addEventListener('click', () => {
    showScreen('home-screen');
    document.getElementById('student-name').value = ''; 
});


// --- 5. Quiz Logic ---

function startQuiz() {
    const currentQuestions = questionsData[currentSet];
    if (!currentQuestions || currentQuestions.length === 0) {
        alert(`Set ${currentSet} mein koi questions nahi hain. Kripya Admin se check karwayein.`);
        showScreen('home-screen');
        return;
    }
    
    // Set question count based on the actual array length
    adminSettings.questionCount = currentQuestions.length;
    
    showScreen('quiz-screen');
    loadQuestion(currentQuestionIndex);
    startQuizTimer();
}

function loadQuestion(index) {
    const currentQuestions = questionsData[currentSet];
    const qCount = currentQuestions.length;

    if (index >= qCount) {
        submitTest();
        return;
    }

    currentQuestionIndex = index;
    const question = currentQuestions[index]; 
    const display = document.getElementById('question-display');
    
    display.innerHTML = `
        <p class="question-text">Question No. ${question.questionNo}: ${question.text}</p>
        <ul class="options-list">
            ${question.options.map((opt, i) => `
                <li class="option-item" data-option="${String.fromCharCode(65 + i)}">
                    <span class="option-label">${String.fromCharCode(65 + i)}.</span> ${opt}
                </li>
            `).join('')}
        </ul>
    `;
    
    const selected = userAnswers[index];
    if (selected) {
        document.querySelector(`.option-item[data-option="${selected}"]`).classList.add('selected');
    }

    document.querySelectorAll('.option-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const option = e.currentTarget.getAttribute('data-option');
            userAnswers[index] = option;
            document.querySelectorAll('.option-item').forEach(o => o.classList.remove('selected'));
            e.currentTarget.classList.add('selected');
        });
    });

    const nextBtn = document.getElementById('next-submit-btn');
    const prevBtn = document.getElementById('prev-btn');

    prevBtn.disabled = index === 0;

    if (index === qCount - 1) {
        nextBtn.textContent = 'Submit';
        nextBtn.classList.add('submit-btn');
    } else {
        nextBtn.textContent = 'Next';
        nextBtn.classList.remove('submit-btn');
    }
}

document.getElementById('next-submit-btn').addEventListener('click', () => {
    const qCount = questionsData[currentSet].length;
    if (currentQuestionIndex === qCount - 1) {
        submitTest();
    } else {
        loadQuestion(currentQuestionIndex + 1);
    }
});

document.getElementById('prev-btn').addEventListener('click', () => {
    if (currentQuestionIndex > 0) {
        loadQuestion(currentQuestionIndex - 1);
    }
});

function startQuizTimer() {
    clearInterval(quizTimerInterval);
    const timerDisplay = document.getElementById('quiz-timer');

    quizTimerInterval = setInterval(() => {
        if (quizRemainingTime <= 0) {
            clearInterval(quizTimerInterval);
            alert("Time's up! Your test will now be submitted automatically.");
            submitTest();
            return;
        }

        quizRemainingTime--;
        const minutes = Math.floor(quizRemainingTime / 60);
        const seconds = quizRemainingTime % 60;
        timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }, 1000);
}


// --- 6. Submission and Result Logic (Server Save) ---

async function submitTest() {
    clearInterval(quizTimerInterval);

    const currentQuestions = questionsData[currentSet];
    const totalQuestions = currentQuestions.length;
    let attempted = 0;
    let correctAnswers = 0; 

    for (let i = 0; i < totalQuestions; i++) {
        const userAnswer = userAnswers[i];
        if (userAnswer) {
            attempted++;
            if (userAnswer === currentQuestions[i].correctAnswer) {
                correctAnswers += Q_MARK;
            }
        }
    }

    const nonAttempted = totalQuestions - attempted;
    const maxScore = totalQuestions * Q_MARK;

    // Save Result
    const result = {
        name: studentName,
        set: currentSet,
        date: new Date().toLocaleString(),
        score: correctAnswers,
        totalQ: totalQuestions,
        attemptedQ: attempted,
        nonAttemptedQ: nonAttempted,
    };
    
    // --- Centralized Save Logic ---
    studentResults.push(result);
    const saved = await saveResultsToServer(); 
    
    if (saved) {
        console.log("Results saved centrally via JSONBin.io");
    } else {
        alert("Warning: Test submitted, but failed to save results centrally. Check your API key/Bin ID.");
    }
    // --- End Centralized Save Logic ---

    // Display Result
    document.getElementById('total-q').textContent = totalQuestions;
    document.getElementById('attempted-q').textContent = attempted;
    document.getElementById('non-attempted-q').textContent = nonAttempted;
    document.getElementById('final-score').textContent = correctAnswers;
    document.getElementById('max-score').textContent = maxScore;

    showScreen('result-screen');
}


// --- 7. Admin Panel Logic ---

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
});

document.getElementById('admin-login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const username = document.getElementById('admin-username').value;
    const password = document.getElementById('admin-password').value;

    if (username === ADMIN_USER && password === ADMIN_PASS) {
        showScreen('admin-panel');
        document.getElementById('q-quantity').value = adminSettings.questionCount;
        document.getElementById('q-time').value = adminSettings.quizTime;
        document.getElementById('admin-login-form').reset();
    } else {
        alert('Invalid Login ID or Password');
    }
});

function saveAdminSettings(type) {
    if (type === 'quantity') {
        const newCount = parseInt(document.getElementById('q-quantity').value);
        if (newCount > 0) {
            ['A', 'B', 'C'].forEach(set => {
                const currentQuestions = questionsData[set] || [];
                if (newCount > currentQuestions.length) {
                    for (let i = currentQuestions.length; i < newCount; i++) {
                        currentQuestions.push(createDummyQuestion(i, set));
                    }
                } else if (newCount < currentQuestions.length) {
                    currentQuestions.splice(newCount);
                }
            });

            adminSettings.questionCount = newCount;
            localStorage.setItem('questionsData', JSON.stringify(questionsData)); 
            alert(`Question Quantity set to ${newCount} for all sets.`);
        }
    } else if (type === 'time') {
        const newTime = parseInt(document.getElementById('q-time').value);
        if (newTime >= 60) {
            adminSettings.quizTime = newTime;
            alert(`Quiz Time set to ${newTime} seconds.`);
        } else {
             alert('Time must be at least 60 seconds.');
        }
    }
    localStorage.setItem('adminSettings', JSON.stringify(adminSettings));
}


// --- 8. Answer Key Editor Functions ---

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
        container.innerHTML = '<p>No questions found for this set. Please set the quantity first.</p>';
        return;
    }

    questions.forEach((q, index) => {
        const qElement = document.createElement('div');
        qElement.className = 'answer-key-item';
        qElement.innerHTML = `
            <h4 style="margin-top: 10px; color: #303f9f;">Q${q.questionNo}. Question Text:</h4>
            <input type="text" id="q-text-${set}-${index}" value="${q.text}" style="width: 90%;">
            
            <h4 style="margin-top: 10px; color: #303f9f;">Correct Answer:</h4>
            <select id="q-ans-${set}-${index}">
                <option value="A" ${q.correctAnswer === 'A' ? 'selected' : ''}>A</option>
                <option value="B" ${q.correctAnswer === 'B' ? 'selected' : ''}>B</option>
                <option value="C" ${q.correctAnswer === 'C' ? 'selected' : ''}>C</option>
                <option value="D" ${q.correctAnswer === 'D' ? 'selected' : ''}>D</option>
            </select>
            <hr style="margin: 15px 0;">
        `;
        container.appendChild(qElement);
    });
}

function saveAnswerKeyChanges() {
    if (!currentEditingSet) return;

    const questions = questionsData[currentEditingSet];
    let changesMade = false;

    questions.forEach((q, index) => {
        const newTextElement = document.getElementById(`q-text-${currentEditingSet}-${index}`);
        const newAnswerElement = document.getElementById(`q-ans-${currentEditingSet}-${index}`);

        if (newTextElement && newAnswerElement) {
            const newText = newTextElement.value.trim();
            const newAnswer = newAnswerElement.value;

            if (newText !== q.text || newAnswer !== q.correctAnswer) {
                q.text = newText;
                q.correctAnswer = newAnswer;
                changesMade = true;
            }
        }
    });

    if (changesMade) {
        localStorage.setItem('questionsData', JSON.stringify(questionsData));
        alert(`Answer Key and Questions for Set ${currentEditingSet} saved successfully! (Changes will be live immediately)`);
    } else {
        alert("No changes were detected.");
    }
    
    closeAnswerKeyEditor();
}


// --- 9. Admin Result Table Logic (Server Load/Clear) ---

const resultSection = document.getElementById('student-result-section');
document.getElementById('student-result-btn').addEventListener('click', async () => {
    resultSection.classList.toggle('hidden-section');
    if (!resultSection.classList.contains('hidden-section')) {
        // Naya: Server se results load karein
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
        row.insertCell().textContent = `${result.score} / ${result.totalQ}`;
    });
}

document.getElementById('clear-data-btn').addEventListener('click', async () => {
    if (confirm("Are you sure you want to clear ALL student results? This action is permanent.")) {
        studentResults = [];
        
        // Naya: Server par empty array save karein
        const cleared = await saveResultsToServer();
        
        if (cleared) {
            renderResultsTable(studentResults);
            alert("All student data cleared from server.");
        } else {
            alert("Failed to clear data on the server.");
        }
    }
});


// --- 10. Initialization ---

// App shuru karein
async function initializeApp() {
    // Other local settings will load, but results will be empty until Admin clicks 'Student Result' button.
    showScreen('home-screen');
}

initializeApp();