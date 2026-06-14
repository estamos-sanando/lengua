// ==========================================================================
//  Global Configuration & State
// ==========================================================================
const CLASSES = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z", "Ñ"];

const SIGN_GUIDE = {
    "A": "Puno cerrado, pulgar al costado",
    "B": "4 dedos juntos arriba, pulgar doblado",
    "C": "Mano curvada como letra C",
    "D": "Indice recto, resto curvo tocando pulgar",
    "E": "Dedos doblados, pulgar debajo",
    "F": "Indice y pulgar se tocan, resto arriba",
    "G": "Indice y pulgar apuntan al costado",
    "H": "Indice y medio juntos apuntan al costado",
    "I": "Solo menique arriba",
    "J": "Menique arriba + movimiento curvo",
    "K": "Indice arriba, medio diagonal, pulgar entre ellos",
    "L": "Indice arriba + pulgar al costado",
    "M": "3 dedos sobre el pulgar",
    "N": "2 dedos sobre el pulgar",
    "Ñ": "N + movimiento de muneca oscilante",
    "O": "Todos los dedos forman un circulo",
    "P": "K apuntando hacia abajo",
    "Q": "G apuntando hacia abajo",
    "R": "Indice y medio cruzados",
    "S": "Puno cerrado, pulgar sobre los dedos",
    "T": "Puno, pulgar entre indice y medio",
    "U": "Indice y medio juntos arriba",
    "V": "Indice y medio separados (victoria)",
    "W": "Indice, medio y anular abiertos",
    "X": "Indice doblado como gancho",
    "Y": "Pulgar y menique extendidos",
    "Z": "Indice traza Z en el aire"
};

const SPANISH_WORDS = [
    "HOLA", "ADIOS", "GRACIAS", "POR", "FAVOR", "SI", "NO",
    "COMO", "ESTAS", "BIEN", "MAL", "NOMBRE", "ME", "LLAMO",
    "AYUDA", "AGUA", "CASA", "FAMILIA", "AMIGO", "DIA", "NOCHE",
    "HOY", "MAÑANA", "TARDE", "QUE", "DONDE", "CUANDO", "QUIEN",
    "MUCHO", "POCO", "TODO", "NADA", "AMOR", "TRABAJO", "TIEMPO"
];

// Connection lines for rendering hand skeleton
const HAND_CONNECTIONS = [
    [0, 1], [1, 2], [2, 3], [3, 4],       // Thumb
    [0, 5], [5, 6], [6, 7], [7, 8],       // Index
    [0, 9], [9, 10], [10, 11], [11, 12],  // Middle
    [0, 13], [13, 14], [14, 15], [15, 16],// Ring
    [0, 17], [17, 18], [18, 19], [19, 20],// Pinky
    [5, 9], [9, 13], [13, 17]             // Palm
];

let session = null;
let currentLetter = "-";
let currentConfidence = 0.0;
let predictionBuffer = [];
const BUFFER_SIZE = 8;                 // Reducido de 15 a 8 para reaccionar al instante
const STABILITY_THRESHOLD = 0.60;      // Reducido a 60% (basta con 5/8 frames)
const CONFIDENCE_THRESHOLD = 0.80;     // Incrementado a 80% de confianza para mayor precisión
let lastAddedLetter = null;            // Control de duplicados automático
let noHandFrames = 0;                  // Contador para reiniciar lastAddedLetter al retirar la mano

let currentWord = [];
let phrase = [];
let suggestion = null;

let isFrontCamera = true;
let activeStream = null;
let cameraHelper = null;
let handsDetector = null;

// ==========================================================================
//  Initialization
// ==========================================================================
document.addEventListener("DOMContentLoaded", async () => {
    setupUIListeners();
    buildGuideGrid();
    await initAIModel();
    await initWebcam();
});

// ==========================================================================
//  AI Model Loader (ONNX Runtime Web)
// ==========================================================================
async function initAIModel() {
    const statusText = document.getElementById("loading-status");
    try {
        statusText.innerText = "Cargando Red Neuronal...";
        // Load the ONNX model from the server
        session = await ort.InferenceSession.create("modelo_abecedario.onnx");
        console.log("ONNX model loaded successfully.");
        
        statusText.innerText = "Cargando MediaPipe Hands...";
        initMediaPipe();
    } catch (err) {
        console.error("Failed to load ONNX model:", err);
        statusText.innerText = "Error cargando modelo. Revisa la consola.";
    }
}

// ==========================================================================
//  MediaPipe Hands Setup
// ==========================================================================
function initMediaPipe() {
    handsDetector = new Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    handsDetector.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.75,
        minTrackingConfidence: 0.5
    });

    handsDetector.onResults(onHandResults);
    
    // Hide loading screen once AI parts are configured
    document.getElementById("loading-overlay").classList.add("hidden");
}

