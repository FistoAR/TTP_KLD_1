// --- GLOBAL CONFIG ---
const DEFAULT_UNIT = "mm"; // always use mm
let currentImage = null;

// --- ARC WRAP (TAPERED TUB) CONSTANTS ---
const DPI = 300;
const EXPORT_MARGIN_MM = 0;
const MM_TO_INCH = 1 / 25.4;
const DEFAULT_TOTAL_BEND_HEIGHT = 84.827; // Default for 250ml

// --- UTILITY FUNCTIONS (SHARED) ---
const unitToPx = {
  px: 1,
  mm: 3.78, // For display scaling
  m: 3780,
};

// --- ARC WRAP (TAPERED TUB) UTILITIES ---
function mmToPxDisplay(mm) {
  return mm * unitToPx.mm;
}
function mmToPxExport(mm) {
  return mm * DPI * MM_TO_INCH;
}

// --- LOCAL STORAGE ---
function saveStateToLocalStorage() {
  const state = {
    diagramType: document.getElementById("diagramType").value,
    topWidth: document.getElementById("topWidth").value,
    bottomWidth: document.getElementById("bottomWidth").value,
    height: document.getElementById("height").value,
    totalBendHeight: document.getElementById("totalBendHeight")?.value, // Save new field
    sqWidth: document.getElementById("sqWidth").value,
    sqHeight: document.getElementById("sqHeight").value,
    radius: document.getElementById("radius").value,
    sqWidthOnly: document.getElementById("sqWidthOnly").value,
    sqHeightOnly: document.getElementById("sqHeightOnly").value,
  };
  localStorage.setItem("kldState", JSON.stringify(state));
}

function loadStateFromLocalStorage() {
  const saved = localStorage.getItem("kldState");
  if (!saved) return;
  const state = JSON.parse(saved);

  document.getElementById("diagramType").value =
    state.diagramType || "curveRectangle";

  document.getElementById("topWidth").value = state.topWidth || "";
  document.getElementById("bottomWidth").value = state.bottomWidth || "";
  document.getElementById("height").value = state.height || "";
  if (document.getElementById("totalBendHeight")) {
    document.getElementById("totalBendHeight").value = state.totalBendHeight || "";
  }
  document.getElementById("sqWidth").value = state.sqWidth || "";
  document.getElementById("sqHeight").value = state.sqHeight || "";
  document.getElementById("radius").value = state.radius || "";
  document.getElementById("sqWidthOnly").value = state.sqWidthOnly || "";
  document.getElementById("sqHeightOnly").value = state.sqHeightOnly || "";
}

// --- DOM ELEMENTS ---
const canvas = document.getElementById("kldCanvas");
const ctx = canvas.getContext("2d");
const uploadText = document.getElementById("uploadText");
const imgError = document.getElementById("imgerror");
const dropArea = document.getElementById("dropArea");
const fileInput = document.getElementById("imageUpload");
const totalBendHeightInput = document.getElementById("totalBendHeight"); // Get new input

// --- CANVAS & EVENT LISTENERS ---
function resizeCanvas() {
  const styles = getComputedStyle(canvas);
  canvas.width = canvas.clientWidth * window.devicePixelRatio;
  canvas.height = canvas.clientHeight * window.devicePixelRatio;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
}

window.addEventListener("resize", () => {
  resizeCanvas();
  drawKLD(); // Call the main router
});

document
  .getElementById("imageUpload")
  .addEventListener("input", handleImageUpload);

// Add all inputs to the listener list
[
  "topWidth",
  "bottomWidth",
  "height",
  "totalBendHeight", // Add new input
  "sqWidth",
  "sqHeight",
  "radius",
  "sqWidthOnly",
  "sqHeightOnly",
].forEach((id) => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener("input", () => {
      drawKLD(); // Call the main router
      saveStateToLocalStorage();
    });
  }
});

