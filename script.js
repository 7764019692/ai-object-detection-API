// HTML elements
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const objectList = document.getElementById("object-list");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");

// Distance estimation constants (YOU CAN TUNE THESE)
const KNOWN_WIDTH_CM = 21;   // e.g. A4 paper width = 21 cm
const FOCAL_LENGTH_PX = 476; // approximate. Adjust after calibration.

// Global state
let model = null;
let videoStream = null;
let detectionRunning = false;

// --------- Helper: Setup Camera ----------
async function setupCamera() {
  try {
    videoStream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480 },
      audio: false,
    });
    video.srcObject = videoStream;

    return new Promise((resolve) => {
      video.onloadedmetadata = () => {
        video.play();
        resolve();
      };
    });
  } catch (err) {
    console.error("Error accessing camera:", err);
    objectList.innerHTML =
      "❌ Cannot access camera. Please allow camera permission and use HTTPS or 'Live Server'.";
  }
}

// --------- Helper: Load Model ----------
async function loadModel() {
  objectList.innerHTML = "Loading AI model...";
  model = await cocoSsd.load();
  objectList.innerHTML = "Model loaded. Click 'Start Detection'.";
}

// --------- Distance Calculation ----------
function calculateDistanceCm(bboxWidthPx) {
  if (bboxWidthPx <= 0) return null;
  // Distance (cm) = (Real Width * Focal Length) / Width in Image
  const distance = (KNOWN_WIDTH_CM * FOCAL_LENGTH_PX) / bboxWidthPx;
  return distance;
}

// --------- Main Detection Loop ----------
async function detectFrame() {
  if (!detectionRunning || !model) return;

  const predictions = await model.detect(video);

  // Resize canvas to match video
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  // Clear and draw video frame
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  // Display object list
  if (predictions.length === 0) {
    objectList.innerHTML = "No objects detected.";
  } else {
    objectList.innerHTML = "";
  }

  ctx.font = "16px Arial";
  ctx.textBaseline = "top";

  predictions.forEach((prediction) => {
    const [x, y, width, height] = prediction.bbox;

    // Approx distance (using width of detection)
    const distanceCm = calculateDistanceCm(width);
    const distanceText = distanceCm
      ? `${distanceCm.toFixed(1)} cm`
      : "N/A";

    // Draw bounding box
    ctx.strokeStyle = "cyan";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);

    // Label text
    const label = `${prediction.class} (${(prediction.score * 100).toFixed(
      1
    )}%) - ${distanceText}`;
    const textX = x;
    const textY = y - 20 < 0 ? y + 5 : y - 20;

    // Draw label background
    const textWidth = ctx.measureText(label).width;
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(textX - 2, textY - 2, textWidth + 4, 20);

    // Draw label text
    ctx.fillStyle = "cyan";
    ctx.fillText(label, textX, textY);

    // Add to side list
    objectList.innerHTML += `• <strong>${prediction.class}</strong> – ${(prediction.score * 100).toFixed(
      1
    )}% – approx <strong>${distanceText}</strong> away<br>`;
  });

  // Loop
  requestAnimationFrame(detectFrame);
}

// --------- Start / Stop Buttons ----------
startBtn.addEventListener("click", async () => {
  if (!model) {
    await loadModel();
  }
  if (!videoStream) {
    await setupCamera();
  }
  detectionRunning = true;
  detectFrame();
});

stopBtn.addEventListener("click", () => {
  detectionRunning = false;
  objectList.innerHTML = "Detection stopped.";
  ctx.clearRect(0, 0, canvas.width, canvas.height);
});

// --------- Auto-load model on page load ----------
window.addEventListener("load", () => {
  loadModel();
});