// ==========================================================================
//  Webcam Management
// ==========================================================================
async function initWebcam() {
    const video = document.getElementById("webcam");
    
    if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
    }

    const constraints = {
        video: {
            facingMode: isFrontCamera ? "user" : "environment",
            width: { ideal: 640 },
            height: { ideal: 480 }
        },
        audio: false
    };

    try {
        activeStream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = activeStream;
        
        // Setup MediaPipe camera runner helper
        if (cameraHelper) {
            cameraHelper.stop();
        }
        
        cameraHelper = new Camera(video, {
            onFrame: async () => {
                await handsDetector.send({ image: video });
            },
            width: 640,
            height: 480
        });
        cameraHelper.start();
        
    } catch (err) {
        console.error("Camera access failed:", err);
        alert("No se pudo acceder a la cámara. Asegúrate de otorgar los permisos necesarios.");
    }
}

// ==========================================================================
//  Frame Processing & Prediction
// ==========================================================================
async function onHandResults(results) {
    const canvas = document.getElementById("skeleton-canvas");
    const ctx = canvas.getContext("2d");
    
    // Adjust canvas resolution dynamically to match video layout
    if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
    }
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const alertBox = document.getElementById("no-hand-alert");
    
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        alertBox.classList.remove("active");
        const landmarks = results.multiHandLandmarks[0];
        
        // 1. Draw Skeleton
        drawSkeleton(ctx, landmarks, canvas.width, canvas.height);
        
        // 2. Normalize landmarks (Same as utils.py in Python)
        const normalizedInput = normalizeLandmarks(landmarks);
        
        // 3. Inference with ONNX Runtime Web
        if (session) {
            try {
                const tensor = new ort.Tensor("float32", Float32Array.from(normalizedInput), [1, 63]);
                // Keras model input name is "landmarks" (as defined in trainer.py)
                const feeds = { "landmarks": tensor };
                const outputs = await session.run(feeds);
                
                // Keras model output node name is "prediction" or first output node
                const outputKey = Object.keys(outputs)[0];
                const predictions = outputs[outputKey].data;
                
                // Get letter with maximum probability
                let bestIdx = 0;
                let maxVal = -1;
                for (let i = 0; i < predictions.length; i++) {
                    if (predictions[i] > maxVal) {
                        maxVal = predictions[i];
                        bestIdx = i;
                    }
                }
                
                updateDetectionHUD(CLASSES[bestIdx], maxVal);
                
            } catch (err) {
                console.error("Inference failed:", err);
            }
        }
    } else {
        alertBox.classList.add("active");
        updateDetectionHUD("-", 0.0);
    }
}

// Draw skeleton on the overlay canvas
function drawSkeleton(ctx, landmarks, w, h) {
    // 1. Draw connection lines
    ctx.strokeStyle = "#00e676";
    ctx.lineWidth = 3;
    ctx.shadowBlur = 4;
    ctx.shadowColor = "rgba(0, 230, 118, 0.4)";
    
    for (const [a, b] of HAND_CONNECTIONS) {
        const ptA = landmarks[a];
        const ptB = landmarks[b];
        ctx.beginPath();
        ctx.moveTo(ptA.x * w, ptA.y * h);
        ctx.lineTo(ptB.x * w, ptB.y * h);
        ctx.stroke();
    }
    
    // 2. Draw nodes
    ctx.shadowBlur = 6;
    ctx.shadowColor = "rgba(148, 255, 0, 0.6)";
    
    for (let i = 0; i < landmarks.length; i++) {
        const pt = landmarks[i];
        ctx.fillStyle = "#94ff00";
        ctx.beginPath();
        ctx.arc(pt.x * w, pt.y * h, i === 0 ? 6 : 4, 0, 2 * Math.PI);
        ctx.fill();
    }
    
    // reset shadow
    ctx.shadowBlur = 0;
}

// Normalization logic equivalent to python utils.py normalize_landmarks
function normalizeLandmarks(landmarks) {
    const wrist = landmarks[0];
    
    // Subtract wrist coordinates
    const pts = landmarks.map(lm => [
        lm.x - wrist.x,
        lm.y - wrist.y,
        lm.z - wrist.z
    ]);
    
    // Find maximum absolute value among all dimensions
    let maxDist = 0;
    for (let i = 0; i < pts.length; i++) {
        for (let j = 0; j < 3; j++) {
            const absVal = Math.abs(pts[i][j]);
            if (absVal > maxDist) {
                maxDist = absVal;
            }
        }
    }
    maxDist += 1e-8;
    
    // Scale and flatten
    const flat = [];
    for (let i = 0; i < pts.length; i++) {
        flat.push(pts[i][0] / maxDist);
        flat.push(pts[i][1] / maxDist);
        flat.push(pts[i][2] / maxDist);
    }
    return flat;
}