// --- IMAGE UPLOAD & DRAG/DROP ---
function handleImageUpload(event) {
  const file = event.target.files[0];
  const uploadText = document.getElementById("uploadText");
  const fileInput = document.getElementById("imageUpload");
  const imgError = document.getElementById("imgerror");
  imgError.style.display = "none";
  imgError.innerHTML = "";

  if (!file) {
    currentImage = null;
    drawKLD();
    uploadText.innerHTML = "Drag and drop file here or <span>Browse</span>";
    return;
  }

  const reader = new FileReader();
  reader.onload = function (e) {
    const img = new Image();
    img.onload = () => {
      // =========================================
      // === IMAGE SIZE CHECK IS ENABLED ===
      // =========================================
      const model = document.getElementById("modelType").value;
      const expected = modelDimensions[model];

      if (expected) {
        if (img.width < expected[0] || img.height < expected[1]) {
          imgError.style.display = "block";
          imgError.innerHTML = `Uploaded image size (${img.width}x${img.height}) is smaller than required dimensions (${expected[0]}x${expected[1]}). Please upload a larger image.`;
          fileInput.value = "";
          uploadText.innerHTML =
            "Drag and drop file here or <span>Browse</span>";
          currentImage = null; // Make sure to null the image
          drawKLD(); // Redraw without image
          return;
        }
      }
      // =========================================

      // file name truncate and display
      const fullName = file.name;
      const dotIndex = fullName.lastIndexOf(".");
      let name = dotIndex !== -1 ? fullName.substring(0, dotIndex) : fullName;
      const ext = dotIndex !== -1 ? fullName.substring(dotIndex) : "";

      if (name.length > 7) {
        name = name.substring(0, 7);
      }
      uploadText.textContent = `${name}.......${ext}`;

      currentImage = img;
      drawKLD(); // Call main router
    };
    img.onerror = () => {
      imgError.style.display = "block";
      imgError.textContent = "Failed to load image.";
      currentImage = null;
      drawKLD();
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

dropArea.addEventListener("dragover", function (e) {
  e.preventDefault();
  dropArea.classList.add("dragover");
});

dropArea.addEventListener("dragleave", function (e) {
  e.preventDefault();
  dropArea.classList.remove("dragover");
});

dropArea.addEventListener("drop", function (e) {
  e.preventDefault();
  dropArea.classList.remove("dragover");

  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
    const file = e.dataTransfer.files[0];
    fileInput.files = e.dataTransfer.files;
    const event = new Event("input", { bubbles: true });
    fileInput.dispatchEvent(event);
  }
});

// --- MODEL & UI LOGIC ---

function updateModels() {
  const shape = document.getElementById("shapeType").value;
  const modelSelect = document.getElementById("modelType");
  modelSelect.innerHTML = "";

  let models = [];
  if (shape === "round") {
    models = [
      { value: "curveRectangle250", label: "250 ml Round" },
      { value: "curveRectangle500", label: "500 ml Round" },
      { value: "curveRectangle750", label: "750 ml Round" },
      { value: "curveRectangle1000", label: "1000 ml Round" },
    ];
  } else if (shape === "round_Square") {
    models = [
      { value: "curveRectangle500ml_square", label: "500 ml" },
      { value: "curveRectangle500g_square", label: "500 gms/450 ml Round" },
    ];
  } else if (shape === "rectangle") {
    models = [
      { value: "squareWithRadius750", label: "750 ml Rectangle" },
      { value: "square", label: "500 ml Rectangle" },
    ];
  } else if (shape === "sweetBox") {
    models = [
      { value: "sweetBox250", label: "250 SB" },
      { value: "sweetBox500", label: "500 SB" },
    ];
  } else if (shape === "teSweetBox") {
    models = [
      { value: "teSweetBox250", label: "TE 250 SB" },
      { value: "teSweetBox500", label: "TE 500 SB" },
    ];
  }

  models.forEach((m) => {
    const opt = document.createElement("option");
    opt.value = m.value;
    opt.textContent = m.label;
    modelSelect.appendChild(opt);
  });

  if (models.length > 0) {
    modelSelect.value = models[0].value;
    applyModel();
  }
}

// These dimensions are now used for the image size check
const modelDimensions = {
  curveRectangle500: [2890, 886],
  curveRectangle250: [2906, 448],
  curveRectangle750: [4363, 709],
  curveRectangle1000: [4369, 709],
  curveRectangle500g_square: [2924, 748],
  curveRectangle500ml_square: [2924, 748],
  square: [200, 200],
  square750: [162.5, 108.6],
  squareWithRadius750: [1488, 992],
  sweetBox250: [467.83, 34.13],
  sweetBox500: [630.19, 34.12],
  sweetBox250Top: [1488, 992],
  sweetBox500Top: [1488, 992],
  teSweetBox250: [467.83, 34.13],
  teSweetBox500: [630.19, 34.12],
  teSweetBox250Top: [1488, 992],
  teSweetBox500Top: [1488, 992],
};

// Show users the *recommended* size
function updateDimensionText() {
  const model = document.getElementById("modelType").value;
  const orientation =
    document.querySelector('input[name="sweetBoxSide"]:checked')?.value ||
    "bottom";
  const dimentionEl = document.getElementById("dimention");

  let lookupKey = model;

  if (
    (model === "sweetBox250" ||
      model === "sweetBox500" ||
      model === "teSweetBox250" ||
      model === "teSweetBox500") &&
    orientation === "top"
  ) {
    lookupKey = model + "Top";
  }

  const dim = modelDimensions[lookupKey];
  if (dim && dim.length === 2) {
    dimentionEl.textContent = `Recommended: ${dim[0]}px x ${dim[1]}px`;
  } else {
    dimentionEl.textContent = "";
  }
}

function clearUploadedImage() {
  currentImage = null;
  const fileInput = document.getElementById("imageUpload");
  const uploadText = document.getElementById("uploadText");
  fileInput.value = "";
  uploadText.innerHTML = "Drag and drop file here or <span>Browse</span>";
  drawKLD(); // Redraw canvas without image
}

document.getElementById("shapeType").addEventListener("change", () => {
  updateModels();
  updateDimensionText();
  clearUploadedImage();
  imgError.style.display = "none";
});

document.getElementById("modelType").addEventListener("change", () => {
  applyModel();
  updateDimensionText();
  clearUploadedImage();
  imgError.style.display = "none";
});

document
  .getElementById("sweetBoxOrientation")
  .addEventListener("change", () => {
    applyModel();
    updateDimensionText();
    clearUploadedImage();
    imgError.style.display = "none";
  });

function applyModel() {
  const model = document.getElementById("modelType").value;
  document.getElementById("diagramType").value = model;
  updateInputs();
  drawKLD(); // Call main router
}

function updateInputs() {
  const diagramType = document.getElementById("diagramType").value;
  const orientation =
    document.querySelector('input[name="sweetBoxSide"]:checked')?.value ||
    "bottom";
  
  const isRoundShape = diagramType.startsWith("curveRectangle") && 
                       !diagramType.endsWith("_square"); // Check if it's a Round tub

  // Toggle sweetBox orientation radio
  const showSweetOrientation =
    diagramType.startsWith("sweetBox") || diagramType.startsWith("teSweetBox");
  let oreo = document.getElementById("sweetBoxOrientation");
  oreo.style.display = showSweetOrientation ? "flex" : "none";
  oreo.style.flexDirection = "column";
  oreo.style.gap = "10px";

  const isBottomOrientation = orientation === "bottom";
  const isSweetBoxType =
    diagramType.startsWith("sweetBox") || diagramType.startsWith("teSweetBox");

  // Toggle active class for input groups
  document
    .getElementById("curveRectInputs")
    .classList.toggle(
      "active",
      diagramType.startsWith("curveRectangle") // Show for BOTH Round and Round-Square
    );
  
  // SPECIFICALLY toggle the TotalBendHeight input
  // It only applies to the "Round" (Arc) shapes
  if (totalBendHeightInput) {
    totalBendHeightInput.parentElement.style.display = isRoundShape ? "flex" : "none";
  }

  document
    .getElementById("sweetBoxInputs")
    .classList.toggle("active", isSweetBoxType && isBottomOrientation);

  document
    .getElementById("squareRadiusInputs")
    .classList.toggle(
      "active",
      diagramType === "squareWithRadius" ||
        diagramType === "squareWithRadius750" ||
        (isSweetBoxType && !isBottomOrientation)
    );

  document
    .getElementById("squareInputs")
    .classList.toggle(
      "active",
      diagramType === "square" || diagramType === "square750"
    );

  // --- Set Default Values ---

  // Values for "Round" (Arc Wraps)
  if (diagramType === "curveRectangle250") {
    document.getElementById("topWidth").value = 294.422;
    document.getElementById("bottomWidth").value = 244.089;
    document.getElementById("height").value = 37.6;
    if (totalBendHeightInput) totalBendHeightInput.value = 84.827;
  } else if (diagramType === "curveRectangle500") {
    document.getElementById("topWidth").value = 313.14; // Example value
    document.getElementById("bottomWidth").value = 244.65; // Example value
    document.getElementById("height").value = 75; // Example value
    if (totalBendHeightInput) totalBendHeightInput.value = 102.5; // Example value
  } else if (diagramType === "curveRectangle750") {
    document.getElementById("topWidth").value = 300.91; // Example value
    document.getElementById("bottomWidth").value = 245.14; // Example value
    document.getElementById("height").value = 37.92; // Example value
    if (totalBendHeightInput) totalBendHeightInput.value = 90.1; // Example value
  } else if (diagramType === "curveRectangle1000") {
    document.getElementById("topWidth").value = 310.91; // Example value
    document.getElementById("bottomWidth").value = 245.14; // Example value
    document.getElementById("height").value = 37.92; // Example value
    if (totalBendHeightInput) totalBendHeightInput.value = 95.3; // Example value
  }
  
  // Values for "Round Square" (Flat KLD)
  else if (diagramType === "curveRectangle500g_square") {
    document.getElementById("topWidth").value = 309.322;
    document.getElementById("bottomWidth").value = 245.178;
    document.getElementById("height").value = 96.853;
  } else if (diagramType === "curveRectangle500ml_square") {
    document.getElementById("topWidth").value = 309.322;
    document.getElementById("bottomWidth").value = 245.178;
    document.getElementById("height").value = 98.853;
  }
  
  // Values for "Rectangle" (Flat KLD)
  if (diagramType === "square") {
    document.getElementById("sqWidthOnly").value = 200;
    document.getElementById("sqHeightOnly").value = 160;
  } else if (diagramType === "square750") {
    document.getElementById("sqWidthOnly").value = 162.5;
    document.getElementById("sqHeightOnly").value = 108.6;
  }
  if (diagramType === "squareWithRadius750") {
    document.getElementById("sqWidth").value = 162.5;
    document.getElementById("sqHeight").value = 108.6;
    document.getElementById("radius").value = 0;
  }

  // Values for "SweetBox" (Flat KLD)
  if (diagramType === "sweetBox250") {
    if (isBottomOrientation) {
      document.getElementById("sweetWidth").value = 467.83;
      document.getElementById("sweetHeight").value = 34.13;
      document.getElementById("sweetBend").value = 61.98;
    } else {
      document.getElementById("sqWidth").value = 150;
      document.getElementById("sqHeight").value = 100;
      document.getElementById("radius").value = 8;
    }
  } else if (diagramType === "sweetBox500") {
    if (isBottomOrientation) {
      document.getElementById("sweetWidth").value = 630.19;
      document.getElementById("sweetHeight").value = 34.12;
      document.getElementById("sweetBend").value = 71.61;
    } else {
      document.getElementById("sqWidth").value = 180;
      document.getElementById("sqHeight").value = 120;
      document.getElementById("radius").value = 10;
    }
  } else if (diagramType === "teSweetBox250") {
    if (isBottomOrientation) {
      document.getElementById("sweetWidth").value = 467.83;
      document.getElementById("sweetHeight").value = 34.13;
      document.getElementById("sweetBend").value = 61.98;
    } else {
      document.getElementById("sqWidth").value = 155;
      document.getElementById("sqHeight").value = 105;
      document.getElementById("radius").value = 12;
    }
  } else if (diagramType === "teSweetBox500") {
    if (isBottomOrientation) {
      document.getElementById("sweetWidth").value = 630.19;
      document.getElementById("sweetHeight").value = 34.12;
      document.getElementById("sweetBend").value = 71.61;
    } else {
      document.getElementById("sqWidth").value = 185;
      document.getElementById("sqHeight").value = 125;
      document.getElementById("radius").value = 15;
    }
  }

  // --- Disable/Enable Inputs ---

  // Sweet Box
  if (isSweetBoxType && isBottomOrientation) {
    document.getElementById("sweetWidth").disabled = true;
    document.getElementById("sweetHeight").disabled = true;
    document.getElementById("sweetBend").disabled = true;
  } else {
    document.getElementById("sweetWidth").disabled = false;
    document.getElementById("sweetHeight").disabled = false;
    document.getElementById("sweetBend").disabled = false;
  }

  // Square
  if (diagramType === "square" || diagramType === "square750") {
    document.getElementById("sqWidthOnly").disabled = true;
    document.getElementById("sqHeightOnly").disabled = true;
  } else {
    document.getElementById("sqWidthOnly").disabled = false;
    document.getElementById("sqHeightOnly").disabled = false;
  }

  // Square w/ Radius
  if (
    diagramType === "squareWithRadius750" ||
    (isSweetBoxType && !isBottomOrientation)
  ) {
    document.getElementById("sqWidth").disabled = true;
    document.getElementById("sqHeight").disabled = true;
    document.getElementById("radius").disabled = true;
  } else {
    document.getElementById("sqWidth").disabled = false;
    document.getElementById("sqHeight").disabled = false;
    document.getElementById("radius").disabled = false;
  }

  // Curve Rectangle (BOTH types)
  if (diagramType.startsWith("curveRectangle")) {
    document.getElementById("topWidth").disabled = true;
    document.getElementById("bottomWidth").disabled = true;
    document.getElementById("height").disabled = true;
    if (totalBendHeightInput) totalBendHeightInput.disabled = true; // Disable this too
  } else {
    document.getElementById("topWidth").disabled = false;
    document.getElementById("bottomWidth").disabled = false;
    document.getElementById("height").disabled = false;
    if (totalBendHeightInput) totalBendHeightInput.disabled = false;
  }
  
  drawKLD(); // Call main router
}

// ===================================================================
// --- MAIN DRAWING ROUTER ---
// ===================================================================

function drawKLD() {
  if (!ctx) return;
  resizeCanvas();
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  let diagramType = document.getElementById("diagramType").value;

  // Check if it's a "Round" tub (and not a "Round Square")
  if (
    diagramType.startsWith("curveRectangle") &&
    !diagramType.endsWith("_square")
  ) {
    // Use the ARC WRAP logic
    drawArcWrap(ctx, "display");
  } else {
    // Use the FLAT KLD logic
    drawKLD_Flat(ctx, "display");
  }
}

// ===================================================================
// --- SECTION 1: ARC WRAP (TAPERED TUB) LOGIC ---
// ===================================================================

function getArcWrapGeometry(topCirc, bottomCirc, height, totalBendHeight) {
  if (
    !topCirc ||
    !bottomCirc ||
    !height ||
    topCirc <= 0 ||
    bottomCirc <= 0 ||
    height <= 0
  ) {
    return null;
  }
  const r_top = topCirc / (2 * Math.PI);
  const r_bottom = bottomCirc / (2 * Math.PI);
  const r_diff = Math.abs(r_bottom - r_top);

  if (r_diff < 1e-6) return null; // Avoid division by zero

  const slant_height = Math.sqrt(height * height + r_diff * r_diff);
  const largerR = Math.max(r_top, r_bottom);

  const R_outer = (slant_height * largerR) / r_diff;
  const R_inner = R_outer - slant_height;

  let theta;
  if (totalBendHeight && totalBendHeight > 0) {
    const cosHalfTheta = (R_outer - totalBendHeight) / R_inner;
    theta = 2 * Math.acos(Math.max(-1, Math.min(1, cosHalfTheta)));
  } else {
    const largerCirc = Math.max(topCirc, bottomCirc);
    theta = largerCirc / R_outer;
  }

  const R_top = r_top > r_bottom ? R_outer : R_inner;
  const R_bottom = r_top > r_bottom ? R_inner : R_outer;

  const totalWidth = 2 * R_outer * Math.sin(theta / 2);
  const totalHeight = R_outer - R_inner * Math.cos(theta / 2);

  return {
    R_top, R_bottom, R_outer, R_inner, theta,
    totalWidth, totalHeight, topCirc, bottomCirc, height,
  };
}

// --- Drawing Arc/Fan Shape ---
function drawArcWrap(localCtx, mode) {
  const isDisplay = mode === "display";
  const px = isDisplay ? mmToPxDisplay : mmToPxExport;
  const units = DEFAULT_UNIT;

  const topCirc = Number(document.getElementById("topWidth").value);
  const bottomCirc = Number(document.getElementById("bottomWidth").value);
  const h = Number(document.getElementById("height").value);
  const totalBendHeight = totalBendHeightInput
    ? Number(totalBendHeightInput.value)
    : null;

  const geo = getArcWrapGeometry(topCirc, bottomCirc, h, totalBendHeight);
  if (!geo) {
    if (isDisplay) {
      const w = localCtx.canvas.width / (window.devicePixelRatio || 1);
      const h = localCtx.canvas.height / (window.devicePixelRatio || 1);
      localCtx.font = "16px Arial";
      localCtx.fillStyle = "#333";
      localCtx.textAlign = "center";
      localCtx.fillText("Invalid dimensions for Arc Wrap", w / 2, h / 2);
    }
    return;
  }

  const { R_top, R_bottom, R_outer, theta, totalWidth, totalHeight } = geo;

  let canvasW = localCtx.canvas.width;
  let canvasH = localCtx.canvas.height;
  let scale = 1;
  let marginPx = 0;

  if (isDisplay) {
    canvasW /= window.devicePixelRatio || 1;
    canvasH /= window.devicePixelRatio || 1;
    marginPx = 80;
    const scaleX = (canvasW - marginPx * 2) / px(totalWidth);
    const scaleY = (canvasH - marginPx * 2) / px(totalHeight);
    scale = Math.min(scaleX, scaleY, 1);
  }

  const R_top_px = px(R_top) * scale;
  const R_bottom_px = px(R_bottom) * scale;
  const R_outer_px = px(R_outer) * scale;

  const heightPx = px(totalHeight) * scale;

  const centerX = isDisplay
    ? canvasW / 2
    : px(EXPORT_MARGIN_MM) + px(totalWidth) / 2;
  const centerY = isDisplay
    ? (canvasH - heightPx) / 2 + R_outer_px
    : px(EXPORT_MARGIN_MM) + px(R_outer);

  const startAngle = -Math.PI / 2 - theta / 2;
  const endAngle = -Math.PI / 2 + theta / 2;

  localCtx.beginPath();
  localCtx.arc(centerX, centerY, R_top_px, startAngle, endAngle, false);
  localCtx.arc(centerX, centerY, R_bottom_px, endAngle, startAngle, true);
  localCtx.closePath();

  if (currentImage) {
    localCtx.save();
    localCtx.clip();

    const sliceCount = 500;
    for (let i = 0; i < sliceCount; i++) {
      const t = i / sliceCount;
      const nextT = (i + 1) / sliceCount;

      const angle1 = startAngle + t * theta;
      const angle2 = startAngle + nextT * theta;

      const p1_top = {
        x: centerX + R_top_px * Math.cos(angle1),
        y: centerY + R_top_px * Math.sin(angle1),
      };
      const p2_top = {
        x: centerX + R_top_px * Math.cos(angle2),
        y: centerY + R_top_px * Math.sin(angle2),
      };
      const p1_bottom = {
        x: centerX + R_bottom_px * Math.cos(angle1),
        y: centerY + R_bottom_px * Math.sin(angle1),
      };
      const p2_bottom = {
        x: centerX + R_bottom_px * Math.cos(angle2),
        y: centerY + R_bottom_px * Math.sin(angle2),
      };

      localCtx.beginPath();
      localCtx.moveTo(p1_top.x, p1_top.y);
      localCtx.lineTo(p2_top.x, p2_top.y);
      localCtx.lineTo(p2_bottom.x, p2_bottom.y);
      localCtx.lineTo(p1_bottom.x, p1_bottom.y);
      localCtx.closePath();

      localCtx.save();
      localCtx.clip();

      const srcX = (i / sliceCount) * currentImage.width;
      const srcWidth = currentImage.width / sliceCount;
      const sliceAngle = Math.atan2(p2_top.y - p1_top.y, p2_top.x - p1_top.x);
      const sliceWidth = Math.hypot(p2_top.x - p1_top.x, p2_top.y - p1_top.y);
      const sliceHeight = Math.hypot(
        p1_bottom.x - p1_top.x,
        p1_bottom.y - p1_top.y
      );

      localCtx.translate(p1_top.x, p1_top.y);
      localCtx.rotate(sliceAngle);
      localCtx.drawImage(
        currentImage,
        srcX,
        0,
        srcWidth,
        currentImage.height,
        0,
        0,
        sliceWidth + 1.1, // Fixed gap
        sliceHeight
      );
      localCtx.restore();
    }
    localCtx.restore();
  } else {
    localCtx.fillStyle = "#eee";
    localCtx.fill();
  }
  
  // =================================================================
  // === DIMENSION LINES FOR "ROUND" (ARC) SHAPES ===
  // =================================================================
  if (isDisplay) {
    localCtx.strokeStyle = "blue";
    localCtx.fillStyle = "blue";
    localCtx.lineWidth = Math.max(1, 1 * scale);
    localCtx.font = `${Math.max(12, 20 * scale)}px Arial`;
    localCtx.textAlign = "center";
    localCtx.textBaseline = "middle";

    const offset = 30; // Define offset

    // Get corner points
    const p_top_left = { x: centerX + R_top_px * Math.cos(startAngle), y: centerY + R_top_px * Math.sin(startAngle) };
    const p_top_right = { x: centerX + R_top_px * Math.cos(endAngle), y: centerY + R_top_px * Math.sin(endAngle) };
    const p_bottom_left = { x: centerX + R_bottom_px * Math.cos(startAngle), y: centerY + R_bottom_px * Math.sin(startAngle) };
    const p_bottom_right = { x: centerX + R_bottom_px * Math.cos(endAngle), y: centerY + R_bottom_px * Math.sin(endAngle) };
    
    // Find topmost Y
    const midAngle = (startAngle + endAngle) / 2;
    const topY = centerY + R_top_px * Math.sin(midAngle);

    // Top dimension (labeled with Top Circumference)
    const topDimY = topY - offset;
    drawArrow(localCtx, p_top_left.x, topDimY, p_top_right.x, topDimY, 8);
    drawArrow(localCtx, p_top_right.x, topDimY, p_top_left.x, topDimY, 8);
    localCtx.fillText(
      topCirc.toFixed(2) + " " + units,
      centerX,
      topDimY - 12
    );

    // Bottom dimension (labeled with Bottom Circumference)
    const bottomDimY = Math.max(p_bottom_left.y, p_bottom_right.y) + offset;
    drawArrow(localCtx, p_bottom_left.x, bottomDimY, p_bottom_right.x, bottomDimY, 8);
    drawArrow(localCtx, p_bottom_right.x, bottomDimY, p_bottom_left.x, bottomDimY, 8);
    localCtx.fillText(
      bottomCirc.toFixed(2) + " " + units,
      centerX,
      bottomDimY + 16
    );

    // Height dimension (labeled with input Height 'h')
    const heightDimX = p_top_right.x + offset;
    // We draw this line straight, representing the input 'h', not the slant height
    const scaledInputHeight = px(h) * scale;
    const midY = (p_top_right.y + p_bottom_right.y) / 2;
    const heightTopY = midY - scaledInputHeight / 2;
    const heightBottomY = midY + scaledInputHeight / 2;

    drawArrow(localCtx, heightDimX, heightTopY, heightDimX, heightBottomY, 8);
    drawArrow(localCtx, heightDimX, heightBottomY, heightDimX, heightTopY, 8);
    localCtx.save();
    localCtx.translate(heightDimX + 38, midY);
    localCtx.rotate(-Math.PI / 2);
    localCtx.fillText(h.toFixed(2) + " " + units, 0, 6);
    localCtx.restore();
  }

  // =================================================================
  // === BORDER LOGIC: Only draw border if NO image is loaded ===
  // =================================================================
  if (!currentImage) {
    localCtx.strokeStyle = "#222";
    localCtx.lineWidth = isDisplay ? Math.max(1, 1.2 * scale) : 2;
    localCtx.stroke();
  }
}

function drawKLDForExport_Arc() {
  const topCirc = Number(document.getElementById("topWidth").value);
  const bottomCirc = Number(document.getElementById("bottomWidth").value);
  const height = Number(document.getElementById("height").value);
  const totalBendHeight = totalBendHeightInput
    ? Number(totalBendHeightInput.value)
    : null;
  const geo = getArcWrapGeometry(topCirc, bottomCirc, height, totalBendHeight);
  if (!geo) return null;

  const widthPx = Math.ceil(
    mmToPxExport(geo.totalWidth + 2 * EXPORT_MARGIN_MM)
  );
  const heightPx = Math.ceil(
    mmToPxExport(geo.totalHeight + 2 * EXPORT_MARGIN_MM)
  );
  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = widthPx;
  exportCanvas.height = heightPx;
  const exportCtx = exportCanvas.getContext("2d");

  exportCtx.imageSmoothingEnabled = true;
  exportCtx.imageSmoothingQuality = "high";
  drawArcWrap(exportCtx, "export");
  return exportCanvas;
}

// ===================================================================
// --- SECTION 2: FLAT KLD (SWEETBOX, RECT) LOGIC ---
// ===================================================================

// Renamed to avoid conflict
function drawKLD_Flat(localCtx, mode) {
  const isDisplay = mode === "display";
  
  let diagramType = document.getElementById("diagramType").value;
  const orientation =
    document.querySelector('input[name="sweetBoxSide"]:checked')?.value ||
    "bottom";
  const units = DEFAULT_UNIT;

  if (
    diagramType === "sweetBox250" ||
    diagramType === "sweetBox500" ||
    diagramType === "teSweetBox250" ||
    diagramType === "teSweetBox500"
  ) {
    if (orientation === "top") {
      diagramType = "squareWithRadius";
    }
  }

  function toPx(value) {
    return value * unitToPx[units];
  }

  const round = (num) => Math.round(num * 100) / 100;
  const margin = 60;
  const svgWidth = localCtx.canvas.width / (window.devicePixelRatio || 1); // Use localCtx
  const svgHeight = localCtx.canvas.height / (window.devicePixelRatio || 1); // Use localCtx
  let scale = 1;
  let w = 0, h = 0, bottom = 0;
  const offset = 30;

  // This is the FLAT "curveRectangle" logic (for Round-Square)
  if (diagramType.endsWith("_square")) {
    w = Number(document.getElementById("topWidth").value);
    h = Number(document.getElementById("height").value);
    bottom = Number(document.getElementById("bottomWidth").value);

    const wPx = toPx(w);
    const hPx = toPx(h);
    const bottomPx = toPx(bottom);
    const verticalHeight = hPx;
    const horizontalMargin = 120;
    const verticalMargin = 100;
    const topMargin = 80;

    const scaleXFit = (svgWidth - 2 * horizontalMargin) / Math.max(wPx, bottomPx);
    const scaleYFit = (svgHeight - 2 * verticalMargin - topMargin) / verticalHeight;
    scale = Math.min(scaleXFit, scaleYFit);

    const scaledWidth = wPx * scale;
    const scaledHeight = verticalHeight * scale;
    const scaledBottomWidth = bottomPx * scale;
    const scaledMaxWidth = Math.max(wPx, bottomPx) * scale;

    const centerX = (svgWidth - scaledMaxWidth) / 2;
    const centerY = (svgHeight - scaledHeight) / 2 + topMargin;

    const topLeft = {
      x: Math.round(centerX + (scaledMaxWidth - scaledWidth) / 2),
      y: Math.round(centerY),
    };
    const topRight = {
      x: Math.round(centerX + (scaledMaxWidth + scaledWidth) / 2),
      y: Math.round(centerY),
    };
    const bottomLeft = {
      x: Math.round(centerX + (scaledMaxWidth - scaledBottomWidth) / 2),
      y: Math.round(centerY + scaledHeight),
    };
    const bottomRight = {
      x: Math.round(centerX + (scaledMaxWidth + scaledBottomWidth) / 2),
      y: bottomLeft.y,
    };

    // --- FLAT KLD BEND LOGIC ---
    const bendFactors = {
      curveRectangle500g_square: 0.2,
      curveRectangle500ml_square: 0.25,
    };
    const BEND_SCALE = 0.1;
    const bendFactor = bendFactors[diagramType] || 0.0;
    const bendAmount = scaledHeight * bendFactor * BEND_SCALE;
    const curveOffsetTop = bendAmount;
    const curveOffsetBottom = bendAmount;
    // --- END FLAT BEND LOGIC ---

    localCtx.save();
    localCtx.beginPath();
    localCtx.moveTo(topLeft.x, topLeft.y);
    localCtx.quadraticCurveTo(
      (topLeft.x + topRight.x) / 2,
      topLeft.y - curveOffsetTop,
      topRight.x,
      topRight.y
    );
    localCtx.lineTo(bottomRight.x, bottomRight.y);
    localCtx.quadraticCurveTo(
      (bottomRight.x + bottomLeft.x) / 2,
      bottomRight.y + curveOffsetBottom,
      bottomLeft.x,
      bottomLeft.y
    );
    localCtx.closePath();
    localCtx.clip();

    if (currentImage) {
      const imgWidth = currentImage.width;
      const imgHeight = currentImage.height;
      const sliceCount = 2000;
      const sliceW = imgWidth / sliceCount;

      for (let i = 0; i < sliceCount; i++) {
        const sx = i * sliceW;
        const sw = sliceW;
        const t1 = i / sliceCount;
        const t2 = (i + 1) / sliceCount;

        const topX1 = topLeft.x + (topRight.x - topLeft.x) * t1;
        const topY1 = quadraticAt(
          topLeft.y, topLeft.y - curveOffsetTop, topRight.y, t1
        );
        const topX2 = topLeft.x + (topRight.x - topLeft.x) * t2;
        const topY2 = quadraticAt(
          topLeft.y, topLeft.y - curveOffsetTop, topRight.y, t2
        );
        const bottomX1 = bottomLeft.x + (bottomRight.x - bottomLeft.x) * t1;
        const bottomY1 = quadraticAt(
          bottomLeft.y, bottomRight.y + curveOffsetBottom, bottomRight.y, t1
        );
        const bottomX2 = bottomLeft.x + (bottomRight.x - bottomLeft.x) * t2;
        const bottomY2 = quadraticAt(
          bottomLeft.y, bottomRight.y + curveOffsetBottom, bottomRight.y, t2
        );

        const angleTop = Math.atan2(topY2 - topY1, topX2 - topX1);
        const angleBottom = Math.atan2(bottomY2 - bottomY1, bottomX2 - bottomX1);
        const angle = (angleTop + angleBottom) / 2;
        const sliceWidth = Math.hypot(topX2 - topX1, topY2 - topY1);
        const sliceHeight = Math.hypot(bottomX1 - topX1, bottomY1 - topY1);

        localCtx.save();
        localCtx.translate(topX1, topY1);
        localCtx.rotate(angle);
        localCtx.drawImage(
          currentImage,
          sx, 0, sw, imgHeight,
          0, 0, sliceWidth + 1.1, sliceHeight // ====== FIX: GAP REMOVED ======
        );
        localCtx.restore();
      }
      localCtx.imageSmoothingEnabled = true;
    } else {
      localCtx.fillStyle = "#eee";
      localCtx.fill();
    }
    localCtx.restore();

    // =================================================================
    // === BORDER RE-ENABLED for "Round Square" ===
    // =================================================================
    localCtx.beginPath();
    localCtx.moveTo(topLeft.x, topLeft.y);
    localCtx.quadraticCurveTo(
      (topLeft.x + topRight.x) / 2,
      topLeft.y - curveOffsetTop,
      topRight.x,
      topRight.y
    );
    localCtx.lineTo(bottomRight.x, bottomRight.y);
    localCtx.quadraticCurveTo(
      (bottomRight.x + bottomLeft.x) / 2,
      bottomRight.y + curveOffsetBottom,
      bottomLeft.x,
      bottomLeft.y
    );
    localCtx.closePath();
    localCtx.lineWidth = Math.max(1, 1.2 * scale);
    localCtx.strokeStyle = "#222";
    localCtx.stroke(); // ====== BORDER IS ON ======
    
    // =================================================================
    // === DIMENSION LINES ADDED for "Round Square" ===
    // =================================================================
    if (isDisplay) {
      // Dimension lines and text
      localCtx.strokeStyle = "blue";
      localCtx.fillStyle = "blue";
      localCtx.lineWidth = Math.max(1, 1 * scale);
      localCtx.font = `${Math.max(12, 20 * scale)}px Arial`;
      localCtx.textAlign = "center";
      localCtx.textBaseline = "middle";

      const topDimY = topLeft.y - offset;
      drawArrow(localCtx, topLeft.x, topDimY, topRight.x, topDimY, 8);
      drawArrow(localCtx, topRight.x, topDimY, topLeft.x, topDimY, 8);
      localCtx.fillText(
        w.toFixed(2) + " " + units,
        (topLeft.x + topRight.x) / 2,
        topDimY - 12
      );

      const bottomDimY = bottomLeft.y + offset;
      drawArrow(localCtx, bottomLeft.x, bottomDimY, bottomRight.x, bottomDimY, 8);
      drawArrow(localCtx, bottomRight.x, bottomDimY, bottomLeft.x, bottomDimY, 8);
      localCtx.fillText(
        bottom.toFixed(2) + " " + units,
        (bottomLeft.x + bottomRight.x) / 2,
        bottomDimY + 16
      );

      const heightDimX = topRight.x + offset;
      drawArrow(localCtx, heightDimX, topRight.y, heightDimX, bottomRight.y, 8);
      drawArrow(localCtx, heightDimX, bottomRight.y, heightDimX, topRight.y, 8);
      localCtx.save();
      localCtx.translate(heightDimX + 38, (topRight.y + bottomRight.y) / 2);
      localCtx.rotate(-Math.PI / 2);
      localCtx.fillText(h.toFixed(2) + " " + units, 0, 6);
      localCtx.restore();
    }
    
  } else if (
    diagramType === "squareWithRadius" ||
    diagramType === "squareWithRadius750" ||
    orientation === "Top" // Catches sweetbox top
  ) {
    w = Number(document.getElementById("sqWidth").value);
    h = Number(document.getElementById("sqHeight").value);
    bottom = w;
    const radiusInput = Number(document.getElementById("radius").value);
    const wPx = toPx(w);
    const hPx = toPx(h);

    const scaleXFit = (svgWidth - 2 * margin) / wPx;
    const scaleYFit = (svgHeight - 2 * margin) / hPx;
    scale = Math.min(scaleXFit, scaleYFit, 1);

    const scaledWidth = wPx * scale;
    const scaledHeight = hPx * scale;
    const centerX = (svgWidth - scaledWidth) / 2;
    const centerY = (svgHeight - scaledHeight) / 2;
    const rPx = Math.min(
      toPx(radiusInput) * scale,
      (Math.min(wPx, hPx) / 2) * scale
    );

    const topLeft = { x: round(centerX), y: round(centerY) };
    const topRight = { x: round(centerX + scaledWidth), y: round(centerY) };
    const bottomLeft = { x: round(centerX), y: round(centerY + scaledHeight) };
    const bottomRight = {
      x: round(centerX + scaledWidth),
      y: round(centerY + scaledHeight),
    };

    localCtx.save();
    localCtx.beginPath();
    localCtx.moveTo(topLeft.x + rPx, topLeft.y);
    localCtx.lineTo(topRight.x - rPx, topRight.y);
    localCtx.quadraticCurveTo(topRight.x, topRight.y, topRight.x, topRight.y + rPx);
    localCtx.lineTo(bottomRight.x, bottomRight.y - rPx);
    localCtx.quadraticCurveTo(
      bottomRight.x, bottomRight.y, bottomRight.x - rPx, bottomRight.y
    );
    localCtx.lineTo(bottomLeft.x + rPx, bottomLeft.y);
    localCtx.quadraticCurveTo(
      bottomLeft.x, bottomLeft.y, bottomLeft.x, bottomLeft.y - rPx
    );
    localCtx.lineTo(topLeft.x, topLeft.y + rPx);
    localCtx.quadraticCurveTo(topLeft.x, topLeft.y, topLeft.x + rPx, topLeft.y);
    localCtx.closePath();
    localCtx.clip();

    if (currentImage) {
      const imgWidth = bottomRight.x - topLeft.x;
      const imgHeight = bottomLeft.y - topLeft.y;
      const drawWidth = imgWidth;
      const drawHeight = imgHeight;
      localCtx.drawImage(
        currentImage,
        0, 0, currentImage.width, currentImage.height,
        topLeft.x, topLeft.y, drawWidth, drawHeight
      );
    } else {
      localCtx.fillStyle = "#eee";
      localCtx.fill();
    }
    localCtx.restore();

    // Draw outline (BORDER REMOVED for this shape)
    localCtx.beginPath();
    localCtx.moveTo(topLeft.x + rPx, topLeft.y);
    localCtx.lineTo(topRight.x - rPx, topRight.y);
    localCtx.quadraticCurveTo(topRight.x, topRight.y, topRight.x, topRight.y + rPx);
    localCtx.lineTo(bottomRight.x, bottomRight.y - rPx);
    localCtx.quadraticCurveTo(
      bottomRight.x, bottomRight.y, bottomRight.x - rPx, bottomRight.y
    );
    localCtx.lineTo(bottomLeft.x + rPx, bottomLeft.y);
    localCtx.quadraticCurveTo(
      bottomLeft.x, bottomLeft.y, bottomLeft.x, bottomLeft.y - rPx
    );
    localCtx.lineTo(topLeft.x, topLeft.y + rPx);
    localCtx.quadraticCurveTo(topLeft.x, topLeft.y, topLeft.x + rPx, topLeft.y);
    localCtx.closePath();
    localCtx.lineWidth = Math.max(1, 1.2 * scale);
    localCtx.strokeStyle = "#222";
    // localCtx.stroke(); // BORDER REMAINS REMOVED
    
    if (isDisplay) {
      // Dimension lines and text
      localCtx.strokeStyle = "blue";
      localCtx.fillStyle = "blue";
      localCtx.lineWidth = Math.max(1, 1 * scale);
      localCtx.font = `${Math.max(12, 20 * scale)}px Arial`;
      localCtx.textAlign = "center";
      localCtx.textBaseline = "middle";

      const topDimY = topLeft.y - offset;
      drawArrow(localCtx, topLeft.x, topDimY, topRight.x, topDimY, 8);
      drawArrow(localCtx, topRight.x, topDimY, topLeft.x, topDimY, 8);
      localCtx.fillText(
        w.toFixed(2) + " " + units,
        (topLeft.x + topRight.x) / 2,
        topDimY - 12
      );

      const bottomDimY = bottomLeft.y + offset;
      drawArrow(localCtx, bottomLeft.x, bottomDimY, bottomRight.x, bottomDimY, 8);
      drawArrow(localCtx, bottomRight.x, bottomDimY, bottomLeft.x, bottomDimY, 8);
      localCtx.fillText(
        bottom.toFixed(2) + " " + units,
        (bottomLeft.x + bottomRight.x) / 2,
        bottomDimY + 16
      );

      const heightDimX = topRight.x + offset;
      drawArrow(localCtx, heightDimX, topRight.y, heightDimX, bottomRight.y, 8);
      drawArrow(localCtx, heightDimX, bottomRight.y, heightDimX, topRight.y, 8);
      localCtx.save();
      localCtx.translate(heightDimX + 38, (topRight.y + bottomRight.y) / 2);
      localCtx.rotate(-Math.PI / 2);
      localCtx.fillText(h.toFixed(2) + " " + units, 0, 6);
      localCtx.restore();
    }
    
  } else if (diagramType === "square" || diagramType === "square750") {
    w = Number(document.getElementById("sqWidthOnly").value);
    h = Number(document.getElementById("sqHeightOnly").value);
    bottom = w;
    const wPx = toPx(w);
    const hPx = toPx(h);

    const scaleXFit = (svgWidth - 2 * margin) / wPx;
    const scaleYFit = (svgHeight - 2 * margin) / hPx;
    scale = Math.min(scaleXFit, scaleYFit, 1);

    const scaledWidth = wPx * scale;
    const scaledHeight = hPx * scale;
    const centerX = (svgWidth - scaledWidth) / 2;
    const centerY = (svgHeight - scaledHeight) / 2;
    const topLeft = { x: round(centerX), y: round(centerY) };
    const topRight = { x: round(centerX + scaledWidth), y: round(centerY) };
    const bottomLeft = { x: round(centerX), y: round(centerY + scaledHeight) };
    const bottomRight = {
      x: round(centerX + scaledWidth),
      y: round(centerY + scaledHeight),
    };

    localCtx.save();
    localCtx.beginPath();
    localCtx.moveTo(topLeft.x, topLeft.y);
    localCtx.lineTo(topRight.x, topRight.y);
    localCtx.lineTo(bottomRight.x, bottomRight.y);
    localCtx.lineTo(bottomLeft.x, bottomLeft.y);
    localCtx.closePath();
    localCtx.clip();

    if (currentImage) {
      const imgWidth = bottomRight.x - topLeft.x;
      const imgHeight = bottomLeft.y - topLeft.y;
      localCtx.drawImage(
        currentImage,
        0, 0, currentImage.width, currentImage.height,
        topLeft.x, topLeft.y, imgWidth, imgHeight
      );
    } else {
      localCtx.fillStyle = "#eee";
      localCtx.fill();
    }
    localCtx.restore();

    // Draw outline (BORDER REMOVED for this shape)
    localCtx.beginPath();
    localCtx.moveTo(topLeft.x, topLeft.y);
    localCtx.lineTo(topRight.x, topRight.y);
    localCtx.lineTo(bottomRight.x, bottomRight.y);
    localCtx.lineTo(bottomLeft.x, bottomLeft.y);
    localCtx.closePath();
    localCtx.lineWidth = Math.max(1, 1.2 * scale);
    localCtx.strokeStyle = "#222";
    // localCtx.stroke(); // BORDER REMAINS REMOVED
    
    if (isDisplay) {
      // Dimension lines and text
      localCtx.strokeStyle = "blue";
      localCtx.fillStyle = "blue";
      localCtx.lineWidth = Math.max(1, 1 * scale);
      localCtx.font = `${Math.max(12, 20 * scale)}px Arial`;
      localCtx.textAlign = "center";
      localCtx.textBaseline = "middle";

      const topDimY = topLeft.y - offset;
      drawArrow(localCtx, topLeft.x, topDimY, topRight.x, topDimY, 8);
      drawArrow(localCtx, topRight.x, topDimY, topLeft.x, topDimY, 8);
      localCtx.fillText(
        w.toFixed(2) + " " + units,
        (topLeft.x + topRight.x) / 2,
        topDimY - 12
      );

      const bottomDimY = bottomLeft.y + offset;
      drawArrow(localCtx, bottomLeft.x, bottomDimY, bottomRight.x, bottomDimY, 8);
      drawArrow(localCtx, bottomRight.x, bottomDimY, bottomLeft.x, bottomDimY, 8);
      localCtx.fillText(
        bottom.toFixed(2) + " " + units,
        (bottomLeft.x + bottomRight.x) / 2,
        bottomDimY + 16
      );

      const heightDimX = topRight.x + offset;
      drawArrow(localCtx, heightDimX, topRight.y, heightDimX, bottomRight.y, 8);
      drawArrow(localCtx, heightDimX, bottomRight.y, heightDimX, topRight.y, 8);
      localCtx.save();
      localCtx.translate(heightDimX + 38, (topRight.y + bottomRight.y) / 2);
      localCtx.rotate(-Math.PI / 2);
      localCtx.fillText(h.toFixed(2) + " " + units, 0, 6);
      localCtx.restore();
    }
    
  } else if (
    diagramType === "sweetBox500" ||
    diagramType === "sweetBox250" ||
    diagramType === "teSweetBox500" ||
    diagramType === "teSweetBox250"
  ) {
    const w = Number(document.getElementById("sweetWidth").value);
    const h = Number(document.getElementById("sweetHeight").value);
    const bendHeightInput = Number(document.getElementById("sweetBend").value);
    const bendFactor = 0.5;
    const wPx = toPx(w);
    const hPx = toPx(h);
    const bendPx = toPx(bendHeightInput);

    const scaleX = (svgWidth - 2 * margin) / wPx;
    const scaleY = (svgHeight - 2 * margin) / hPx;
    scale = Math.min(scaleX, scaleY, 1);

    const scaledWidth = wPx * scale;
    const scaledHeight = hPx * scale;
    const scaledBend = bendPx * scale;
    const centerX = Math.round(svgWidth / 2);
    const centerY = Math.round(svgHeight / 2);

    const numPoints = 5;
    const topPoints = [];
    for (let i = 0; i < numPoints; i++) {
      const x = centerX - scaledWidth / 2 + (scaledWidth / (numPoints - 1)) * i;
      const bendOffset =
        scaledBend * bendFactor * Math.sin((Math.PI * i) / (numPoints - 1));
      const y = centerY - scaledHeight / 2 - bendOffset;
      topPoints.push({ x, y });
    }

    const angleL = Math.atan2(
      topPoints[1].y - topPoints[0].y,
      topPoints[1].x - topPoints[0].x
    );
    const angleR = Math.atan2(
      topPoints[numPoints - 1].y - topPoints[numPoints - 2].y,
      topPoints[numPoints - 1].x - topPoints[numPoints - 2].x
    );

    const bottomPoints = [];
    for (let i = 0; i < numPoints; i++) {
      let x = centerX - scaledWidth / 2 + (scaledWidth / (numPoints - 1)) * i;
      let y = topPoints[i].y + scaledHeight;
      if (i === 0) x += -Math.tan(angleL) * scaledHeight;
      if (i === numPoints - 1) x += -Math.tan(angleR) * scaledHeight;
      bottomPoints.push({ x, y });
    }
    
    localCtx.save();
    localCtx.beginPath();
    localCtx.moveTo(topPoints[0].x, topPoints[0].y);
    for (let i = 1; i < numPoints; i++) {
      const cpX = (topPoints[i - 1].x + topPoints[i].x) / 2;
      const cpY = (topPoints[i - 1].y + topPoints[i].y) / 2;
      localCtx.quadraticCurveTo(cpX, cpY, topPoints[i].x, topPoints[i].y);
    }
    localCtx.lineTo(bottomPoints[numPoints - 1].x, bottomPoints[numPoints - 1].y);
    for (let i = bottomPoints.length - 2; i >= 0; i--) {
      const cpX = (bottomPoints[i + 1].x + bottomPoints[i].x) / 2;
      const cpY = (bottomPoints[i + 1].y + bottomPoints[i].y) / 2;
      localCtx.quadraticCurveTo(cpX, cpY, bottomPoints[i].x, bottomPoints[i].y);
    }
    localCtx.closePath();
    localCtx.clip();

    if (currentImage) {
      const sliceCount = 1000;
      const imgWidth = currentImage.width;
      const imgHeight = currentImage.height;
      const sliceW = imgWidth / sliceCount;

      for (let i = 0; i < sliceCount; i++) {
        const t = i / sliceCount;
        const nextT = (i + 1) / sliceCount;
        const segmentLength = 1 / (numPoints - 1);
        const segmentIndex = Math.min(
          Math.floor(t / segmentLength), numPoints - 2
        );
        const localT = (t - segmentLength * segmentIndex) / segmentLength;
        const nextSegmentIndex = Math.min(
          Math.floor(nextT / segmentLength), numPoints - 2
        );
        const nextLocalT =
          (nextT - segmentLength * nextSegmentIndex) / segmentLength;

        const topX1 = lerp(
          topPoints[segmentIndex].x, topPoints[segmentIndex + 1].x, localT
        );
        const topY1 = lerp(
          topPoints[segmentIndex].y, topPoints[segmentIndex + 1].y, localT
        );
        const topX2 = lerp(
          topPoints[nextSegmentIndex].x, topPoints[nextSegmentIndex + 1].x, nextLocalT
        );
        const topY2 = lerp(
          topPoints[nextSegmentIndex].y, topPoints[nextSegmentIndex + 1].y, nextLocalT
        );
        const sliceAngle = Math.atan2(topY2 - topY1, topX2 - topX1);
        const bottomX1 = lerp(
          bottomPoints[segmentIndex].x, bottomPoints[segmentIndex + 1].x, localT
        );
        const bottomY1 = lerp(
          bottomPoints[segmentIndex].y, bottomPoints[segmentIndex + 1].y, localT
        );
        const sliceHeight = Math.hypot(bottomX1 - topX1, bottomY1 - topY1);
        const sliceWidth = Math.hypot(topX2 - topX1, topY2 - topY1);

        localCtx.save();
        localCtx.translate(topX1, topY1);
        localCtx.rotate(sliceAngle);
        localCtx.drawImage(
          currentImage,
          i * sliceW, 0, sliceW, imgHeight,
          0, 0, sliceWidth + 1.1, sliceHeight // ====== FIX: GAP REMOVED ======
        );
        localCtx.restore();
      }
    } else {
      localCtx.fillStyle = "#eee";
      localCtx.fill();
    }
    localCtx.restore();

    // Draw shape outline (BORDER REMAINS ENABLED for this shape)
    localCtx.beginPath();
    localCtx.moveTo(topPoints[0].x, topPoints[0].y);
    for (let i = 1; i < numPoints; i++) {
      const cpX = (topPoints[i - 1].x + topPoints[i].x) / 2;
      const cpY = (topPoints[i - 1].y + topPoints[i].y) / 2;
      localCtx.quadraticCurveTo(cpX, cpY, topPoints[i].x, topPoints[i].y);
    }
    localCtx.lineTo(bottomPoints[numPoints - 1].x, bottomPoints[numPoints - 1].y);
    for (let i = bottomPoints.length - 2; i >= 0; i--) {
      const cpX = (bottomPoints[i + 1].x + bottomPoints[i].x) / 2;
      const cpY = (bottomPoints[i + 1].y + bottomPoints[i].y) / 2;
      localCtx.quadraticCurveTo(cpX, cpY, bottomPoints[i].x, bottomPoints[i].y);
    }
    localCtx.closePath();
    localCtx.lineWidth = Math.max(1, 1.2 * scale);
    localCtx.strokeStyle = "#222";
    localCtx.stroke(); // BORDER IS ON
    
    if (isDisplay) {
      // === Dimensions ===
      localCtx.strokeStyle = "blue";
      localCtx.fillStyle = "blue";
      localCtx.lineWidth = Math.max(1, 1 * scale);
      localCtx.font = `${Math.max(12, 20 * scale)}px Arial`;
      localCtx.textAlign = "center";
      localCtx.textBaseline = "middle";

      // Top width dimension
      const topDimY = centerY - scaledHeight / 2 - 30 - scaledBend * bendFactor;
      drawArrow(
        localCtx,
        topPoints[0].x, topDimY, topPoints[numPoints - 1].x, topDimY, 8
      );
      drawArrow(
        localCtx,
        topPoints[numPoints - 1].x, topDimY, topPoints[0].x, topDimY, 8
      );
      localCtx.fillText(w.toFixed(2) + " " + units, centerX, topDimY - 12);

      // Left height dimension
      const heightDimX = topPoints[0].x - 30;
      drawArrow(
        localCtx,
        heightDimX, topPoints[0].y, heightDimX, bottomPoints[0].y, 8
      );
      drawArrow(
        localCtx,
        heightDimX, bottomPoints[0].y, heightDimX, topPoints[0].y, 8
      );
      localCtx.save();
      localCtx.translate(heightDimX - 8, (topPoints[0].y + bottomPoints[0].y) / 2);
      localCtx.rotate(-Math.PI / 2);
      localCtx.fillText(h.toFixed(2) + " " + units, 0, 0);
      localCtx.restore();

      // Bend height dimension (rotated text)
      const bendDimX = centerX + scaledWidth / 2 + 30;
      const bendStartY = bottomPoints[0].y;
      const bendEndY = topPoints[Math.floor(numPoints / 2)].y;
      drawArrow(localCtx, bendDimX, bendStartY, bendDimX, bendEndY, 8);
      drawArrow(localCtx, bendDimX, bendEndY, bendDimX, bendStartY, 8);

      const bendTextX = bendDimX + 12;
      const bendTextY = (bendStartY + bendEndY) / 2;
      localCtx.save();
      localCtx.translate(bendTextX, bendTextY);
      localCtx.rotate(-Math.PI / 2); // Rotate text vertically
      localCtx.fillText(bendHeightInput.toFixed(2) + " " + units, 0, 0);
      localCtx.restore();
    }
    
  } else {
    localCtx.font = "24px Arial";
    localCtx.textAlign = "center";
    localCtx.textBaseline = "middle";
    localCtx.fillText("Select a diagram type", svgWidth / 2, svgHeight / 2);
  }
}

// Renamed to avoid conflict
function drawKLDForExport_Flat() {
  // Create a temporary canvas for export
  const exportCanvas = document.createElement("canvas");
  const exportCtx = exportCanvas.getContext("2d");
  
  // --- QUALITY IMPROVEMENT ---
  exportCtx.imageSmoothingEnabled = true;
  exportCtx.imageSmoothingQuality = 'high';

  // Set export canvas size based on the main canvas
  exportCanvas.width = canvas.width;
  exportCanvas.height = canvas.height;
  
  // Apply the same scaling as the main canvas
  exportCtx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
  
  // Call the flat drawing logic on the export context, with "export" mode
  drawKLD_Flat(exportCtx, "export"); // Pass "export" mode
  
  return exportCanvas;
}

// --- FLAT KLD HELPER FUNCTIONS ---
function drawArrow(ctx, fromX, fromY, toX, toY, size = 10) {
  const headlen = size;
  const dx = toX - fromX;
  const dy = toY - fromY;
  const angle = Math.atan2(dy, dx);
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(
    toX - headlen * Math.cos(angle - Math.PI / 6),
    toY - headlen * Math.sin(angle - Math.PI / 6)
  );
  ctx.lineTo(
    toX - headlen * Math.cos(angle + Math.PI / 6),
    toY - headlen * Math.sin(angle + Math.PI / 6)
  );
  ctx.lineTo(toX, toY);
  ctx.fill();
}

function quadraticAt(p0, p1, p2, t) {
  return (1 - t) * (1 - t) * p0 + 2 * (1 - t) * t * p1 + t * t * p2;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

// ===================================================================
// --- EXPORT & DOWNLOAD ROUTERS ---
// ===================================================================

document.getElementById("export").addEventListener("click", () => {
  if (!currentImage) {
    alert("Please upload an image first.");
    return;
  }
  
  let exportCanvas;
  const diagramType = document.getElementById("diagramType").value;
  
  // ROUTER: Call the correct export function
  if (
    diagramType.startsWith("curveRectangle") &&
    !diagramType.endsWith("_square")
  ) {
    exportCanvas = drawKLDForExport_Arc();
  } else {
    exportCanvas = drawKLDForExport_Flat();
  }

  if (exportCanvas) {
    const imgData = exportCanvas.toDataURL("image/png");
    const modelLabel = getModelLabel().replace(/\s+/g, '_');
    const fileName = `${modelLabel}.png`;
    downloadFile(imgData, fileName, DPI);
  }
  
  // Restore the display canvas
  drawKLD();
});

document.getElementById("exportSvg").addEventListener("click", () => {
  if (!currentImage) {
    alert("Please upload an image first.");
    return;
  }

  let diagramType = document.getElementById("diagramType").value;
  const orientation =
    document.querySelector('input[name="sweetBoxSide"]:checked')?.value ||
    "bottom";

  // ROUTER: Call the correct SVG export function
  if (
    diagramType.startsWith("curveRectangle") &&
    !diagramType.endsWith("_square")
  ) {
    // Use Arc Wrap SVG export
    exportArcWrapAsSVG_Arc();
  } else if (
    (diagramType.startsWith("sweetBox") || diagramType.startsWith("teSweetBox")) &&
    orientation === "top"
  ) {
    exportRectangleRadiusAsSVG();
  } else if (
    diagramType.startsWith("sweetBox") || diagramType.startsWith("teSweetBox")
  ) {
    exportSweetBoxAsSVG();
  } else if (diagramType.endsWith("_square")) {
    // This is the flat "Round Square"
    exportAsWarpedSVG_Flat();
  } else if (diagramType === "squareWithRadius750") {
    exportRectangleRadiusAsSVG();
  } else if (diagramType === "square" || diagramType === "square750") {
    exportRectangleAsSVG();
  }
});

function getModelLabel() {
  const modelSelect = document.getElementById("modelType");
  const selectedOption = modelSelect.options[modelSelect.selectedIndex];
  return selectedOption.textContent || "custom";
}

// --- PNG DOWNLOAD HELPERS ---
function downloadFile(dataUrl, filename, dpi = DPI) {
  if (filename.endsWith(".png")) {
    dataUrl = setPngDpi(dataUrl, dpi);
  }
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function setPngDpi(dataUrl, dpi) {
  try {
    const binary = atob(dataUrl.split(",")[1]);
    const buffer = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) buffer[i] = binary.charCodeAt(i);
    const ppm = Math.round(dpi / 0.0254);
    
    let iendPos = -1;
    let start = 8;
    while(start < buffer.length) {
        const chunkLen = (buffer[start] << 24) | (buffer[start+1] << 16) | (buffer[start+2] << 8) | buffer[start+3];
        const chunkType = String.fromCharCode(buffer[start+4], buffer[start+5], buffer[start+6], buffer[start+7]);
        if (chunkType === 'IEND') {
            iendPos = start;
            break;
        }
        start += chunkLen + 12;
    }
    if (iendPos === -1) iendPos = 8;

    const chunk = new Uint8Array([
      0x00, 0x00, 0x00, 0x09,
      0x70, 0x48, 0x59, 0x73,
      (ppm >>> 24) & 0xff, (ppm >>> 16) & 0xff, (ppm >>> 8) & 0xff, ppm & 0xff,
      (ppm >>> 24) & 0xff, (ppm >>> 16) & 0xff, (ppm >>> 8) & 0xff, ppm & 0xff,
      0x01,
    ]);
    
    const header = buffer.slice(0, iendPos);
    const rest = buffer.slice(iendPos);
    // Create new buffer: header + pHYs chunk + rest (IEND)
    const newBuf = new Uint8Array(header.length + chunk.length + rest.length);
    newBuf.set(header, 0);
    newBuf.set(chunk, header.length);
    newBuf.set(rest, header.length + chunk.length);

    return "data:image/png;base64," + btoa(String.fromCharCode(...newBuf));
  } catch(e) {
    console.warn("Failed to set PNG DPI:", e);
    return dataUrl;
  }
}

// ===================================================================
// --- SVG EXPORT FUNCTIONS (ALL) ---
// ===================================================================

// --- SVG Export (Arc Wrap) ---
function exportArcWrapAsSVG_Arc() {
  const topCirc = Number(document.getElementById("topWidth").value);
  const bottomCirc = Number(document.getElementById("bottomWidth").value);
  const height = Number(document.getElementById("height").value);
  const totalBendHeight = totalBendHeightInput
    ? Number(totalBendHeightInput.value)
    : null;
  const geo = getArcWrapGeometry(topCirc, bottomCirc, height, totalBendHeight);
  if (!geo) return;

  const wrapWidthMM = geo.totalWidth;
  const wrapHeightMM = geo.totalHeight;
  const svgWidthMM = wrapWidthMM + 2 * EXPORT_MARGIN_MM;
  const svgHeightMM = wrapHeightMM + 2 * EXPORT_MARGIN_MM;

  const rasterCanvas = drawKLDForExport_Arc(); // Call Arc export
  if (!rasterCanvas) return;
  const rasterData = rasterCanvas.toDataURL("image/png");
  const rasterImgWidthMM = rasterCanvas.width / (DPI * MM_TO_INCH);
  const rasterImgHeightMM = rasterCanvas.height / (DPI * MM_TO_INCH);

  const centerX = EXPORT_MARGIN_MM + wrapWidthMM / 2;
  const centerY = EXPORT_MARGIN_MM + geo.R_outer;
  const startAngle = -Math.PI / 2 - geo.theta / 2;
  const endAngle = -Math.PI / 2 + geo.theta / 2;

  function polarToCart(r, angle) {
    return {
      x: centerX + r * Math.cos(angle),
      y: centerY + r * Math.sin(angle),
    };
  }

  const p_top_start = polarToCart(geo.R_top, startAngle);
  const p_top_end = polarToCart(geo.R_top, endAngle);
  const p_bottom_end = polarToCart(geo.R_bottom, endAngle);
  const p_bottom_start = polarToCart(geo.R_bottom, startAngle);

  const largeArcFlag = geo.theta > Math.PI ? 1 : 0;

  const pathD = [
    `M ${p_top_start.x.toFixed(5)} ${p_top_start.y.toFixed(5)}`,
    `A ${geo.R_top.toFixed(5)} ${geo.R_top.toFixed(5)} 0 ${largeArcFlag} 1 ${
      p_top_end.x.toFixed(5)
    } ${p_top_end.y.toFixed(5)}`,
    `L ${p_bottom_end.x.toFixed(5)} ${p_bottom_end.y.toFixed(5)}`,
    `A ${geo.R_bottom.toFixed(5)} ${geo.R_bottom.toFixed(
      5
    )} 0 ${largeArcFlag} 0 ${p_bottom_start.x.toFixed(5)} ${
      p_bottom_start.y.toFixed(5)
    }`,
    `Z`,
  ].join(" ");

  let svg =
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${svgWidthMM.toFixed(
      2
    )}mm" height="${svgHeightMM.toFixed(2)}mm" viewBox="0 0 ${svgWidthMM.toFixed(
      2
    )} ${svgHeightMM.toFixed(2)}">` +
    `<defs>` +
    `<mask id="wrapMask">` +
    `<path d="${pathD}" fill="white" />` +
    `</mask>` +
    `</defs>` +
    `<image xlink:href="${rasterData}" x="0" y="0" width="${rasterImgWidthMM.toFixed(
      2
    )}" height="${rasterImgHeightMM.toFixed(
      2
    )}" mask="url(#wrapMask)" preserveAspectRatio="none"/>`;
    
  // --- BORDER LOGIC for Arc Wrap SVG ---
  // Only add the border path if no image is present
  if (!currentImage) {
    svg += `<path d="${pathD}" fill="none" stroke="#222" stroke-width="0.2mm"/>`;
  }
  
  svg += `</svg>`;

  downloadFile(
    "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg),
    `${getModelLabel().replace(/\s+/g, '_')}.svg`
  );
}

// --- SVG Export (Flat KLD - Rectangle) ---
function exportRectangleAsSVG() {
  const units = DEFAULT_UNIT;
  const toPx = (value) => value * unitToPx[units];
  const svgWidth = canvas.clientWidth;
  const svgHeight = canvas.clientHeight;
  const margin = 60;
  const w = Number(document.getElementById("sqWidthOnly").value);
  const h = Number(document.getElementById("sqHeightOnly").value);
  const wPx = toPx(w);
  const hPx = toPx(h);

  const scaleXFit = (svgWidth - 2 * margin) / wPx;
  const scaleYFit = (svgHeight - 2 * margin) / hPx;
  const scale = Math.min(scaleXFit, scaleYFit, 1);
  const scaledWidth = wPx * scale;
  const scaledHeight = hPx * scale;
  const x = (svgWidth - scaledWidth) / 2;
  const y = (svgHeight - scaledHeight) / 2;

  // Define shape for clip-path only
  const svgShape = `<rect x="${x}" y="${y}" width="${scaledWidth}" height="${scaledHeight}"/>`;

  const compositeCanvas = document.createElement('canvas');
  compositeCanvas.width = svgWidth * 2;
  compositeCanvas.height = svgHeight * 2;
  const compositeCtx = compositeCanvas.getContext('2d');
  compositeCtx.imageSmoothingEnabled = true;
  compositeCtx.imageSmoothingQuality = 'high';
  compositeCtx.scale(2, 2);

  // Draw stretched image
  compositeCtx.drawImage(
    currentImage, 
    0, 0, currentImage.width, currentImage.height,
    x, y, scaledWidth, scaledHeight
  );

  const compositeImageData = compositeCanvas.toDataURL('image/png', 1.0);

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" 
         xmlns:xlink="http://www.w3.org/1999/xlink"
         width="${svgWidth}" height="${svgHeight}">
      <defs>
        <clipPath id="clipPath">
          ${svgShape}
        </clipPath>
      </defs>
      <image xlink:href="${compositeImageData}"
             x="0" y="0"
             width="${svgWidth}"
             height="${svgHeight}"
             clip-path="url(#clipPath)" 
             preserveAspectRatio="none"/>
      </svg>`;

  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  const modelLabel = getModelLabel().replace(/\s+/g, '_');
  link.download = `${modelLabel}.svg`;
  link.click();
}

// --- SVG Export (Flat KLD - Rectangle w/ Radius) ---
function exportRectangleRadiusAsSVG() {
  const units = DEFAULT_UNIT;
  const toPx = (value) => value * unitToPx[units];
  const svgWidth = canvas.clientWidth;
  const svgHeight = canvas.clientHeight;
  const margin = 60;
  const w = Number(document.getElementById("sqWidth").value);
  const h = Number(document.getElementById("sqHeight").value);
  const radiusInput = Number(document.getElementById("radius")?.value || 0);
  const wPx = toPx(w);
  const hPx = toPx(h);
  const rPx = Math.min(toPx(radiusInput), wPx / 2, hPx / 2);

  const scaleXFit = (svgWidth - 2 * margin) / wPx;
  const scaleYFit = (svgHeight - 2 * margin) / hPx;
  const scale = Math.min(scaleXFit, scaleYFit, 1);
  const scaledWidth = wPx * scale;
  const scaledHeight = hPx * scale;
  const scaledRadius = rPx * scale;
  const x = (svgWidth - scaledWidth) / 2;
  const y = (svgHeight - scaledHeight) / 2;

  // Define shape for clip-path only
  const svgShape = `<rect 
                      x="${x}" y="${y}" 
                      width="${scaledWidth}" height="${scaledHeight}" 
                      rx="${scaledRadius}" ry="${scaledRadius}" />`;

  const compositeCanvas = document.createElement('canvas');
  compositeCanvas.width = svgWidth * 2;
  compositeCanvas.height = svgHeight * 2;
  const compositeCtx = compositeCanvas.getContext('2d');
  compositeCtx.imageSmoothingEnabled = true;
  compositeCtx.imageSmoothingQuality = 'high';
  compositeCtx.scale(2, 2);
  
  // Draw stretched image
  compositeCtx.drawImage(
    currentImage,
    0, 0, currentImage.width, currentImage.height,
    x, y, scaledWidth, scaledHeight
  );

  const compositeImageData = compositeCanvas.toDataURL('image/png', 1.0);

  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" 
       xmlns:xlink="http://www.w3.org/1999/xlink"
       width="${svgWidth}" height="${svgHeight}">
    <defs>
      <clipPath id="clipPath">
        ${svgShape}
      </clipPath>
    </defs>
    <image xlink:href="${compositeImageData}" 
           x="0" y="0" 
           width="${svgWidth}" height="${svgHeight}" 
           clip-path="url(#clipPath)"
           preserveAspectRatio="none" />
    </svg>`;

  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  const modelLabel = getModelLabel().replace(/\s+/g, '_');
  link.download = `${modelLabel}.svg`;
  link.click();
}

// --- SVG Export (Flat KLD - Warped/Bent) ---
function exportAsWarpedSVG_Flat() {
  const diagramType = document.getElementById("diagramType").value;
  const units = DEFAULT_UNIT;
  function toPx(value) {
    return value * unitToPx[units];
  }

  let w = Number(document.getElementById("topWidth").value);
  let h = Number(document.getElementById("height").value);
  let bottom = Number(document.getElementById("bottomWidth").value);
  const wPx = toPx(w);
  const hPx = toPx(h);
  const bottomPx = toPx(bottom);
  const verticalHeight = hPx;
  const svgWidth = canvas.clientWidth;
  const svgHeight = canvas.clientHeight;
  const horizontalMargin = 50;
  const verticalMargin = 100;
  const topMargin = 80;

  const scaleXFit = (svgWidth - 2 * horizontalMargin) / Math.max(wPx, bottomPx);
  const scaleYFit = (svgHeight - 2 * verticalMargin - topMargin) / verticalHeight;
  const scale = Math.min(scaleXFit, scaleYFit);

  const scaledWidth = wPx * scale;
  const scaledHeight = verticalHeight * scale;
  const scaledBottomWidth = bottomPx * scale;
  const scaledMaxWidth = Math.max(wPx, bottomPx) * scale;
  const centerX = (svgWidth - scaledMaxWidth) / 2;
  const centerY = (svgHeight - scaledHeight) / 2 + topMargin;

  const topLeft = {
    x: Math.round(centerX + (scaledMaxWidth - scaledWidth) / 2),
    y: Math.round(centerY),
  };
  const topRight = {
    x: Math.round(centerX + (scaledMaxWidth + scaledWidth) / 2),
    y: Math.round(centerY),
  };
  const bottomLeft = {
    x: Math.round(centerX + (scaledMaxWidth - scaledBottomWidth) / 2),
    y: Math.round(centerY + scaledHeight),
  };
  const bottomRight = {
    x: Math.round(centerX + (scaledMaxWidth + scaledBottomWidth) / 2),
    y: bottomLeft.y,
  };

  const bendFactors = {
    curveRectangle500g_square: 0.2,
    curveRectangle500ml_square: 0.25,
  };
  const BEND_SCALE = 0.1;
  const bendFactor = bendFactors[diagramType] || 0.0;
  const bendAmount = scaledHeight * bendFactor * BEND_SCALE;
  const curveOffsetTop = bendAmount;
  const curveOffsetBottom = bendAmount;

  let topPoints = [], bottomPoints = [];
  for (let i = 0; i <= 100; i++) {
    const t = i / 100;
    const topX = topLeft.x + (topRight.x - topLeft.x) * t;
    const topY = quadraticAt(topLeft.y, topLeft.y - curveOffsetTop, topRight.y, t);
    topPoints.push({ x: topX, y: topY });
    const bottomX = bottomLeft.x + (bottomRight.x - bottomLeft.x) * t;
    const bottomY = quadraticAt(bottomLeft.y, bottomRight.y + curveOffsetBottom, bottomRight.y, t);
    bottomPoints.push({ x: bottomX, y: bottomY });
  }

  let pathData = `M ${round(topPoints[0].x)},${round(topPoints[0].y)}`;
  topPoints.forEach((p) => { pathData += ` L ${round(p.x)},${round(p.y)}`; });
  bottomPoints.reverse().forEach((p) => { pathData += ` L ${round(p.x)},${round(p.y)}`; });
  pathData += " Z";

  const compositeCanvas = document.createElement("canvas");
  compositeCanvas.width = svgWidth * 2;
  compositeCanvas.height = svgHeight * 2;
  const compositeCtx = compositeCanvas.getContext("2d");
  compositeCtx.imageSmoothingEnabled = true;
  compositeCtx.imageSmoothingQuality = 'high';
  compositeCtx.scale(2, 2);

  const imgWidth = currentImage.width;
  const imgHeight = currentImage.height;
  const sliceCount = 2000;
  const sliceW = imgWidth / sliceCount;

  for (let i = 0; i < sliceCount; i++) {
    const sx = i * sliceW, sw = sliceW;
    const t1 = i / sliceCount, t2 = (i + 1) / sliceCount;
    const topX1 = topLeft.x + (topRight.x - topLeft.x) * t1;
    const topY1 = quadraticAt(topLeft.y, topLeft.y - curveOffsetTop, topRight.y, t1);
    const topX2 = topLeft.x + (topRight.x - topLeft.x) * t2;
    const topY2 = quadraticAt(topLeft.y, topLeft.y - curveOffsetTop, topRight.y, t2);
    const bottomX1 = bottomLeft.x + (bottomRight.x - bottomLeft.x) * t1;
    const bottomY1 = quadraticAt(bottomLeft.y, bottomRight.y + curveOffsetBottom, bottomRight.y, t1);
    const bottomX2 = bottomLeft.x + (bottomRight.x - bottomLeft.x) * t2;
    const bottomY2 = quadraticAt(bottomLeft.y, bottomRight.y + curveOffsetBottom, bottomRight.y, t2);
    const sliceWidth = Math.hypot(topX2 - topX1, topY2 - topY1);
    const sliceHeight = Math.hypot(bottomX1 - topX1, bottomY1 - topY1);
    const angle = (Math.atan2(topY2 - topY1, topX2 - topX1) + Math.atan2(bottomY2 - bottomY1, bottomX2 - bottomX1)) / 2;

    compositeCtx.save();
    compositeCtx.translate(topX1, topY1);
    compositeCtx.rotate(angle);
    compositeCtx.drawImage(
      currentImage,
      sx, 0, sw, imgHeight,
      0, 0, sliceWidth + 1.1, sliceHeight // ====== FIX: GAP REMOVED ======
    );
    compositeCtx.restore();
  }

  const compositeImageData = compositeCanvas.toDataURL("image/png", 1.0);
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" 
       width="${svgWidth}" height="${svgHeight}">
    <defs>
      <clipPath id="shapeClip">
        <path d="${pathData}" />
      </clipPath>
    </defs>
    <image xlink:href="${compositeImageData}" x="0" y="0" 
           width="${svgWidth}" height="${svgHeight}" 
           clip-path="url(#shapeClip)" preserveAspectRatio="none"/>
    <path d="${pathData}" fill="none" stroke="black" stroke-width="1.2"/>
  </svg>`;

  const blob = new Blob([svg], { type: "image/svg+xml" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  const modelLabel = getModelLabel().replace(/\s+/g, '_');
  link.download = `${modelLabel}.svg`;
  link.click();

  function round(val) { return Number(val.toFixed(3)); }
}

// --- SVG Export (Flat KLD - SweetBox) ---
function exportSweetBoxAsSVG() {
  const units = DEFAULT_UNIT;
  const toPx = (value) => value * unitToPx[units];
  const w = Number(document.getElementById("sweetWidth").value);
  const h = Number(document.getElementById("sweetHeight").value);
  const bendHeightInput = Number(document.getElementById("sweetBend").value);
  const bendFactor = 0.5;
  const wPx = toPx(w), hPx = toPx(h), bendPx = toPx(bendHeightInput);
  const margin = 60;
  const svgWidth = canvas.clientWidth;
  const svgHeight = canvas.clientHeight;
  const scaleX = (svgWidth - 2 * margin) / wPx;
  const scaleY = (svgHeight - 2 * margin) / hPx;
  const scale = Math.min(scaleX, scaleY, 1);
  const scaledWidth = wPx * scale, scaledHeight = hPx * scale, scaledBend = bendPx * scale;
  const centerX = Math.round(svgWidth / 2);
  const centerY = Math.round(svgHeight / 2);

  const numPoints = 5;
  const topPoints = [], bottomPoints = [];
  for (let i = 0; i < numPoints; i++) {
    const x = centerX - scaledWidth / 2 + (scaledWidth / (numPoints - 1)) * i;
    const bendOffset = scaledBend * bendFactor * (1 - Math.sin((Math.PI * i) / (numPoints - 1)));
    const y = centerY - scaledHeight / 2 - bendOffset;
    topPoints.push({ x, y });
  }
  const angleL = Math.atan2(topPoints[1].y - topPoints[0].y, topPoints[1].x - topPoints[0].x);
  const angleR = Math.atan2(
    topPoints[numPoints - 1].y - topPoints[numPoints - 2].y,
    topPoints[numPoints - 1].x - topPoints[numPoints - 2].x
  );
  for (let i = 0; i < numPoints; i++) {
    let x = centerX - scaledWidth / 2 + (scaledWidth / (numPoints - 1)) * i;
    let y = topPoints[i].y + scaledHeight;
    if (i === 0) x += -Math.tan(angleL) * scaledHeight;
    if (i === numPoints - 1) x += -Math.tan(angleR) * scaledHeight;
    bottomPoints.push({ x, y });
  }

  let pathData = `M ${topPoints[0].x},${topPoints[0].y}`;
  for (let i = 1; i < numPoints; i++) {
    const cpX = (topPoints[i - 1].x + topPoints[i].x) / 2;
    const cpY = (topPoints[i - 1].y + topPoints[i].y) / 2;
    pathData += ` Q ${cpX},${cpY} ${topPoints[i].x},${topPoints[i].y}`;
  }
  pathData += ` L ${bottomPoints[numPoints - 1].x},${bottomPoints[numPoints - 1].y}`;
  for (let i = bottomPoints.length - 2; i >= 0; i--) {
    const cpX = (bottomPoints[i + 1].x + bottomPoints[i].x) / 2;
    const cpY = (bottomPoints[i + 1].y + bottomPoints[i].y) / 2;
    pathData += ` Q ${cpX},${cpY} ${bottomPoints[i].x},${bottomPoints[i].y}`;
  }
  pathData += ' Z';

  const compositeCanvas = document.createElement('canvas');
  compositeCanvas.width = svgWidth * 2;
  compositeCanvas.height = svgHeight * 2;
  const compositeCtx = compositeCanvas.getContext('2d');
  compositeCtx.imageSmoothingEnabled = true;
  compositeCtx.imageSmoothingQuality = 'high';
  compositeCtx.scale(2, 2);

  const sliceCount = 2500;
  const imgWidth = currentImage.width;
  const imgHeight = currentImage.height;
  const sliceW = imgWidth / sliceCount;

  for (let i = 0; i < sliceCount; i++) {
    const t = i / sliceCount, nextT = (i + 1) / sliceCount;
    const segmentLength = 1 / (numPoints - 1);
    const segmentIndex = Math.min(Math.floor(t / segmentLength), numPoints - 2);
    const localT = (t - segmentLength * segmentIndex) / segmentLength;
    const nextSegmentIndex = Math.min(Math.floor(nextT / segmentLength), numPoints - 2);
    const nextLocalT = (nextT - segmentLength * nextSegmentIndex) / segmentLength;

    const topX1 = lerp(topPoints[segmentIndex].x, topPoints[segmentIndex + 1].x, localT);
    const topY1 = lerp(topPoints[segmentIndex].y, topPoints[segmentIndex + 1].y, localT);
    const topX2 = lerp(topPoints[nextSegmentIndex].x, topPoints[nextSegmentIndex + 1].x, nextLocalT);
    const topY2 = lerp(topPoints[nextSegmentIndex].y, topPoints[nextSegmentIndex + 1].y, nextLocalT);
    const bottomX1 = lerp(bottomPoints[segmentIndex].x, bottomPoints[segmentIndex + 1].x, localT);
    const bottomY1 = lerp(bottomPoints[segmentIndex].y, bottomPoints[segmentIndex + 1].y, localT);
    const sliceAngle = Math.atan2(topY2 - topY1, topX2 - topX1);
    const sliceHeight = Math.hypot(bottomX1 - topX1, bottomY1 - topY1);
    const sliceWidth = Math.hypot(topX2 - topX1, topY2 - topY1);

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = sliceW; tempCanvas.height = imgHeight;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.imageSmoothingEnabled = true;
    tempCtx.imageSmoothingQuality = 'high';
    tempCtx.drawImage(currentImage, i * sliceW, 0, sliceW, imgHeight, 0, 0, sliceW, imgHeight);

    compositeCtx.save();
    compositeCtx.translate(topX1, topY1);
    compositeCtx.rotate(sliceAngle);
    compositeCtx.drawImage(tempCanvas, 0, 0, sliceWidth + 1.1, sliceHeight); // ====== FIX: GAP REMOVED ======
    compositeCtx.restore();
  }

  const compositeImageData = compositeCanvas.toDataURL('image/png', 1.0);

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" 
         xmlns:xlink="http://www.w3.org/1999/xlink" 
         width="${svgWidth}" height="${svgHeight}">
      <defs>
        <clipPath id="clipPath">
          <path d="${pathData}" />
        </clipPath>
      </defs>
      <image xlink:href="${compositeImageData}"
             x="0" y="0"
             width="${svgWidth}"
             height="${svgHeight}"
             clip-path="url(#clipPath)"
             preserveAspectRatio="none"/>
    <path d="${pathData}" fill="none" stroke="black" stroke-width="1.2"/>
    </svg>`;

  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  const modelLabel = getModelLabel().replace(/\s+/g, '_');
  link.download = `${modelLabel}.svg`;
  link.click();
}

// ===================================================================
// --- INITIALIZATION ---
// ===================================================================

document.querySelectorAll('input[name="sweetBoxSide"]').forEach((radio) => {
  radio.addEventListener("change", () => {
    updateInputs();
    updateDimensionText();
    drawKLD();
  });
});

window.onload = () => {
  loadStateFromLocalStorage(); // Load state first
  
  // Set default shape if nothing loaded
  if (!document.getElementById("shapeType").value) {
     document.getElementById("shapeType").value = "round";
  }
  
  updateModels(); // This will populate models
  updateDimensionText(); // This will set dimension text
  
  // Apply model *after* loading state to ensure defaults are correct
  // if state was partially loaded or empty
  if (!document.getElementById("diagramType").value) {
     applyModel();
  } else {
     updateInputs(); // Just update inputs based on loaded state
  }

  resizeCanvas();
  drawKLD(); // Initial draw
};