const DEFAULT_UNIT = "mm"; // always use mm
let currentImage = null;

function saveStateToLocalStorage() {
  const state = {
    diagramType: document.getElementById("diagramType").value,
    topWidth: document.getElementById("topWidth").value,
    bottomWidth: document.getElementById("bottomWidth").value,
    height: document.getElementById("height").value,
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

  document.getElementById("sqWidth").value = state.sqWidth || "";
  document.getElementById("sqHeight").value = state.sqHeight || "";
  document.getElementById("radius").value = state.radius || "";

  document.getElementById("sqWidthOnly").value = state.sqWidthOnly || "";
  document.getElementById("sqHeightOnly").value = state.sqHeightOnly || "";
}

const canvas = document.getElementById("kldCanvas");
const ctx = canvas.getContext("2d");

function resizeCanvas() {
  const styles = getComputedStyle(canvas);
  canvas.width = canvas.clientWidth * window.devicePixelRatio;
  canvas.height = canvas.clientHeight * window.devicePixelRatio;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
}

window.addEventListener("resize", () => {
  resizeCanvas();
  drawKLD();
});

document
  .getElementById("imageUpload")
  .addEventListener("input", handleImageUpload);

[
  "topWidth",
  "bottomWidth",
  "height",
  "sqWidth",
  "sqHeight",
  "radius",
  "sqWidthOnly",
  "sqHeightOnly",
].forEach((id) => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener("input", () => {
      drawKLD();
      saveStateToLocalStorage();
    });
  }
});

const uploadText = document.getElementById("uploadText");

// Parse Dimension Text
// function parseDimensions(dimensionText) {
//   const parts = dimensionText.split('x').map(s => s.trim().replace('px', ''));
//   if (parts.length !== 2) return null;
//   return {
//     width: parseFloat(parts[0]),
//     height: parseFloat(parts[1]),
//   };
// }

const imgError = document.getElementById("imgerror");
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
      const model = document.getElementById("modelType").value;
      const expected = modelDimensions[model];

      if (expected) {
        if (img.width < expected[0] || img.height < expected[1]) {
          imgError.style.display = "block";
          imgError.innerHTML = `Uploaded image size (${img.width}x${img.height}) is smaller than required dimensions (${expected[0]}x${expected[1]}). Please upload a larger image.`;
          fileInput.value = "";
          uploadText.innerHTML =
            "Drag and drop file here or <span>Browse</span>";
          return;
        }
      }

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
      drawKLD();
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

const dropArea = document.getElementById("dropArea");
const fileInput = document.getElementById("imageUpload");

// Highlight the area on dragging
dropArea.addEventListener("dragover", function (e) {
  e.preventDefault();
  dropArea.classList.add("dragover");
});

// Remove highlight when dragging leaves
dropArea.addEventListener("dragleave", function (e) {
  e.preventDefault();
  dropArea.classList.remove("dragover");
});

// Handle dropped files
dropArea.addEventListener("drop", function (e) {
  e.preventDefault();
  dropArea.classList.remove("dragover");

  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
    const file = e.dataTransfer.files[0];
    fileInput.files = e.dataTransfer.files;

    // Truncate name to 7 characters if it's longer
    const fullName = file.name;
    const dotIndex = fullName.lastIndexOf(".");
    let name = dotIndex !== -1 ? fullName.substring(0, dotIndex) : fullName;
    const ext = dotIndex !== -1 ? fullName.substring(dotIndex) : "";

    // Truncate the name to 7 characters if it's longer
    if (name.length > 7) {
      name = name.substring(0, 7);
    }

    // Always add 7 dots after the name
    const displayText = `${name}.......${ext}`;

    // Update the display text with the new name format
    uploadText.textContent = displayText;

    // Manually trigger the normal upload handler
    const event = new Event("input", { bubbles: true });
    fileInput.dispatchEvent(event);
  }
});

function updateModels() {
  const shape = document.getElementById("shapeType").value;
  const modelSelect = document.getElementById("modelType");

  // Clear old options
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

  // Auto-select first model
  if (models.length > 0) {
    modelSelect.value = models[0].value;
    applyModel();
  }
}

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
  teSweetBox500Top: [1488, 992]
};