// Update UI with detection details and temporal stability filter
function updateDetectionHUD(letter, conf) {
    const letterDiv = document.getElementById("current-letter");
    const confValDiv = document.getElementById("confidence-percentage");
    const confBar = document.getElementById("confidence-bar");
    
    if (letter === "-") {
        letterDiv.innerText = "-";
        confValDiv.innerText = "0%";
        confBar.style.width = "0%";
        currentLetter = "-";
        currentConfidence = 0.0;
        predictionBuffer = []; // Clear buffer if hand is lost
        
        noHandFrames++;
        if (noHandFrames > 5) {
            lastAddedLetter = null; // Permitir deletrear la misma letra de nuevo al retirar la mano
        }
        return;
    }

    noHandFrames = 0; // Mano detectada, reiniciar contador de ausencia

    // Add prediction to buffer for stability
    predictionBuffer.push(conf >= CONFIDENCE_THRESHOLD ? letter : null);
    if (predictionBuffer.length > BUFFER_SIZE) {
        predictionBuffer.shift();
    }

    // Calculate most frequent letter in buffer
    const counts = {};
    let maxCount = 0;
    let stableLetter = "-";
    
    predictionBuffer.forEach(l => {
        if (l) {
            counts[l] = (counts[l] || 0) + 1;
            if (counts[l] > maxCount) {
                maxCount = counts[l];
                stableLetter = l;
            }
        }
    });

    const ratio = maxCount / BUFFER_SIZE;
    
    if (stableLetter !== "-" && ratio >= STABILITY_THRESHOLD) {
        currentLetter = stableLetter;
        currentConfidence = conf;
        
        letterDiv.innerText = currentLetter;
        letterDiv.style.color = "#94ff00";

        // AUTO-CONFIRMACIÓN (Añadir automáticamente si es una letra nueva)
        if (currentLetter !== lastAddedLetter) {
            currentWord.push(currentLetter);
            updateWordDisplay();
            lastAddedLetter = currentLetter;
            
            // Efecto visual de destello neón en la tarjeta de detección
            const letterCard = document.querySelector(".detected-letter-card");
            if (letterCard) {
                letterCard.style.boxShadow = "0 0 25px rgba(148, 255, 0, 0.8)";
                letterCard.style.borderColor = "var(--accent)";
                setTimeout(() => {
                    letterCard.style.boxShadow = "";
                    letterCard.style.borderColor = "";
                }, 350);
            }
            triggerHapticFeedback();
        }
    } else {
        // Unstable, but show current frame candidate in dim color
        letterDiv.innerText = letter;
        letterDiv.style.color = "#62627a";
        currentLetter = "-";
    }

    // Update confidence bar UI
    const pct = Math.round(conf * 100);
    confValDiv.innerText = `${pct}%`;
    confBar.style.width = `${pct}%`;
    
    if (conf > 0.75) {
        confBar.style.backgroundColor = "#00e676"; // success
    } else if (conf > 0.5) {
        confBar.style.backgroundColor = "#ffb300"; // warning
    } else {
        confBar.style.backgroundColor = "#ff1744"; // danger
    }
}

// ==========================================================================
//  Spelling and Lexicon Logic
// ==========================================================================
function addCurrentLetter() {
    if (currentLetter === "-") return;
    
    currentWord.push(currentLetter);
    updateWordDisplay();
    triggerHapticFeedback();
}

function backspaceWord() {
    if (currentWord.length > 0) {
        currentWord.pop();
        updateWordDisplay();
        triggerHapticFeedback();
    }
}

function clearSpelling() {
    currentWord = [];
    phrase = [];
    suggestion = null;
    updateWordDisplay();
    document.getElementById("phrase-display").innerText = "Tu frase aparecerá aquí...";
    document.getElementById("phrase-display").classList.remove("active");
    document.getElementById("btn-speak-phrase").disabled = true;
    triggerHapticFeedback();
}

function updateWordDisplay() {
    const disp = document.getElementById("word-display");
    const wordStr = currentWord.join("");
    
    disp.innerText = wordStr ? wordStr : "· · ·";
    disp.style.color = wordStr ? "#fff" : "#62627a";
    
    // Spell check
    if (wordStr) {
        suggestion = getAutocorrectSuggestion(wordStr);
        const suggBox = document.getElementById("suggestion-box");
        const suggText = document.getElementById("suggestion-text");
        
        if (suggestion) {
            suggText.innerText = suggestion;
            suggBox.classList.remove("hidden");
        } else {
            suggBox.classList.add("hidden");
        }
    } else {
        document.getElementById("suggestion-box").classList.add("hidden");
    }
}