function updateDimensionText() {
  const model = document.getElementById("modelType").value;
  const orientation = document.querySelector('input[name="sweetBoxSide"]:checked')?.value || "bottom";
  const dimentionEl = document.getElementById("dimention");
  
  let lookupKey = model;
  
  // Adjust lookup key for top orientation
  if ((model === "sweetBox250" || model === "sweetBox500" || 
       model === "teSweetBox250" || model === "teSweetBox500") && 
      orientation === "top") {
    lookupKey = model + "Top";
  }
  
  const dim = modelDimensions[lookupKey];
  if (dim && dim.length === 2) {
    dimentionEl.textContent = `${dim[0]}px x ${dim[1]}px`;
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

// Call this function inside shape change event handler
document.getElementById("shapeType").addEventListener("change", () => {
  updateModels();
  updateDimensionText();
  clearUploadedImage(); // Clear image on shape change
  imgError.style.display = "none";
});

// Call this function inside model change event handler
document.getElementById("modelType").addEventListener("change", () => {
  applyModel();
  updateDimensionText();
  clearUploadedImage(); // Clear image on model change
  imgError.style.display = "none";
});

document.getElementById("sweetBoxOrientation").addEventListener("change",()=>{
  applyModel();
  updateDimensionText();
  clearUploadedImage(); // Clear image on model change
  imgError.style.display = "none";
});

function applyModel() {
  const model = document.getElementById("modelType").value;
  document.getElementById("diagramType").value = model; // use existing diagramType logic
  updateInputs(); // show relevant input fields
  drawKLD(); // redraw
}

function updateInputs() {
  const diagramType = document.getElementById("diagramType").value;
  const orientation = document.querySelector('input[name="sweetBoxSide"]:checked')?.value || "bottom";

  // Toggle sweetBox orientation radio for both sweetBox and teSweetBox
  const showSweetOrientation =
    diagramType === "sweetBox" ||
    diagramType === "sweetBox250" ||
    diagramType === "sweetBox500" ||
    diagramType === "teSweetBox250" ||
    diagramType === "teSweetBox500";
  
  let oreo = document.getElementById("sweetBoxOrientation");

  oreo.style.display = showSweetOrientation
    ? "flex"
    : "none";
  oreo.style.flexDirection = "column";
  oreo.style.gap = "10px";

  // Determine which input group to show based on orientation
  const isBottomOrientation = orientation === "bottom";
  const isSweetBoxType = diagramType === "sweetBox" || diagramType === "sweetBox250" || 
                         diagramType === "sweetBox500" || diagramType === "teSweetBox250" || 
                         diagramType === "teSweetBox500";

  // Toggle active class for input groups based on selection
  document
    .getElementById("curveRectInputs")
    .classList.toggle(
      "active",
      diagramType === "curveRectangle500" ||
        diagramType === "curveRectangle250" ||
        diagramType === "curveRectangle750" ||
        diagramType === "curveRectangle1000" ||
        diagramType === "curveRectangle500g_square" ||
        diagramType === "curveRectangle500ml_square"
    );

  document
    .getElementById("sweetBoxInputs")
    .classList.toggle(
      "active",
      isSweetBoxType && isBottomOrientation
    );

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

  // Set default values for curveRectangles
  if (diagramType === "curveRectangle500") {
    document.getElementById("topWidth").value = 313.14;
    document.getElementById("bottomWidth").value = 244.65;
    document.getElementById("height").value = 75;
  } else if (diagramType === "curveRectangle250") {
    document.getElementById("topWidth").value = 295.91;
    document.getElementById("bottomWidth").value = 245.14;
    document.getElementById("height").value = 30;
  } else if (diagramType === "curveRectangle750") {
    document.getElementById("topWidth").value = 300.91;
    document.getElementById("bottomWidth").value = 245.14;
    document.getElementById("height").value = 37.92;
  } else if (diagramType === "curveRectangle1000") {
    document.getElementById("topWidth").value = 310.91;
    document.getElementById("bottomWidth").value = 245.14;
    document.getElementById("height").value = 37.92;
  } else if (diagramType === "curveRectangle500g_square") {
    document.getElementById("topWidth").value = 309.322;
    document.getElementById("bottomWidth").value = 245.178;
    document.getElementById("height").value = 96.853;
  } else if (diagramType === "curveRectangle500ml_square") {
    document.getElementById("topWidth").value = 309.322;
    document.getElementById("bottomWidth").value = 245.178;
    document.getElementById("height").value = 98.853;
  }

  if (diagramType === "square") {
    document.getElementById("sqWidthOnly").value = 200;
    document.getElementById("sqHeightOnly").value = 160;
  } else if (diagramType === "square750") {
    document.getElementById("sqWidthOnly").value = 162.5;
    document.getElementById("sqHeightOnly").value = 108.6;
  }

  // Set default values for squareWithRadius750
  if (diagramType === "squareWithRadius750") {
    document.getElementById("sqWidth").value = 162.5;
    document.getElementById("sqHeight").value = 108.6;
    document.getElementById("radius").value = 0;
  }

  // Set values based on diagram type and orientation
  if (diagramType === "sweetBox250") {
    if (isBottomOrientation) {
      document.getElementById("sweetWidth").value = 467.83;
      document.getElementById("sweetHeight").value = 34.13;
      document.getElementById("sweetBend").value = 61.98;
    } else {
      // Different values for sweetBox250 top
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
      // Different values for sweetBox500 top
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
      // Different values for teSweetBox250 top
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
      // Different values for teSweetBox500 top
      document.getElementById("sqWidth").value = 185;
      document.getElementById("sqHeight").value = 125;
      document.getElementById("radius").value = 15;
    }
  }

  // Disable/enable sweet box inputs
  if (isSweetBoxType && isBottomOrientation) {
    document.getElementById("sweetWidth").disabled = true;
    document.getElementById("sweetHeight").disabled = true;
    document.getElementById("sweetBend").disabled = true;
  } else {
    document.getElementById("sweetWidth").disabled = false;
    document.getElementById("sweetHeight").disabled = false;
    document.getElementById("sweetBend").disabled = false;
  }

  // Disable/enable square inputs
  if (diagramType === "square" || diagramType === "square750") {
    document.getElementById("sqWidthOnly").disabled = true;
    document.getElementById("sqHeightOnly").disabled = true;
  } else {
    document.getElementById("sqWidthOnly").disabled = false;
    document.getElementById("sqHeightOnly").disabled = false;
  }

  // Disable/enable square with radius inputs
  if (diagramType === "squareWithRadius750" || (isSweetBoxType && !isBottomOrientation)) {
    document.getElementById("sqWidth").disabled = true;
    document.getElementById("sqHeight").disabled = true;
    document.getElementById("radius").disabled = true;
  } else {
    document.getElementById("sqWidth").disabled = false;
    document.getElementById("sqHeight").disabled = false;
    document.getElementById("radius").disabled = false;
  }

  // Disable/enable curve rectangle inputs
  if (
    diagramType === "curveRectangle500" ||
    diagramType === "curveRectangle250" ||
    diagramType === "curveRectangle750" ||
    diagramType === "curveRectangle1000" ||
    diagramType === "curveRectangle500g_square" ||
    diagramType === "curveRectangle500ml_square"
  ) {
    document.getElementById("topWidth").disabled = true;
    document.getElementById("bottomWidth").disabled = true;
    document.getElementById("height").disabled = true;
  } else {
    document.getElementById("topWidth").disabled = false;
    document.getElementById("bottomWidth").disabled = false;
    document.getElementById("height").disabled = false;
  }

  // Trigger redraw after updates
  drawKLD();
}

const unitToPx = {
  px: 1,
  mm: 3.78,
  m: 3780,
};

// At the top of your file
const defaultSVGs = {
  curveRectangle250: './assets/250_ml.svg',
  // curveRectangle500: './assets/500ml.svg',
  // curveRectangle750: './assets/750ml.svg',
  // curveRectangle1000: './assets/1000ml.svg',
  // curveRectangle500g_square: './assets/500g_square.svg',
  // curveRectangle500ml_square: './assets/500ml_square.svg',
};

// Get reference to the overlay element
const svgOverlayElement = document.getElementById('svgOverlay');

// If it doesn't exist, create it
if (!svgOverlayElement) {
  console.log('⚠️ SVG overlay element not found, creating it dynamically...');
  svgOverlayElement = document.createElement('img');
  svgOverlayElement.id = 'svgOverlay';
  svgOverlayElement.alt = 'SVG Overlay';
  Object.assign(svgOverlayElement.style, {
    position: 'fixed',
    pointerEvents: 'none',
    display: 'none',
    zIndex: '9999'
  });
  document.body.appendChild(svgOverlayElement);
  console.log('✅ SVG overlay element created and added to body');
}

// Load all default SVGs (now it's simply assigning paths)
function loadAllDefaultSVGs() {
  Object.keys(defaultSVGs).forEach(shapeType => {
    const svgPath = defaultSVGs[shapeType];
    console.log('🔍 Using SVG for:', shapeType, 'from path:', svgPath); // Debug log
  });
}

// Call this on page load
window.addEventListener('DOMContentLoaded', loadAllDefaultSVGs);

function drawKLD() {
  if (!ctx) return;

  resizeCanvas();

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  let diagramType = document.getElementById("diagramType").value;
  const orientation = document.querySelector('input[name="sweetBoxSide"]:checked')?.value || "bottom";
  const units = DEFAULT_UNIT;

  // Handle Sweet Box and TE Sweet Box orientation switching
  if (diagramType === "sweetBox250" || diagramType === "sweetBox500" ||
      diagramType === "teSweetBox250" || diagramType === "teSweetBox500") {
    if (orientation === "top") {
      console.log("Top trigger")
      diagramType = "squareWithRadius";
    }
  }

  function toPx(value) {
    return value * unitToPx[units];
  }

  const round = (num) => Math.round(num * 100) / 100;

  const margin = 60;
  const svgWidth = canvas.clientWidth;
  const svgHeight = canvas.clientHeight;

  let scale = 1;

  let w = 0,
    h = 0,
    bottom = 0;

  const offset = 30;

// Your drawing code (remains unchanged)
if (
  diagramType === "curveRectangle500" ||
  diagramType === "curveRectangle250" ||
  diagramType === "curveRectangle750" ||
  diagramType === "curveRectangle1000" ||
  diagramType === "curveRectangle500g_square" ||
  diagramType === "curveRectangle500ml_square"
) {
  w = Number(document.getElementById("topWidth").value);
  h = Number(document.getElementById("height").value);
  bottom = Number(document.getElementById("bottomWidth").value);

  const wPx = toPx(w);
  const hPx = toPx(h);
  const bottomPx = toPx(bottom);

  const topHalf = wPx / 2;
  const bottomHalf = bottomPx / 2;
  const widthDiff = bottomHalf - topHalf;

  const verticalHeight = hPx;

  const svgWidth = canvas.clientWidth;
  const svgHeight = canvas.clientHeight;

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

  let angleInset = 0 * scale;
  let cornerShift = 0 * scale;

  if(diagramType === "curveRectangle250"){
  angleInset = -35 * scale; // Keep the original angle for the slant
  // --- END --- 
  cornerShift = 0 * scale; // This will shift both top-left, top-right, bottom-left, and bottom-right inward
  }

  const topLeft = {
    x: Math.round(centerX + (scaledMaxWidth - scaledWidth) / 2) + angleInset - cornerShift,
    y: Math.round(centerY),
  };
  const topRight = {
    x: Math.round(centerX + (scaledMaxWidth + scaledWidth) / 2) - angleInset + cornerShift,
    y: Math.round(centerY),
  };
  const bottomLeft = {
    x: Math.round(centerX + (scaledMaxWidth - scaledBottomWidth) / 2) - cornerShift,
    y: Math.round(centerY + scaledHeight),
  };
  const bottomRight = {
    x: Math.round(centerX + (scaledMaxWidth + scaledBottomWidth) / 2) + cornerShift,
    y: bottomLeft.y,
  };

  const angleRad = Math.atan(widthDiff / verticalHeight);

  const curveOffsetTop = -Math.tan(angleRad) * toPx(w / 2) * scale;
  const curveOffsetBottom = Math.tan(angleRad) * toPx(bottom / 2) * scale;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(topLeft.x, topLeft.y);
  ctx.quadraticCurveTo(
    (topLeft.x + topRight.x) / 2,
    topLeft.y - curveOffsetTop,
    topRight.x,
    topRight.y
  );
  ctx.lineTo(bottomRight.x, bottomRight.y);
  ctx.quadraticCurveTo(
    (bottomRight.x + bottomLeft.x) / 2,
    bottomRight.y + curveOffsetBottom,
    bottomLeft.x,
    bottomLeft.y
  );
  ctx.closePath();
  ctx.clip();

  // --- Image Slicing Adjustments ---
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
        topLeft.y,
        topLeft.y - curveOffsetTop,
        topRight.y,
        t1
      );
      const topX2 = topLeft.x + (topRight.x - topLeft.x) * t2;
      const topY2 = quadraticAt(
        topLeft.y,
        topLeft.y - curveOffsetTop,
        topRight.y,
        t2
      );

      const bottomX1 = bottomLeft.x + (bottomRight.x - bottomLeft.x) * t1;
      const bottomY1 = quadraticAt(
        bottomLeft.y,
        bottomRight.y + curveOffsetBottom,
        bottomRight.y,
        t1
      );
      const bottomX2 = bottomLeft.x + (bottomRight.x - bottomLeft.x) * t2;
      const bottomY2 = quadraticAt(
        bottomLeft.y,
        bottomRight.y + curveOffsetBottom,
        bottomRight.y,
        t2
      );

      const angleTop = Math.atan2(topY2 - topY1, topX2 - topX1);
      const angleBottom = Math.atan2(bottomY2 - bottomY1, bottomX2 - bottomX1);
      const angle = (angleTop + angleBottom) / 2;

      const sliceWidth = Math.hypot(topX2 - topX1, topY2 - topY1);
      const sliceHeight = Math.hypot(bottomX1 - topX1, bottomY1 - topY1);

      ctx.save();
      ctx.translate(topX1, topY1);
      ctx.rotate(angle);

      ctx.drawImage(
        currentImage,
        sx,
        0,
        sw,
        imgHeight,
        0,
        0,
        sliceWidth + 0.6,
        sliceHeight
      );
      ctx.restore();
    }
    ctx.imageSmoothingEnabled = true;
  } else {
    ctx.fillStyle = "#eee";
    ctx.fill();
  }
  ctx.restore();

  // --- Outer Stroke ---
  ctx.beginPath();
  ctx.moveTo(topLeft.x, topLeft.y);
  ctx.quadraticCurveTo(
    (topLeft.x + topRight.x) / 2,
    topLeft.y - curveOffsetTop,
    topRight.x,
    topRight.y
  );
  ctx.lineTo(bottomRight.x, bottomRight.y);
  ctx.quadraticCurveTo(
    (bottomRight.x + bottomLeft.x) / 2,
    bottomRight.y + curveOffsetBottom,
    bottomLeft.x,
    bottomLeft.y
  );
  ctx.closePath();
  ctx.lineWidth = Math.max(1, 1.2 * scale);
  ctx.strokeStyle = "#222";
  ctx.stroke();

  // ✅ SHOW SVG OVERLAY AS HTML ELEMENT (ABSOLUTE POSITIONED)
  const currentSVGUrl = defaultSVGs[diagramType];

  console.log('🔍 Debug Info:');
  console.log('- diagramType:', diagramType);
  console.log('- svgOverlayElement exists:', !!svgOverlayElement);
  console.log('- currentSVGUrl exists:', !!currentSVGUrl);
  console.log('- currentImage exists:', !!currentImage);

  if (svgOverlayElement && currentSVGUrl && currentImage) {
    // Get canvas position
    const canvasRect = canvas.getBoundingClientRect();

        // Calculate bounding box of the shape
    const shapeMinX = Math.min(topLeft.x, bottomLeft.x);
    const shapeMaxX = Math.max(topRight.x, bottomRight.x);
    const shapeMinY = topLeft.y - Math.abs(curveOffsetTop);
    const shapeMaxY = bottomLeft.y + Math.abs(curveOffsetBottom);

    const shapeWidth = shapeMaxX - shapeMinX;
    const shapeHeight = shapeMaxY - shapeMinY;

    // Set all styles at once
    Object.assign(svgOverlayElement.style, {
      display: 'block',
      position: 'fixed',
      left: (canvasRect.left + shapeMinX) + 'px',
      top: (canvasRect.top + shapeMinY- 80) + 'px',
      width: shapeWidth+5 + 'px',
      height: shapeHeight + 'px',
      opacity: '1',
      pointerEvents: 'none',
      zIndex: '9999',
    });

    // Set the source of the SVG overlay image
    svgOverlayElement.src = currentSVGUrl;

    console.log('✅ SVG overlay positioned:');
    console.log('  Canvas rect:', canvasRect);
    console.log('  Shape position:', { x: shapeMinX, y: shapeMinY, width: shapeWidth, height: shapeHeight });
    console.log('  Final position:', {
      left: (canvasRect.left + shapeMinX),
      top: (canvasRect.top + shapeMinY),
      width: shapeWidth,
      height: shapeHeight
    });
    console.log('  SVG src preview:', currentSVGUrl.substring(0, 100));
    console.log('  Element computed style:', window.getComputedStyle(svgOverlayElement).display);

    // Additional check - test if image loads
    svgOverlayElement.onload = () => {
      console.log('✅ SVG image loaded successfully!');
      console.log('  Natural size:', svgOverlayElement.naturalWidth, 'x', svgOverlayElement.naturalHeight);
    };

    svgOverlayElement.onerror = (e) => {
      console.error('❌ SVG image failed to load:', e);
    };

  } else {
    if (svgOverlayElement) {
      svgOverlayElement.style.display = 'none';
    }
    console.warn('⚠️ Cannot show SVG overlay:');
    console.warn('  - svgOverlayElement:', !!svgOverlayElement);
    console.warn('  - currentSVGUrl:', !!currentSVGUrl);
    console.warn('  - currentImage:', !!currentImage);
  }

  // // --- Dimension Text ---
  // let fontSizeScale;
  // switch (units.toLowerCase()) {
  //   case "mm":
  //     fontSizeScale = 1.0;
  //     break;
  //   case "cm":
  //     fontSizeScale = 1.2;
  //     break;
  //   case "inch":
  //   case "in":
  //     fontSizeScale = 1.5;
  //     break;
  //   case "ft":
  //   case "feet":
  //     fontSizeScale = 1.8;
  //     break;
  //   default:
  //     fontSizeScale = 1.0;
  // }

  // ctx.font = `${Math.max(12, 20 * scale * fontSizeScale)}px Arial`;
  // ctx.fillStyle = "blue";
  // ctx.strokeStyle = "blue";
  // ctx.lineWidth = Math.max(1, 1 * scale);
  // ctx.textAlign = "center";
  // ctx.textBaseline = "middle";

  // const offset = 30 * scale;

  // const originalTopLeftX = Math.round(centerX + (scaledMaxWidth - scaledWidth) / 2);
  // const originalTopRightX = Math.round(centerX + (scaledMaxWidth + scaledWidth) / 2);

  // const topDimY = topLeft.y - curveOffsetTop * 0.5 - offset;
  // drawArrow(ctx, originalTopLeftX, topDimY, originalTopRightX, topDimY, 8);
  // drawArrow(ctx, originalTopRightX, topDimY, originalTopLeftX, topDimY, 8);
  // ctx.fillText(
  //   w.toFixed(2) + " " + units,
  //   (originalTopLeftX + originalTopRightX) / 2,
  //   topDimY - 12 * scale * fontSizeScale
  // );

  // const bottomDimY = bottomLeft.y + offset;
  // drawArrow(ctx, bottomLeft.x, bottomDimY, bottomRight.x, bottomDimY, 8);
  // drawArrow(ctx, bottomRight.x, bottomDimY, bottomLeft.x, bottomDimY, 8);
  // ctx.fillText(
  //   bottom.toFixed(2) + " " + units,
  //   (bottomLeft.x + bottomRight.x) / 2,
  //   bottomDimY + 16 * scale * fontSizeScale
  // );

  // const heightDimDist = 40 * scale;
  // const offsetX = heightDimDist * Math.cos(angleRad);
  // const offsetY = heightDimDist * Math.sin(angleRad);

  // drawArrow(ctx, topRight.x + offsetX, topRight.y - offsetY, bottomRight.x + offsetX, bottomRight.y - offsetY, 8);
  // drawArrow(ctx, bottomRight.x + offsetX, bottomRight.y - offsetY, topRight.x + offsetX, topRight.y - offsetY, 8);

  // const textX = (topRight.x + bottomRight.x) / 2 + offsetX;
  // const textY = (topRight.y + bottomRight.y) / 2 - offsetY;

  // ctx.save();
  // ctx.translate(textX, textY);
  // ctx.rotate(-angleRad);
  // ctx.fillText(h.toFixed(2) + " " + units, 0, 6 * scale * fontSizeScale);
  // ctx.restore();

  function quadraticAt(p0, p1, p2, t) {
    return (1 - t) * (1 - t) * p0 + 2 * (1 - t) * t * p1 + t * t * p2;
  }
}





 else if (diagramType === "squareWithRadius" || diagramType === "squareWithRadius750" || orientation === 'Top') {
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
    const topRight = {
      x: round(centerX + scaledWidth),
      y: round(centerY),
    };
    const bottomLeft = {
      x: round(centerX),
      y: round(centerY + scaledHeight),
    };
    const bottomRight = {
      x: round(centerX + scaledWidth),
      y: round(centerY + scaledHeight),
    };

    // Draw clipped shape and image
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(topLeft.x + rPx, topLeft.y);
    ctx.lineTo(topRight.x - rPx, topRight.y);
    ctx.quadraticCurveTo(topRight.x, topRight.y, topRight.x, topRight.y + rPx);
    ctx.lineTo(bottomRight.x, bottomRight.y - rPx);
    ctx.quadraticCurveTo(
      bottomRight.x,
      bottomRight.y,
      bottomRight.x - rPx,
      bottomRight.y
    );
    ctx.lineTo(bottomLeft.x + rPx, bottomLeft.y);
    ctx.quadraticCurveTo(
      bottomLeft.x,
      bottomLeft.y,
      bottomLeft.x,
      bottomLeft.y - rPx
    );
    ctx.lineTo(topLeft.x, topLeft.y + rPx);
    ctx.quadraticCurveTo(topLeft.x, topLeft.y, topLeft.x + rPx, topLeft.y);
    ctx.closePath();
    ctx.clip();

    if (currentImage) {
      const imgWidth = bottomRight.x - topLeft.x;
      const imgHeight = bottomLeft.y - topLeft.y;

      // Use full image without cropping - stretch to fill the entire shape
      const drawWidth = imgWidth;
      const drawHeight = imgHeight;
      const offsetX = 0;
      const offsetY = 0;

      ctx.drawImage(
        currentImage,
        0,
        0,
        currentImage.width,
        currentImage.height, // use full source image
        topLeft.x + offsetX,
        topLeft.y + offsetY,
        drawWidth,
        drawHeight
      );
    } else {
      ctx.fillStyle = "#eee";
      ctx.fill();
    }
    ctx.restore();

    // Draw outline
    ctx.beginPath();
    ctx.moveTo(topLeft.x + rPx, topLeft.y);
    ctx.lineTo(topRight.x - rPx, topRight.y);
    ctx.quadraticCurveTo(topRight.x, topRight.y, topRight.x, topRight.y + rPx);
    ctx.lineTo(bottomRight.x, bottomRight.y - rPx);
    ctx.quadraticCurveTo(
      bottomRight.x,
      bottomRight.y,
      bottomRight.x - rPx,
      bottomRight.y
    );
    ctx.lineTo(bottomLeft.x + rPx, bottomLeft.y);
    ctx.quadraticCurveTo(
      bottomLeft.x,
      bottomLeft.y,
      bottomLeft.x,
      bottomLeft.y - rPx
    );
    ctx.lineTo(topLeft.x, topLeft.y + rPx);
    ctx.quadraticCurveTo(topLeft.x, topLeft.y, topLeft.x + rPx, topLeft.y);
    ctx.closePath();
    ctx.lineWidth = Math.max(1, 1.2 * scale);
    ctx.strokeStyle = "#222";
    ctx.stroke();

    // Dimension lines and text
    ctx.strokeStyle = "blue";
    ctx.fillStyle = "blue";
    ctx.lineWidth = Math.max(1, 1 * scale);
    ctx.font = `${Math.max(12, 20 * scale)}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const topDimY = topLeft.y - offset;
    drawArrow(ctx, topLeft.x, topDimY, topRight.x, topDimY, 8);
    drawArrow(ctx, topRight.x, topDimY, topLeft.x, topDimY, 8);
    ctx.fillText(
      w.toFixed(2) + " " + units,
      (topLeft.x + topRight.x) / 2,
      topDimY - 12
    );

    const bottomDimY = bottomLeft.y + offset;
    drawArrow(ctx, bottomLeft.x, bottomDimY, bottomRight.x, bottomDimY, 8);
    drawArrow(ctx, bottomRight.x, bottomDimY, bottomLeft.x, bottomDimY, 8);
    ctx.fillText(
      bottom.toFixed(2) + " " + units,
      (bottomLeft.x + bottomRight.x) / 2,
      bottomDimY + 16
    );

    const heightDimX = topRight.x + offset;
    drawArrow(ctx, heightDimX, topRight.y, heightDimX, bottomRight.y, 8);
    drawArrow(ctx, heightDimX, bottomRight.y, heightDimX, topRight.y, 8);
    ctx.save();
    ctx.translate(heightDimX + 38, (topRight.y + bottomRight.y) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(h.toFixed(2) + " " + units, 0, 6);
    ctx.restore();
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
    const topRight = {
      x: round(centerX + scaledWidth),
      y: round(centerY),
    };
    const bottomLeft = {
      x: round(centerX),
      y: round(centerY + scaledHeight),
    };
    const bottomRight = {
      x: round(centerX + scaledWidth),
      y: round(centerY + scaledHeight),
    };

    // Draw clipped shape and image
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(topLeft.x, topLeft.y);
    ctx.lineTo(topRight.x, topRight.y);
    ctx.lineTo(bottomRight.x, bottomRight.y);
    ctx.lineTo(bottomLeft.x, bottomLeft.y);
    ctx.closePath();
    ctx.clip();

    if (currentImage) {
      const imgWidth = bottomRight.x - topLeft.x;
      const imgHeight = bottomLeft.y - topLeft.y;

      // Use full image without cropping - stretch to fill the entire shape
      const drawWidth = imgWidth;
      const drawHeight = imgHeight;
      const offsetX = 0;
      const offsetY = 0;

      ctx.drawImage(
        currentImage,
        0,
        0,
        currentImage.width,
        currentImage.height, // use full source image
        topLeft.x + offsetX,
        topLeft.y + offsetY,
        drawWidth,
        drawHeight
      );
    } else {
      ctx.fillStyle = "#eee";
      ctx.fill();
    }
    ctx.restore();

    // Draw outline
    ctx.beginPath();
    ctx.moveTo(topLeft.x, topLeft.y);
    ctx.lineTo(topRight.x, topRight.y);
    ctx.lineTo(bottomRight.x, bottomRight.y);
    ctx.lineTo(bottomLeft.x, bottomLeft.y);
    ctx.closePath();
    ctx.lineWidth = Math.max(1, 1.2 * scale);
    ctx.strokeStyle = "#222";
    ctx.stroke();

    // Dimension lines and text
    ctx.strokeStyle = "blue";
    ctx.fillStyle = "blue";
    ctx.lineWidth = Math.max(1, 1 * scale);
    ctx.font = `${Math.max(12, 20 * scale)}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const topDimY = topLeft.y - offset;
    drawArrow(ctx, topLeft.x, topDimY, topRight.x, topDimY, 8);
    drawArrow(ctx, topRight.x, topDimY, topLeft.x, topDimY, 8);
    ctx.fillText(
      w.toFixed(2) + " " + units,
      (topLeft.x + topRight.x) / 2,
      topDimY - 12
    );

    const bottomDimY = bottomLeft.y + offset;
    drawArrow(ctx, bottomLeft.x, bottomDimY, bottomRight.x, bottomDimY, 8);
    drawArrow(ctx, bottomRight.x, bottomDimY, bottomLeft.x, bottomDimY, 8);
    ctx.fillText(
      bottom.toFixed(2) + " " + units,
      (bottomLeft.x + bottomRight.x) / 2,
      bottomDimY + 16
    );

    const heightDimX = topRight.x + offset;
    drawArrow(ctx, heightDimX, topRight.y, heightDimX, bottomRight.y, 8);
    drawArrow(ctx, heightDimX, bottomRight.y, heightDimX, topRight.y, 8);
    ctx.save();
    ctx.translate(heightDimX + 38, (topRight.y + bottomRight.y) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(h.toFixed(2) + " " + units, 0, 6);
    ctx.restore();
  } else if (diagramType === "sweetBox500" ||
  diagramType === "sweetBox250" ||
  diagramType === "teSweetBox500" ||
  diagramType === "teSweetBox250"
  ) {
    // Inputs
    const w = Number(document.getElementById("sweetWidth").value);
    const h = Number(document.getElementById("sweetHeight").value);
    const bendHeightInput = Number(document.getElementById("sweetBend").value);

    // Bend factor (0 = flat, 1 = full bend)
    const bendFactor = 0.5;

    // Units to pixels
    const wPx = toPx(w);
    const hPx = toPx(h);
    const bendPx = toPx(bendHeightInput);

    const margin = 60;
    const svgWidth = canvas.clientWidth;
    const svgHeight = canvas.clientHeight;

    // Scale
    const scaleX = (svgWidth - 2 * margin) / wPx;
    const scaleY = (svgHeight - 2 * margin) / hPx;
    const scale = Math.min(scaleX, scaleY, 1);

    const scaledWidth = wPx * scale;
    const scaledHeight = hPx * scale;
    const scaledBend = bendPx * scale;

    const centerX = Math.round(svgWidth / 2);
    const centerY = Math.round(svgHeight / 2);

    // Top points with bends
    const numPoints = 5;
    const topPoints = [];
    for (let i = 0; i < numPoints; i++) {
      const x = centerX - scaledWidth / 2 + (scaledWidth / (numPoints - 1)) * i;
      const bendOffset =
        scaledBend * bendFactor * Math.sin((Math.PI * i) / (numPoints - 1));
      const y = centerY - scaledHeight / 2 - bendOffset;
      topPoints.push({ x, y });
    }

    // Tangent slopes for bottom edge adjustment
    const angleL = Math.atan2(
      topPoints[1].y - topPoints[0].y,
      topPoints[1].x - topPoints[0].x
    );
    const angleR = Math.atan2(
      topPoints[numPoints - 1].y - topPoints[numPoints - 2].y,
      topPoints[numPoints - 1].x - topPoints[numPoints - 2].x
    );

    // Bottom points
    const bottomPoints = [];
    for (let i = 0; i < numPoints; i++) {
      let x = centerX - scaledWidth / 2 + (scaledWidth / (numPoints - 1)) * i;
      let y = topPoints[i].y + scaledHeight;
      if (i === 0) x += -Math.tan(angleL) * scaledHeight;
      if (i === numPoints - 1) x += -Math.tan(angleR) * scaledHeight;
      bottomPoints.push({ x, y });
    }

    // Calculate bend angles at top points
    function angleBetweenPoints(p1, p2) {
      return Math.atan2(p2.y - p1.y, p2.x - p1.x);
    }
    function calculateBendAngles(points) {
      let angles = [];
      for (let i = 1; i < points.length - 1; i++) {
        let v1 = angleBetweenPoints(points[i], points[i - 1]);
        let v2 = angleBetweenPoints(points[i], points[i + 1]);
        angles.push((v1 + v2) / 2);
      }
      angles.unshift(angleBetweenPoints(points[0], points[1]));
      angles.push(
        angleBetweenPoints(points[points.length - 2], points[points.length - 1])
      );
      return angles;
    }
    const bendAngles = calculateBendAngles(topPoints);

    // Linear interpolation helper
    function lerp(a, b, t) {
      return a + (b - a) * t;
    }

    // Quadratic Bezier interpolation helper
    function quadraticAt(p0, p1, p2, t) {
      return (1 - t) * (1 - t) * p0 + 2 * (1 - t) * t * p1 + t * t * p2;
    }

    // Begin drawing
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(topPoints[0].x, topPoints[0].y);
    for (let i = 1; i < numPoints; i++) {
      const cpX = (topPoints[i - 1].x + topPoints[i].x) / 2;
      const cpY = (topPoints[i - 1].y + topPoints[i].y) / 2;
      ctx.quadraticCurveTo(cpX, cpY, topPoints[i].x, topPoints[i].y);
    }
    ctx.lineTo(bottomPoints[numPoints - 1].x, bottomPoints[numPoints - 1].y);
    for (let i = bottomPoints.length - 2; i >= 0; i--) {
      const cpX = (bottomPoints[i + 1].x + bottomPoints[i].x) / 2;
      const cpY = (bottomPoints[i + 1].y + bottomPoints[i].y) / 2;
      ctx.quadraticCurveTo(cpX, cpY, bottomPoints[i].x, bottomPoints[i].y);
    }
    ctx.closePath();
    ctx.clip();

    if (currentImage) {
      const sliceCount = 1000;
      const imgWidth = currentImage.width;
      const imgHeight = currentImage.height;
      const sliceW = imgWidth / sliceCount;

      for (let i = 0; i < sliceCount; i++) {
        const t = i / sliceCount;
        const nextT = (i + 1) / sliceCount;

        // Find segment indices and local ts for interpolation (same as before)
        const segmentLength = 1 / (numPoints - 1);
        const segmentIndex = Math.min(
          Math.floor(t / segmentLength),
          numPoints - 2
        );
        const localT = (t - segmentLength * segmentIndex) / segmentLength;
        const nextSegmentIndex = Math.min(
          Math.floor(nextT / segmentLength),
          numPoints - 2
        );
        const nextLocalT =
          (nextT - segmentLength * nextSegmentIndex) / segmentLength;

        // Top slice edge coordinates (interpolated)
        const topX1 = lerp(
          topPoints[segmentIndex].x,
          topPoints[segmentIndex + 1].x,
          localT
        );
        const topY1 = lerp(
          topPoints[segmentIndex].y,
          topPoints[segmentIndex + 1].y,
          localT
        );
        const topX2 = lerp(
          topPoints[nextSegmentIndex].x,
          topPoints[nextSegmentIndex + 1].x,
          nextLocalT
        );
        const topY2 = lerp(
          topPoints[nextSegmentIndex].y,
          topPoints[nextSegmentIndex + 1].y,
          nextLocalT
        );

        // Calculate rotation angle from slice segment slope (local tangent)
        const sliceAngle = Math.atan2(topY2 - topY1, topX2 - topX1);

        // Bottom slice edge coordinates (for height calculation)
        const bottomX1 = lerp(
          bottomPoints[segmentIndex].x,
          bottomPoints[segmentIndex + 1].x,
          localT
        );
        const bottomY1 = lerp(
          bottomPoints[segmentIndex].y,
          bottomPoints[segmentIndex + 1].y,
          localT
        );

        // Calculate slice height and width
        const sliceHeight = Math.hypot(bottomX1 - topX1, bottomY1 - topY1);
        const sliceWidth = Math.hypot(topX2 - topX1, topY2 - topY1);

        ctx.save();
        ctx.translate(topX1, topY1);
        ctx.rotate(sliceAngle); // Use local slope angle per slice here
        ctx.drawImage(
          currentImage,
          i * sliceW,
          0,
          sliceW,
          imgHeight,
          0,
          0,
          sliceWidth + 0.6,
          sliceHeight
        );
        ctx.restore();
      }
    } else {
      ctx.fillStyle = "#eee";
      ctx.fill();
    }
    ctx.restore();

    // Draw shape outline
    ctx.beginPath();
    ctx.moveTo(topPoints[0].x, topPoints[0].y);
    for (let i = 1; i < numPoints; i++) {
      const cpX = (topPoints[i - 1].x + topPoints[i].x) / 2;
      const cpY = (topPoints[i - 1].y + topPoints[i].y) / 2;
      ctx.quadraticCurveTo(cpX, cpY, topPoints[i].x, topPoints[i].y);
    }
    ctx.lineTo(bottomPoints[numPoints - 1].x, bottomPoints[numPoints - 1].y);
    for (let i = bottomPoints.length - 2; i >= 0; i--) {
      const cpX = (bottomPoints[i + 1].x + bottomPoints[i].x) / 2;
      const cpY = (bottomPoints[i + 1].y + bottomPoints[i].y) / 2;
      ctx.quadraticCurveTo(cpX, cpY, bottomPoints[i].x, bottomPoints[i].y);
    }
    ctx.closePath();
    ctx.lineWidth = Math.max(1, 1.2 * scale);
    ctx.strokeStyle = "#222";
    ctx.stroke();

    // === Dimensions ===
    ctx.strokeStyle = "blue";
    ctx.fillStyle = "blue";
    ctx.lineWidth = Math.max(1, 1 * scale);
    ctx.font = `${Math.max(12, 20 * scale)}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Top width dimension
    const topDimY = centerY - scaledHeight / 2 - 30 - scaledBend * bendFactor;
    drawArrow(
      ctx,
      topPoints[0].x,
      topDimY,
      topPoints[numPoints - 1].x,
      topDimY,
      8
    );
    drawArrow(
      ctx,
      topPoints[numPoints - 1].x,
      topDimY,
      topPoints[0].x,
      topDimY,
      8
    );
    ctx.fillText(w.toFixed(2) + " " + units, centerX, topDimY - 12);

    // Left height dimension
    const heightDimX = topPoints[0].x - 30;
    drawArrow(
      ctx,
      heightDimX,
      topPoints[0].y,
      heightDimX,
      bottomPoints[0].y,
      8
    );
    drawArrow(
      ctx,
      heightDimX,
      bottomPoints[0].y,
      heightDimX,
      topPoints[0].y,
      8
    );
    ctx.save();
    ctx.translate(heightDimX - 8, (topPoints[0].y + bottomPoints[0].y) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(h.toFixed(2) + " " + units, 0, 0);
    ctx.restore();

    // Bend height dimension (rotated text)
    const bendDimX = centerX + scaledWidth / 2 + 30;
    const bendStartY = bottomPoints[0].y;
    const bendEndY = topPoints[Math.floor(numPoints / 2)].y;
    drawArrow(ctx, bendDimX, bendStartY, bendDimX, bendEndY, 8);
    drawArrow(ctx, bendDimX, bendEndY, bendDimX, bendStartY, 8);

    const bendTextX = bendDimX + 12;
    const bendTextY = (bendStartY + bendEndY) / 2;
    ctx.save();
    ctx.translate(bendTextX, bendTextY);
    ctx.rotate(-Math.PI / 2); // Rotate text vertically
    ctx.fillText(bendHeightInput.toFixed(2) + " " + units, 0, 0);
    ctx.restore();

    // Helper function for quadratic interpolation
    function quadraticAt(p0, p1, p2, t) {
      return (1 - t) * (1 - t) * p0 + 2 * (1 - t) * t * p1 + t * t * p2;
    }
  } else {
    // ctx.fillStyle = "red";
    ctx.font = "24px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Select a diagram type", svgWidth / 2, svgHeight / 2);
  }
}

// Helper to draw arrows with filled arrowheads
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

const DPI = 300; // 300 dots per inch for high-quality export

function unitToPixelsForExport(value, unit) {
  if (!value) return 0;
  switch (unit) {
    case "mm":
      return (value / 25.4) * DPI; // convert mm to inches then to pixels
    case "cm":
      return ((value * 10) / 25.4) * DPI; // cm to mm to inch to px
    case "m":
      return ((value * 1000) / 25.4) * DPI; // meters to mm to inch to px
    case "px":
    default:
      return value; // pixels assumed as-is
  }
}

let curveOffsetBottom;
let curveOffsetTop;
let bottomRight;
let bottomLeft;
let topRight;
let topLeft;

function drawKLDForExport() {
  if (!ctx) return;

  resizeCanvas();

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  let diagramType = document.getElementById("diagramType").value;
  const orientation = document.querySelector('input[name="sweetBoxSide"]:checked')?.value || "bottom";
  const units = DEFAULT_UNIT;

  if (diagramType === "sweetBox250" || diagramType === "sweetBox500" ||
      diagramType === "teSweetBox250" || diagramType === "teSweetBox500") {
    if (orientation === "top") {
      console.log("Top trigger")
      diagramType = "squareWithRadius";
    }
  }

  function toPx(value) {
    return value * unitToPx[units];
  }

  const margin = 60;
  const svgWidth = canvas.clientWidth;
  const svgHeight = canvas.clientHeight;

  let scale = 1;
  let w = 0,
    h = 0,
    bottom = 0;

  const round = (num) => Math.round(num * 100) / 100;

  // Helper function to calculate the point on a quadratic curve
// function quadraticAt(p0, p1, p2, t) {
//   return (1 - t) * (1 - t) * p0 + 2 * (1 - t) * t * p1 + t * t * p2;
// }

// Ensure that the shape and image are properly scaled, and the SVG overlay is correctly aligned
if (
  diagramType === "curveRectangle500" ||
  diagramType === "curveRectangle250" ||
  diagramType === "curveRectangle750" ||
  diagramType === "curveRectangle1000" ||
  diagramType === "curveRectangle500g_square" ||
  diagramType === "curveRectangle500ml_square"
) {
  w = Number(document.getElementById("topWidth").value);
  h = Number(document.getElementById("height").value);
  bottom = Number(document.getElementById("bottomWidth").value);

  const wPx = toPx(w);
  const hPx = toPx(h);
  const bottomPx = toPx(bottom);

  const topHalf = wPx / 2;
  const bottomHalf = bottomPx / 2;
  const widthDiff = bottomHalf - topHalf;

  const verticalHeight = hPx;

  const svgWidth = canvas.clientWidth;
  const svgHeight = canvas.clientHeight;

  const horizontalMargin = 70;
  const verticalMargin = 100;
  const topMargin = 120;

  const scaleXFit = (svgWidth - 2 * horizontalMargin) / Math.max(wPx, bottomPx);
  const scaleYFit = (svgHeight - 2 * verticalMargin - topMargin) / verticalHeight;
  scale = Math.min(scaleXFit, scaleYFit) * 1.1;

  const scaledWidth = wPx * scale;
  const scaledHeight = verticalHeight * scale;
  const scaledBottomWidth = bottomPx * scale;
  const scaledMaxWidth = Math.max(wPx, bottomPx) * scale;

  const centerX = (svgWidth - scaledMaxWidth) / 2;
  const centerY = (svgHeight - scaledHeight) / 2 + topMargin;

  let angleInset = 0 * scale;
  let cornerShift = 0 * scale;

  if(diagramType === "curveRectangle250"){
  angleInset = -25 * scale; // Keep the original angle for the slant
  // --- END --- 
  cornerShift = -25 * scale; // This will shift both top-left, top-right, bottom-left, and bottom-right inward
  }

   topLeft = {
    x: Math.round(centerX + (scaledMaxWidth - scaledWidth) / 2) + angleInset - cornerShift,
    y: Math.round(centerY),
  };
   topRight = {
    x: Math.round(centerX + (scaledMaxWidth + scaledWidth) / 2) - angleInset + cornerShift,
    y: Math.round(centerY),
  };
   bottomLeft = {
    x: Math.round(centerX + (scaledMaxWidth - scaledBottomWidth) / 2) - cornerShift,
    y: Math.round(centerY + scaledHeight),
  };
   bottomRight = {
    x: Math.round(centerX + (scaledMaxWidth + scaledBottomWidth) / 2) + cornerShift,
    y: bottomLeft.y,
  };

  const angleRad = Math.atan(widthDiff / verticalHeight);

   curveOffsetTop = -Math.tan(angleRad) * toPx(w / 2) * scale;
   curveOffsetBottom = Math.tan(angleRad) * toPx(bottom / 2) * scale;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(topLeft.x, topLeft.y);
  ctx.quadraticCurveTo(
    (topLeft.x + topRight.x) / 2,
    topLeft.y - curveOffsetTop,
    topRight.x,
    topRight.y
  );
  ctx.lineTo(bottomRight.x, bottomRight.y);
  ctx.quadraticCurveTo(
    (bottomRight.x + bottomLeft.x) / 2,
    bottomRight.y + curveOffsetBottom,
    bottomLeft.x,
    bottomLeft.y
  );
  ctx.closePath();
  ctx.clip();

  // --- Image Slicing Adjustments ---
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
        topLeft.y,
        topLeft.y - curveOffsetTop,
        topRight.y,
        t1
      );
      const topX2 = topLeft.x + (topRight.x - topLeft.x) * t2;
      const topY2 = quadraticAt(
        topLeft.y,
        topLeft.y - curveOffsetTop,
        topRight.y,
        t2
      );

      const bottomX1 = bottomLeft.x + (bottomRight.x - bottomLeft.x) * t1;
      const bottomY1 = quadraticAt(
        bottomLeft.y,
        bottomRight.y + curveOffsetBottom,
        bottomRight.y,
        t1
      );
      const bottomX2 = bottomLeft.x + (bottomRight.x - bottomLeft.x) * t2;
      const bottomY2 = quadraticAt(
        bottomLeft.y,
        bottomRight.y + curveOffsetBottom,
        bottomRight.y,
        t2
      );

      const angleTop = Math.atan2(topY2 - topY1, topX2 - topX1);
      const angleBottom = Math.atan2(bottomY2 - bottomY1, bottomX2 - bottomX1);
      const angle = (angleTop + angleBottom) / 2;

      const sliceWidth = Math.hypot(topX2 - topX1, topY2 - topY1);
      const sliceHeight = Math.hypot(bottomX1 - topX1, bottomY1 - topY1);

      ctx.save();
      ctx.translate(topX1, topY1);
      ctx.rotate(angle);

      ctx.drawImage(
        currentImage,
        sx,
        0,
        sw,
        imgHeight,
        0,
        0,
        sliceWidth + 0.6,
        sliceHeight
      );
      ctx.restore();
    }
    ctx.imageSmoothingEnabled = true;
  } else {
    ctx.fillStyle = "#eee";
    ctx.fill();
  }
  ctx.restore();

  // --- Outer Stroke ---
  ctx.beginPath();
  ctx.moveTo(topLeft.x, topLeft.y);
  ctx.quadraticCurveTo(
    (topLeft.x + topRight.x) / 2,
    topLeft.y - curveOffsetTop,
    topRight.x,
    topRight.y
  );
  ctx.lineTo(bottomRight.x, bottomRight.y);
  ctx.quadraticCurveTo(
    (bottomRight.x + bottomLeft.x) / 2,
    bottomRight.y + curveOffsetBottom,
    bottomLeft.x,
    bottomLeft.y
  );
  ctx.closePath();
  ctx.lineWidth = Math.max(1, 1.2 * scale);
  ctx.strokeStyle = "#222";
  ctx.stroke();
}



  else if (
    diagramType === "squareWithRadius" ||
    diagramType === "squareWithRadius750"
  ) {
    w = Number(document.getElementById("sqWidth").value);
    h = Number(document.getElementById("sqHeight").value);
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

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(topLeft.x + rPx, topLeft.y);
    ctx.lineTo(topRight.x - rPx, topRight.y);
    ctx.quadraticCurveTo(topRight.x, topRight.y, topRight.x, topRight.y + rPx);
    ctx.lineTo(bottomRight.x, bottomRight.y - rPx);
    ctx.quadraticCurveTo(
      bottomRight.x,
      bottomRight.y,
      bottomRight.x - rPx,
      bottomRight.y
    );
    ctx.lineTo(bottomLeft.x + rPx, bottomLeft.y);
    ctx.quadraticCurveTo(
      bottomLeft.x,
      bottomLeft.y,
      bottomLeft.x,
      bottomLeft.y - rPx
    );
    ctx.lineTo(topLeft.x, topLeft.y + rPx);
    ctx.quadraticCurveTo(topLeft.x, topLeft.y, topLeft.x + rPx, topLeft.y);
    ctx.closePath();
    ctx.clip();

    if (currentImage) {
      ctx.drawImage(
        currentImage,
        topLeft.x,
        topLeft.y,
        scaledWidth,
        scaledHeight
      );
    } else {
      ctx.fillStyle = "#eee";
      ctx.fill();
    }

    ctx.restore();

    ctx.beginPath();
    ctx.moveTo(topLeft.x + rPx, topLeft.y);
    ctx.lineTo(topRight.x - rPx, topRight.y);
    ctx.quadraticCurveTo(topRight.x, topRight.y, topRight.x, topRight.y + rPx);
    ctx.lineTo(bottomRight.x, bottomRight.y - rPx);
    ctx.quadraticCurveTo(
      bottomRight.x,
      bottomRight.y,
      bottomRight.x - rPx,
      bottomRight.y
    );
    ctx.lineTo(bottomLeft.x + rPx, bottomLeft.y);
    ctx.quadraticCurveTo(
      bottomLeft.x,
      bottomLeft.y,
      bottomLeft.x,
      bottomLeft.y - rPx
    );
    ctx.lineTo(topLeft.x, topLeft.y + rPx);
    ctx.quadraticCurveTo(topLeft.x, topLeft.y, topLeft.x + rPx, topLeft.y);
    ctx.closePath();
    ctx.strokeStyle = "#222";
    ctx.lineWidth = Math.max(1, 1.2 * scale);
    ctx.stroke();
  } else if (diagramType === "square" || diagramType === "square750") {
    w = Number(document.getElementById("sqWidthOnly").value);
    h = Number(document.getElementById("sqHeightOnly").value);

    const wPx = toPx(w);
    const hPx = toPx(h);

    const scaleXFit = (svgWidth - 2 * margin) / wPx;
    const scaleYFit = (svgHeight - 2 * margin) / hPx;
    scale = Math.min(scaleXFit, scaleYFit, 1);

    const scaledWidth = wPx * scale;
    const scaledHeight = hPx * scale;

    const x = (svgWidth - scaledWidth) / 2;
    const y = (svgHeight - scaledHeight) / 2;

    ctx.beginPath();
    ctx.rect(x, y, scaledWidth, scaledHeight);
    ctx.clip();

    if (currentImage) {
      ctx.drawImage(currentImage, x, y, scaledWidth, scaledHeight);
    } else {
      ctx.fillStyle = "#eee";
      ctx.fill();
    }

    ctx.restore();

    ctx.beginPath();
    ctx.rect(x, y, scaledWidth, scaledHeight);
    ctx.lineWidth = Math.max(1, 1.2 * scale);
    ctx.strokeStyle = "#222";
    ctx.stroke();
  } else if (
    diagramType === "sweetBox500" ||
  diagramType === "sweetBox250" ||
  diagramType === "teSweetBox500" ||
  diagramType === "teSweetBox250"
  ) {
    // Inputs
    const w = Number(document.getElementById("sweetWidth").value);
    const h = Number(document.getElementById("sweetHeight").value);
    const bendHeightInput = Number(document.getElementById("sweetBend").value);
    const bendFactor = 0.5;

    // Convert to px
    const wPx = toPx(w);
    const hPx = toPx(h);
    const bendPx = toPx(bendHeightInput);

    // Canvas sizes
    const margin = 60;
    const svgWidth = canvas.clientWidth;
    const svgHeight = canvas.clientHeight;

    // Scale to fit
    const scaleX = (svgWidth - 2 * margin) / wPx;
    const scaleY = (svgHeight - 2 * margin) / hPx;
    scale = Math.min(scaleX, scaleY, 1);

    // Scaled values
    const scaledWidth = wPx * scale;
    const scaledHeight = hPx * scale;
    const scaledBend = bendPx * scale;

    const centerX = Math.round(svgWidth / 2);
    const centerY = Math.round(svgHeight / 2);

    // Calculate points of top curve with bends
    const numPoints = 5;
    const topPoints = [];
    for (let i = 0; i < numPoints; i++) {
      const x = centerX - scaledWidth / 2 + (scaledWidth / (numPoints - 1)) * i;
      const bendOffset =
        scaledBend * bendFactor * Math.sin((Math.PI * i) / (numPoints - 1));
      const y = centerY - scaledHeight / 2 - bendOffset;
      topPoints.push({ x, y });
    }

    // Calculate angles for bottom adjustment
    const angleL = Math.atan2(
      topPoints[1].y - topPoints[0].y,
      topPoints[1].x - topPoints[0].x
    );
    const angleR = Math.atan2(
      topPoints[numPoints - 1].y - topPoints[numPoints - 2].y,
      topPoints[numPoints - 1].x - topPoints[numPoints - 2].x
    );

    // Bottom points
    const bottomPoints = [];
    for (let i = 0; i < numPoints; i++) {
      let x = centerX - scaledWidth / 2 + (scaledWidth / (numPoints - 1)) * i;
      let y = topPoints[i].y + scaledHeight;
      if (i === 0) x += -Math.tan(angleL) * scaledHeight;
      if (i === numPoints - 1) x += -Math.tan(angleR) * scaledHeight;
      bottomPoints.push({ x, y });
    }

    ctx.save();

    // Draw shape with smooth curves
    ctx.beginPath();
    ctx.moveTo(topPoints[0].x, topPoints[0].y);
    for (let i = 1; i < numPoints; i++) {
      const cpX = (topPoints[i - 1].x + topPoints[i].x) / 2;
      const cpY = (topPoints[i - 1].y + topPoints[i].y) / 2;
      ctx.quadraticCurveTo(cpX, cpY, topPoints[i].x, topPoints[i].y);
    }
    ctx.lineTo(bottomPoints[numPoints - 1].x, bottomPoints[numPoints - 1].y);
    for (let i = bottomPoints.length - 2; i >= 0; i--) {
      const cpX = (bottomPoints[i + 1].x + bottomPoints[i].x) / 2;
      const cpY = (bottomPoints[i + 1].y + bottomPoints[i].y) / 2;
      ctx.quadraticCurveTo(cpX, cpY, bottomPoints[i].x, bottomPoints[i].y);
    }
    ctx.closePath();
    ctx.clip();

    // Draw image slices with slice angle rotation
    if (currentImage) {
      const sliceCount = 500;
      const imgWidth = currentImage.width;
      const imgHeight = currentImage.height;
      const sliceW = imgWidth / sliceCount;

      for (let i = 0; i < sliceCount; i++) {
        const t = i / sliceCount;
        const nextT = (i + 1) / sliceCount;
        const segmentLength = 1 / (numPoints - 1);

        const segmentIndex = Math.min(
          Math.floor(t / segmentLength),
          numPoints - 2
        );
        const localT = (t - segmentLength * segmentIndex) / segmentLength;
        const nextSegmentIndex = Math.min(
          Math.floor(nextT / segmentLength),
          numPoints - 2
        );
        const nextLocalT =
          (nextT - segmentLength * nextSegmentIndex) / segmentLength;

        const topX1 = lerp(
          topPoints[segmentIndex].x,
          topPoints[segmentIndex + 1].x,
          localT
        );
        const topY1 = lerp(
          topPoints[segmentIndex].y,
          topPoints[segmentIndex + 1].y,
          localT
        );
        const topX2 = lerp(
          topPoints[nextSegmentIndex].x,
          topPoints[nextSegmentIndex + 1].x,
          nextLocalT
        );
        const topY2 = lerp(
          topPoints[nextSegmentIndex].y,
          topPoints[nextSegmentIndex + 1].y,
          nextLocalT
        );

        const bottomX1 = lerp(
          bottomPoints[segmentIndex].x,
          bottomPoints[segmentIndex + 1].x,
          localT
        );
        const bottomY1 = lerp(
          bottomPoints[segmentIndex].y,
          bottomPoints[segmentIndex + 1].y,
          localT
        );

        const sliceAngle = Math.atan2(topY2 - topY1, topX2 - topX1);
        const sliceHeight = Math.hypot(bottomX1 - topX1, bottomY1 - topY1);
        const sliceWidth = Math.hypot(topX2 - topX1, topY2 - topY1);

        ctx.save();
        ctx.translate(topX1, topY1);
        ctx.rotate(sliceAngle);
        ctx.drawImage(
          currentImage,
          i * sliceW,
          0,
          sliceW,
          imgHeight,
          0,
          0,
          sliceWidth + 0.5,
          sliceHeight
        );
        ctx.restore();
      }
      function lerp(a, b, t) {
        return a + (b - a) * t;
      }
    } else {
      ctx.fillStyle = "#eee";
      ctx.fill();
    }

    ctx.restore();

    // Draw shape outline with stroke
    ctx.beginPath();
    ctx.moveTo(topPoints[0].x, topPoints[0].y);
    for (let i = 1; i < numPoints; i++) {
      const cpX = (topPoints[i - 1].x + topPoints[i].x) / 2;
      const cpY = (topPoints[i - 1].y + topPoints[i].y) / 2;
      ctx.quadraticCurveTo(cpX, cpY, topPoints[i].x, topPoints[i].y);
    }
    ctx.lineTo(bottomPoints[numPoints - 1].x, bottomPoints[numPoints - 1].y);
    for (let i = bottomPoints.length - 2; i >= 0; i--) {
      const cpX = (bottomPoints[i + 1].x + bottomPoints[i].x) / 2;
      const cpY = (bottomPoints[i + 1].y + bottomPoints[i].y) / 2;
      ctx.quadraticCurveTo(cpX, cpY, bottomPoints[i].x, bottomPoints[i].y);
    }
    ctx.closePath();
    ctx.lineWidth = Math.max(1, 1.2 * scale);
    ctx.strokeStyle = "#222";
    ctx.stroke();

    // === Dimensions ===
    ctx.strokeStyle = "blue";
    ctx.fillStyle = "blue";
    ctx.lineWidth = Math.max(1, 1 * scale);
    ctx.font = `${Math.max(12, 20 * scale)}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Top width dimension
    const topDimY = centerY - scaledHeight / 2 - 30 - scaledBend * bendFactor;
    drawArrow(
      ctx,
      topPoints[0].x,
      topDimY,
      topPoints[numPoints - 1].x,
      topDimY,
      8
    );
    drawArrow(
      ctx,
      topPoints[numPoints - 1].x,
      topDimY,
      topPoints[0].x,
      topDimY,
      8
    );
    ctx.fillText(w.toFixed(2) + " " + units, centerX, topDimY - 12);

    // Left height dimension
    const heightDimX = topPoints[0].x - 30;
    drawArrow(
      ctx,
      heightDimX,
      topPoints[0].y,
      heightDimX,
      bottomPoints[0].y,
      8
    );
    drawArrow(
      ctx,
      heightDimX,
      bottomPoints[0].y,
      heightDimX,
      topPoints[0].y,
      8
    );
    ctx.save();
    ctx.translate(heightDimX - 8, (topPoints[0].y + bottomPoints[0].y) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(h.toFixed(2) + " " + units, 0, 0);
    ctx.restore();

    // Bend height dimension (rotated text)
    const bendDimX = centerX + scaledWidth / 2 + 30;
    const bendStartY = bottomPoints[0].y;
    const bendEndY = topPoints[Math.floor(numPoints / 2)].y;
    drawArrow(ctx, bendDimX, bendStartY, bendDimX, bendEndY, 8);
    drawArrow(ctx, bendDimX, bendEndY, bendDimX, bendStartY, 8);

    const bendTextX = bendDimX + 12;
    const bendTextY = (bendStartY + bendEndY) / 2;
    ctx.save();
    ctx.translate(bendTextX, bendTextY);
    ctx.rotate(-Math.PI / 2); // Rotate text vertically
    ctx.fillText(bendHeightInput.toFixed(2) + " " + units, 0, 0);
    ctx.restore();

    // Include or skip dimensions drawing based on mode, if needed
  }
  
  function quadraticAt(p0, p1, p2, t) {
    return (1 - t) * (1 - t) * p0 + 2 * (1 - t) * t * p1 + t * t * p2;
  }
}

// Update the export button to use the new function for PNG export
document.getElementById("export").addEventListener("click", () => {
  // 1. Draw the shape without dimensions
  drawKLDForExport();

  const canvas = document.getElementById("kldCanvas");
  const ctx = canvas.getContext("2d");
  const svgOverlayElement = document.getElementById("svgOverlay");

  // 2. Draw SVG overlay image on canvas for export if available
  if (svgOverlayElement && svgOverlayElement.src) {
    const img = new Image();
    // Get the bounding box to position overlay correctly (from your existing code)
    const canvasRect = canvas.getBoundingClientRect();
    // Here calculate overlay bounding box on canvas (example using fixed offsets - replace with your current calculation)
    // You might want to reuse topLeft, topRight, bottomLeft, bottomRight from your draw function context
    // For this example, assume shapeBoxX/Y/width/height are known
    const shapeBoxX = 0;
const shapeBoxY = 0;
const shapeBoxWidth = 1600;
const shapeBoxHeight = 600;

    img.onload = () => {
      // Draw overlay with the same scale and position on canvas
      ctx.drawImage(img, shapeBoxX, shapeBoxY, shapeBoxWidth, shapeBoxHeight);

      // 3. Export the combined canvas as PNG
      const imgData = canvas.toDataURL("image/png");

      // 4. Trigger download
      const shapeType = document.getElementById("shapeType").value;
      const modelLabel = getModelLabel().replace(/\s+/g, '_');
      const fileName = `${shapeType.charAt(0).toUpperCase() + shapeType.slice(1).toLowerCase()}_${modelLabel}.png`;

      const link = document.createElement("a");
      link.href = imgData;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // 5. Restore the canvas including dimension text
      drawKLD();
    };

    img.onerror = () => {
      console.warn("SVG overlay image failed to load. Exporting canvas without overlay.");
      // Fallback to export without overlay
      const imgData = canvas.toDataURL("image/png");
      const shapeType = document.getElementById("shapeType").value;
      const modelLabel = getModelLabel().replace(/\s+/g, '_');
      const fileName = `${shapeType.charAt(0).toUpperCase() + shapeType.slice(1).toLowerCase()}_${modelLabel}.png`;

      const link = document.createElement("a");
      link.href = imgData;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      drawKLD();
    };

    img.crossOrigin = "anonymous"; // Avoid CORS issues if SVG hosted externally
    img.src = svgOverlayElement.src;

  } else {
    // No SVG overlay, fallback export just canvas
    const imgData = canvas.toDataURL("image/png");
    const shapeType = document.getElementById("shapeType").value;
    const modelLabel = getModelLabel().replace(/\s+/g, '_');
    const fileName = `${shapeType.charAt(0).toUpperCase() + shapeType.slice(1).toLowerCase()}_${modelLabel}.png`;

    const link = document.createElement("a");
    link.href = imgData;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    drawKLD();
  }
});


window.onload = () => {
  loadStateFromLocalStorage();
  resizeCanvas();
  updateInputs();
};

window.addEventListener("DOMContentLoaded", () => {
  // Set default shape
  document.getElementById("shapeType").value = "round";

  // Populate models for Round
  updateModels();
  updateDimensionText();

  // Select the first model and apply it
  const modelSelect = document.getElementById("modelType");
  if (modelSelect.options.length > 0) {
    modelSelect.value = modelSelect.options[0].value;
    applyModel();
  }
});

document
  .getElementById("exportSvg")
  .addEventListener("click", ()=>{
    let diagramType = document.getElementById("diagramType").value;
    const orientation = document.querySelector('input[name="sweetBoxSide"]:checked')?.value || "bottom";
    
    // Handle Sweet Box and TE Sweet Box orientation for export
    if ((diagramType === "sweetBox" || diagramType === "sweetBox500" || 
         diagramType === "sweetBox250" || diagramType === "teSweetBox250" || 
         diagramType === "teSweetBox500") && orientation === "top") {
      exportRectangleRadiusAsSVG();
    } else if (
      diagramType === "sweetBox" || 
      diagramType === "sweetBox500" || 
      diagramType === "sweetBox250" ||
      diagramType === "teSweetBox250" ||
      diagramType === "teSweetBox500"
    ) {
      exportSweetBoxAsSVG();
    } else if (
      diagramType.startsWith("curveRectangle")
    ){
      exportAsWarpedSVG();
    } else if(diagramType === "squareWithRadius750"){
      exportRectangleRadiusAsSVG();
    } else if(diagramType === "square"){
      exportRectangleAsSVG();
    }
  });

function getModelLabel() {
  const modelSelect = document.getElementById("modelType");
  const selectedOption = modelSelect.options[modelSelect.selectedIndex];
  return selectedOption.textContent || "custom";
}

function exportRectangleAsSVG() {
  if (!currentImage) {
    alert("Please upload an image first.");
    return;
  }

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

  // SVG rectangle path string
  const svgShape = `<rect x="${x}" y="${y}" width="${scaledWidth}" height="${scaledHeight}" fill="none" stroke="black"/>`;

  // Create composite canvas with slices to remove gaps
  const sliceCount = 2000;
  const imgWidth = currentImage.width;
  const imgHeight = currentImage.height;
  const sliceW = imgWidth / sliceCount;
  const overlapFactor = 2; // Add 2% overlap to eliminate gaps

  const compositeCanvas = document.createElement('canvas');
  compositeCanvas.width = svgWidth * 2; // Double resolution for better quality
  compositeCanvas.height = svgHeight * 2;
  const compositeCtx = compositeCanvas.getContext('2d');
  compositeCtx.imageSmoothingEnabled = true; // Enable smoothing for better quality
  compositeCtx.imageSmoothingQuality = 'high'; // Use high quality smoothing
  compositeCtx.clearRect(0, 0, compositeCanvas.width, compositeCanvas.height); // Clear to transparent
  compositeCtx.scale(2, 2); // Scale context to match doubled canvas size

  // Draw all slices onto composite canvas
  for (let i = 0; i < sliceCount; i++) {
    const sx = i * sliceW;

    const sliceWidth = (scaledWidth / sliceCount) * overlapFactor;
    const sliceHeight = scaledHeight;

    const sliceX = x + i * (scaledWidth / sliceCount);
    const sliceY = y;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = sliceW;
    tempCanvas.height = imgHeight;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.imageSmoothingEnabled = true;
    tempCtx.imageSmoothingQuality = 'high';
    tempCtx.drawImage(currentImage, sx, 0, sliceW, imgHeight, 0, 0, sliceW, imgHeight);

    // Draw slice onto composite canvas
    compositeCtx.drawImage(tempCanvas, sliceX, sliceY, sliceWidth, sliceHeight);
  }

  // Convert composite canvas to single image with high quality
  const compositeImageData = compositeCanvas.toDataURL('image/png', 1.0);

  // Compose full SVG markup with single image
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
             preserveAspectRatio="none"/>
      ${svgShape}
    </svg>
  `;

  // Download SVG as file
  const blob = new Blob([svg], {type: 'image/svg+xml'});
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  
  const shapeType = document.getElementById("shapeType").value;
  const modelLabel = getModelLabel().replace(/\s+/g, '_'); // Replace spaces with underscores
  link.download = `${shapeType.charAt(0).toUpperCase() + shapeType.slice(1).toLowerCase()}_${modelLabel}.svg`;
  link.click();

  console.log("Generated Rectangle SVG with single composite image");
}

function exportRectangleRadiusAsSVG() {
  if (!currentImage) {
    alert("Please upload an image first.");
    return;
  }

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

  // Rounded rectangle SVG element
  const svgShape = `<rect 
                      x="${x}" y="${y}" 
                      width="${scaledWidth}" height="${scaledHeight}" 
                      rx="${scaledRadius}" ry="${scaledRadius}"
                      fill="none" stroke="black" />`;

  const sliceCount = 2000;
  const imgWidth = currentImage.width;
  const imgHeight = currentImage.height;
  const sliceW = imgWidth / sliceCount;
  const overlapFactor = 2;

  // Create composite canvas with higher resolution
  const compositeCanvas = document.createElement('canvas');
  compositeCanvas.width = svgWidth * 2; // Double resolution for better quality
  compositeCanvas.height = svgHeight * 2;
  const compositeCtx = compositeCanvas.getContext('2d');
  compositeCtx.imageSmoothingEnabled = true; // Enable smoothing for better quality
  compositeCtx.imageSmoothingQuality = 'high'; // Use high quality smoothing
  compositeCtx.clearRect(0, 0, compositeCanvas.width, compositeCanvas.height); // Clear to transparent
  compositeCtx.scale(2, 2); // Scale context to match doubled canvas size

  // Draw all slices onto the composite canvas
  for (let i = 0; i < sliceCount; i++) {
    const sx = i * sliceW;

    const sliceWidth = (scaledWidth / sliceCount) * overlapFactor;
    const sliceHeight = scaledHeight;

    const sliceX = x + i * (scaledWidth / sliceCount);
    const sliceY = y;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = sliceW;
    tempCanvas.height = imgHeight;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.imageSmoothingEnabled = true;
    tempCtx.imageSmoothingQuality = 'high';
    tempCtx.drawImage(
      currentImage,
      sx,
      0,
      sliceW,
      imgHeight,
      0,
      0,
      sliceW,
      imgHeight
    );

    // Draw slice onto composite canvas
    compositeCtx.drawImage(tempCanvas, sliceX, sliceY, sliceWidth, sliceHeight);
  }

  // Convert composite canvas to single image with high quality
  const compositeImageData = compositeCanvas.toDataURL('image/png', 1.0);

  // Create SVG with single image
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
           preserveAspectRatio="none" />
    ${svgShape}
  </svg>`;

  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  
  const shapeType = document.getElementById("shapeType").value;
  const modelLabel = getModelLabel().replace(/\s+/g, '_');
  link.download = `${shapeType.charAt(0).toUpperCase() + shapeType.slice(1).toLowerCase()}_${modelLabel}.svg`;
  link.click();

  console.log("Generated SVG with single composite image");
}




function exportAsWarpedSVG() {
  const diagramType = document.getElementById("diagramType").value;
  if (!currentImage) {
    alert("Please upload an image first.");
    return;
  }

  const units = DEFAULT_UNIT;
  function toPx(value) {
    return value * unitToPx[units];
  }

  // ✅ Read the dimensions
  let w = Number(document.getElementById("topWidth").value);
  let h = Number(document.getElementById("height").value);
  let bottom = Number(document.getElementById("bottomWidth").value);

  const wPx = toPx(w);
  const hPx = toPx(h);
  const bottomPx = toPx(bottom);

  const topHalf = wPx / 2;
  const bottomHalf = bottomPx / 2;
  const widthDiff = bottomHalf - topHalf;

  const verticalHeight = hPx;
  const svgWidth = canvas.clientWidth;
  const svgHeight = canvas.clientHeight;
  
  // Margins for dimension text and arrows
  const horizontalMargin = 50;
  const verticalMargin = 100;
  const topMargin = 80; // Additional top margin for the shape

  // Calculate scale to fit within canvas
  const scaleXFit = (svgWidth - 2 * horizontalMargin) / Math.max(wPx, bottomPx);
  const scaleYFit = (svgHeight - 2 * verticalMargin - topMargin) / verticalHeight;
  const scale = Math.min(scaleXFit, scaleYFit);

  const scaledWidth = wPx * scale;
  const scaledHeight = verticalHeight * scale;
  const scaledBottomWidth = bottomPx * scale;
  const scaledMaxWidth = Math.max(wPx, bottomPx) * scale;

  // Center horizontally, add top margin vertically
  const centerX = (svgWidth - scaledMaxWidth) / 2;
  const centerY = (svgHeight - scaledHeight) / 2 + topMargin;

  let angleInset = 0 * scale;
  let cornerShift = 0 * scale;

  const topLeft = {
    x: Math.round(centerX + (scaledMaxWidth - scaledWidth) / 2) + angleInset - cornerShift,
    y: Math.round(centerY),
  };
  const topRight = {
    x: Math.round(centerX + (scaledMaxWidth + scaledWidth) / 2) - angleInset + cornerShift,
    y: Math.round(centerY),
  };
  const bottomLeft = {
    x: Math.round(centerX + (scaledMaxWidth - scaledBottomWidth) / 2) - cornerShift,
    y: Math.round(centerY + scaledHeight),
  };
  const bottomRight = {
    x: Math.round(centerX + (scaledMaxWidth + scaledBottomWidth) / 2) + cornerShift,
    y: bottomLeft.y,
  };

  const angleRad = Math.atan(widthDiff / verticalHeight);

  const curveOffsetTop = -Math.tan(angleRad) * toPx(w / 2) * scale;
  const curveOffsetBottom = Math.tan(angleRad) * toPx(bottom / 2) * scale;

  // --- Generate warped edge points ---
  let topPoints = [];
  let bottomPoints = [];

  for (let i = 0; i <= 100; i++) {
    const t = i / 100;

    const topX = topLeft.x + (topRight.x - topLeft.x) * t;
    const topY = quadraticAt(topLeft.y, topLeft.y - curveOffsetTop, topRight.y, t);
    topPoints.push({ x: topX, y: topY });

    const bottomX = bottomLeft.x + (bottomRight.x - bottomLeft.x) * t;
    const bottomY = quadraticAt(bottomLeft.y, bottomRight.y + curveOffsetBottom, bottomRight.y, t);
    bottomPoints.push({ x: bottomX, y: bottomY });
  }

  // --- Path for SVG shape ---
  let pathData = `M ${round(topPoints[0].x)},${round(topPoints[0].y)}`;
  topPoints.forEach((p) => {
    pathData += ` L ${round(p.x)},${round(p.y)}`;
  });
  bottomPoints.reverse().forEach((p) => {
    pathData += ` L ${round(p.x)},${round(p.y)}`;
  });
  pathData += " Z";

  // --- Render warped image slices onto canvas ---
  const compositeCanvas = document.createElement("canvas");
  compositeCanvas.width = svgWidth * 2;
  compositeCanvas.height = svgHeight * 2;
  const compositeCtx = compositeCanvas.getContext("2d");
  compositeCtx.clearRect(0, 0, compositeCanvas.width, compositeCanvas.height);
  compositeCtx.scale(2, 2);

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
    const topY1 = quadraticAt(topLeft.y, topLeft.y - curveOffsetTop, topRight.y, t1);
    const topX2 = topLeft.x + (topRight.x - topLeft.x) * t2;
    const topY2 = quadraticAt(topLeft.y, topLeft.y - curveOffsetTop, topRight.y, t2);

    const bottomX1 = bottomLeft.x + (bottomRight.x - bottomLeft.x) * t1;
    const bottomY1 = quadraticAt(bottomLeft.y, bottomRight.y + curveOffsetBottom, bottomRight.y, t1);
    const bottomX2 = bottomLeft.x + (bottomRight.x - bottomLeft.x) * t2;
    const bottomY2 = quadraticAt(bottomLeft.y, bottomRight.y + curveOffsetBottom, bottomRight.y, t2);

    const sliceWidth = Math.hypot(topX2 - topX1, topY2 - topY1);
    const sliceHeight = Math.hypot(bottomX1 - topX1, bottomY1 - topY1);

    const angleTop = Math.atan2(topY2 - topY1, topX2 - topX1);
    const angleBottom = Math.atan2(bottomY2 - bottomY1, bottomX2 - bottomX1);
    const angle = (angleTop + angleBottom) / 2;

    compositeCtx.save();
    compositeCtx.translate(topX1, topY1);
    compositeCtx.rotate(angle);
    compositeCtx.drawImage(
      currentImage,
      sx,
      0,
      sw,
      imgHeight,
      0,
      0,
      sliceWidth + 0.6,
      sliceHeight
    );
    compositeCtx.restore();
  }

  // --- Generate final SVG ---
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

  // --- Download SVG ---
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  const shapeType = document.getElementById("shapeType").value;
  const modelLabel = getModelLabel().replace(/\s+/g, "_");
  link.download = `${shapeType.charAt(0).toUpperCase() + shapeType.slice(1).toLowerCase()}_${modelLabel}.svg`;
  link.click();

  console.log("✅ Exported warped SVG successfully.");

  // --- Helper functions ---
  function quadraticAt(p0, p1, p2, t) {
    return (1 - t) * (1 - t) * p0 + 2 * (1 - t) * t * p1 + t * t * p2;
  }

  function round(val) {
    return Number(val.toFixed(3));
  }
}