// Confirm the spelled word, speak it, and add to phrase
function confirmAndSpeakWord() {
    if (currentWord.length === 0) return;
    
    let word = currentWord.join("");
    // Use autocorrect suggestion if available
    if (suggestion) {
        word = suggestion;
    }
    
    phrase.push(word);
    
    // Update phrase card
    const phraseDisplay = document.getElementById("phrase-display");
    phraseDisplay.innerText = phrase.join(" ");
    phraseDisplay.classList.add("active");
    document.getElementById("btn-speak-phrase").disabled = false;
    
    // Trigger TTS
    speakText(word);
    
    // Reset word in progress
    currentWord = [];
    suggestion = null;
    updateWordDisplay();
    triggerHapticFeedback();
}
function speakWholePhrase() {
    if (phrase.length === 0) return;
    speakText(phrase.join(" "));
}

// Mobile-friendly Speech Synthesis
function speakText(text) {
    if (!('speechSynthesis' in window)) return;
    
    window.speechSynthesis.cancel(); // cancel previous speech
    const utterance = new SpeechSynthesisUtterance(text.toLowerCase());
    utterance.lang = "es-ES";
    utterance.rate = 0.95;
    
    // Prefer Spanish voices
    const voices = window.speechSynthesis.getVoices();
    const esVoice = voices.find(v => v.lang.startsWith("es"));
    if (esVoice) {
        utterance.voice = esVoice;
    }
    
    window.speechSynthesis.speak(utterance);
}

// Levenshtein Spell-Checking
function getAutocorrectSuggestion(word) {
    const wUpper = word.toUpperCase();
    if (SPANISH_WORDS.includes(wUpper)) return null;
    
    let bestWord = null;
    let minDistance = 3; // Max distance allowed is 2
    
    for (const dictWord of SPANISH_WORDS) {
        const d = getLevenshteinDistance(wUpper, dictWord);
        if (d < minDistance) {
            minDistance = d;
            bestWord = dictWord;
        }
    }
    return bestWord;
}

function getLevenshteinDistance(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    matrix[i][j - 1] + 1,     // insertion
                    matrix[i - 1][j] + 1      // deletion
                );
            }
        }
    }
    return matrix[b.length][a.length];
}

// Vibration feedback on touch (if device supports it)
function triggerHapticFeedback() {
    if ('vibrate' in navigator) {
        navigator.vibrate(15);
    }
}

// ==========================================================================
//  UI Event Bindings
// ==========================================================================
function setupUIListeners() {
    // Action Buttons
    document.getElementById("btn-add").addEventListener("click", addCurrentLetter);
    document.getElementById("btn-backspace").addEventListener("click", backspaceWord);
    document.getElementById("btn-speak").addEventListener("click", confirmAndSpeakWord);
    document.getElementById("btn-clear").addEventListener("click", clearSpelling);
    document.getElementById("btn-speak-phrase").addEventListener("click", speakWholePhrase);
    
    // Auto-fill suggestion when tapped
    document.getElementById("suggestion-box").addEventListener("click", () => {
        if (suggestion) {
            currentWord = suggestion.split("");
            suggestion = null;
            updateWordDisplay();
            triggerHapticFeedback();
        }
    });

    // Toggle Camera Face
    document.getElementById("btn-camera-toggle").addEventListener("click", () => {
        isFrontCamera = !isFrontCamera;
        initWebcam();
        triggerHapticFeedback();
    });

    // Guide Modal
    const modal = document.getElementById("guide-modal");
    document.getElementById("btn-help").addEventListener("click", () => {
        modal.classList.remove("hidden");
        triggerHapticFeedback();
    });
    document.getElementById("btn-close-guide").addEventListener("click", () => {
        modal.classList.add("hidden");
        triggerHapticFeedback();
    });
    
    // Close modal on click outside content
    modal.addEventListener("click", (e) => {
        if (e.target === modal) {
            modal.classList.add("hidden");
        }
    });
    
    // Web Speech synthesis voice preloading on mobile
    if ('speechSynthesis' in window) {
        window.speechSynthesis.getVoices();
    }
}

// Build list of alphabet cards inside guide modal
function buildGuideGrid() {
    const grid = document.getElementById("guide-grid");
    grid.innerHTML = "";
    
    CLASSES.forEach(letter => {
        const desc = SIGN_GUIDE[letter] || "Descripción no disponible";
        
        const card = document.createElement("div");
        card.className = "guide-item";
        card.innerHTML = `
            <div class="guide-letter">${letter}</div>
            <div class="guide-desc">${desc}</div>
        `;
        
        // Let spelling candidate card speak description on tap
        card.addEventListener("click", () => {
            speakText(`${letter}. ${desc}`);
            triggerHapticFeedback();
        });
        
        grid.appendChild(card);
    });
}