function exportSweetBoxAsSVG() {
  if (!currentImage) {
    alert("Please upload an image first.");
    return;
  }

  const units = DEFAULT_UNIT;
  const toPx = (value) => value * unitToPx[units];

  // Inputs
  const w = Number(document.getElementById("sweetWidth").value);
  const h = Number(document.getElementById("sweetHeight").value);
  const bendHeightInput = Number(document.getElementById("sweetBend").value);
  const bendFactor = 0.5;

  // Convert units to pixels
  const wPx = toPx(w);
  const hPx = toPx(h);
  const bendPx = toPx(bendHeightInput);
  const margin = 60;
  const svgWidth = canvas.clientWidth;
  const svgHeight = canvas.clientHeight;

  // Scale
  const scaleX = (svgWidth - 2 * margin) / wPx;
  const scaleY = (svgHeight - 2 * margin) / hPx;
  const scale = Math.min(scaleX, scaleY, 1);

  const scaledWidth = wPx * scale;
  const scaledHeight = hPx * scale;
  const scaledBend = bendPx * scale;

  const centerX = Math.round(svgWidth / 2);
  const centerY = Math.round(svgHeight / 2);

  // Calculate top points with bend
  const numPoints = 5;
  const topPoints = [];
  for (let i = 0; i < numPoints; i++) {
    const x = centerX - scaledWidth / 2 + (scaledWidth / (numPoints - 1)) * i;
    const bendOffset = scaledBend * bendFactor * (1 - Math.sin((Math.PI * i) / (numPoints - 1)));
    const y = centerY - scaledHeight / 2 - bendOffset;
    topPoints.push({ x, y });
  }

  // Calculate angles for bottom adjustment
  const angleL = Math.atan2(topPoints[1].y - topPoints[0].y, topPoints[1].x - topPoints[0].x);
  const angleR = Math.atan2(
    topPoints[numPoints - 1].y - topPoints[numPoints - 2].y,
    topPoints[numPoints - 1].x - topPoints[numPoints - 2].x
  );

  // Bottom points
  const bottomPoints = [];
  for (let i = 0; i < numPoints; i++) {
    let x = centerX - scaledWidth / 2 + (scaledWidth / (numPoints - 1)) * i;
    let y = topPoints[i].y + scaledHeight;
    if (i === 0) x += -Math.tan(angleL) * scaledHeight;
    if (i === numPoints - 1) x += -Math.tan(angleR) * scaledHeight;
    bottomPoints.push({ x, y });
  }

  // Build SVG path using quadratic curves (matching canvas rendering)
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

  // Create composite canvas with higher resolution
  const sliceCount = 2500;
  const imgWidth = currentImage.width;
  const imgHeight = currentImage.height;
  const sliceW = imgWidth / sliceCount;

  const compositeCanvas = document.createElement('canvas');
  compositeCanvas.width = svgWidth * 2; // Double resolution for better quality
  compositeCanvas.height = svgHeight * 2;
  const compositeCtx = compositeCanvas.getContext('2d');
  compositeCtx.imageSmoothingEnabled = true; // Enable smoothing for better quality
  compositeCtx.imageSmoothingQuality = 'high'; // Use high quality smoothing
  compositeCtx.clearRect(0, 0, compositeCanvas.width, compositeCanvas.height); // Clear to transparent
  compositeCtx.scale(2, 2); // Scale context to match doubled canvas size

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  // Draw all slices onto the composite canvas
  for (let i = 0; i < sliceCount; i++) {
    const t = i / sliceCount;
    const nextT = (i + 1) / sliceCount;

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
    tempCanvas.width = sliceW;
    tempCanvas.height = imgHeight;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.imageSmoothingEnabled = true;
    tempCtx.imageSmoothingQuality = 'high';
    tempCtx.drawImage(currentImage, i * sliceW, 0, sliceW, imgHeight, 0, 0, sliceW, imgHeight);

    // Draw slice onto composite canvas with transformation
    compositeCtx.save();
    compositeCtx.translate(topX1, topY1);
    compositeCtx.rotate(sliceAngle);
    compositeCtx.drawImage(tempCanvas, 0, 0, sliceWidth + 0.8, sliceHeight);
    compositeCtx.restore();
  }

  // Convert composite canvas to single image with high quality
  const compositeImageData = compositeCanvas.toDataURL('image/png', 1.0);

  // Create SVG with single image
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
             preserveAspectRatio="none"/>
      <path d="${pathData}" fill="none" stroke="black" stroke-width="1.2"/>
    </svg>
  `;

  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  
  const shapeType = document.getElementById("shapeType").value;
  const modelLabel = getModelLabel().replace(/\s+/g, '_');
  link.download = `${shapeType.charAt(0).toUpperCase() + shapeType.slice(1).toLowerCase()}_${modelLabel}.svg`;
  link.click();

  console.log("Generated Sweet Box SVG with single composite image");
}

document.querySelectorAll('input[name="sweetBoxSide"]').forEach(radio => {
  radio.addEventListener("change", () => {
    updateInputs(); // Update input visibility first
    updateDimensionText(); // Update dimension text
    drawKLD();      // Then redraw
  });
});
