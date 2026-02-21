// ========== HELPERS ==========
      function debounce(fn, wait = 150) {
        let t;
        return (...args) => {
          clearTimeout(t);
          t = setTimeout(() => fn.apply(this, args), wait);
        };
      }

      // ========== STATE ==========
      let currentImage = null;
      let currentImageDataUrl = null;
      let textureImageDataUrl = null;
      let currentSVGRawText = null;       // Raw SVG source text for vector-native envelope warp export
      let warpedSVGPreviewImg = null;      // Cached warped SVG <img> for live canvas preview

      /** Clear the warped preview image and free its Blob URL. */
      function clearWarpedPreview() {
        if (warpedSVGPreviewImg && warpedSVGPreviewImg._blobUrl) {
          URL.revokeObjectURL(warpedSVGPreviewImg._blobUrl);
        }
        warpedSVGPreviewImg = null;
      }
      let currentView = "bottom";
      let currentShapeType = "round";
      let currentShape = "250ml_round";
      const EXPORT_SCALE = 5;
      let isExporting = false;

      // Zoom state
      let zoomLevel = 1;
      const MIN_ZOOM = 0.25;
      const MAX_ZOOM = 5;
      const ZOOM_STEP = 0.25;

      // Pan state
      let panX = 0;
      let panY = 0;
      let isPanning = false;
      let isSpacePressed = false;
      let lastMouseX = 0;
      let lastMouseY = 0;

      let isViewer3DMinimized = false;
      let isViewer3DExpanded = false;
      let isModelLoaded = false;

      const canvas = document.getElementById("warpCanvas");
      const ctx = canvas.getContext("2d");
      const uploadText = document.getElementById("uploadText");
      const fileInput = document.getElementById("imageUpload");
      const exportPngBtn = document.getElementById("exportPngBtn");
      const exportSvgBtn = document.getElementById("exportSvgBtn");
      const exportPdfBtn = document.getElementById("exportPdfBtn");
      const shapeTypeSelect = document.getElementById("shapeTypeSelect");
      const shapeSelect = document.getElementById("shapeSelect");
      const viewSelector = document.getElementById("viewSelector");
      
      // Loading elements
      const loadingOverlay = document.getElementById("loadingOverlay");
      const loadingText = document.getElementById("loadingText");
      const loadingSubtext = document.getElementById("loadingSubtext");
      
      // Error popup elements
      const errorOverlay = document.getElementById("errorOverlay");
      const errorTitle = document.getElementById("errorTitle");
      const errorMessage = document.getElementById("errorMessage");
      const errorCloseBtn = document.getElementById("errorCloseBtn");

      // Zoom elements
      const zoomInBtn = document.getElementById("zoomInBtn");
      const zoomOutBtn = document.getElementById("zoomOutBtn");
      const zoomDisplay = document.getElementById("zoomDisplay");
      
      // Pan elements
      const panIndicator = document.getElementById("panIndicator");
      const panIndicatorText = document.getElementById("panIndicatorText");
      const resetPanBtn = document.getElementById("resetPanBtn");

      const viewer3DContainer = document.getElementById("viewer3DContainer");
      const modelViewer = document.getElementById("modelViewer");
      const viewer3DLoading = document.getElementById("viewer3DLoading");
      const viewer3DStatus = document.getElementById("viewer3DStatus");
      const viewer3DToggle = document.getElementById("viewer3DToggle");
      const viewer3DExpand = document.getElementById("viewer3DExpand");

      // ========== ZOOM FUNCTIONS ==========
      
      function canPan() {
        return zoomLevel > 1;
      }

      function updateZoomDisplay() {
        const percentage = Math.round(zoomLevel * 100);
        zoomDisplay.textContent = `${percentage}%`;
        
        // Update button states
        zoomInBtn.disabled = zoomLevel >= MAX_ZOOM;
        zoomOutBtn.disabled = zoomLevel <= MIN_ZOOM;
        
        // Update pan indicator visibility
        if (canPan()) {
          panIndicator.classList.add("visible");
        } else {
          panIndicator.classList.remove("visible");
          panIndicator.classList.remove("active");
        }
        
        // Update reset pan button visibility
        if (panX !== 0 || panY !== 0) {
          resetPanBtn.classList.add("visible");
        } else {
          resetPanBtn.classList.remove("visible");
        }
        
        // Update canvas cursor
        updateCanvasCursor();
      }

      function updateCanvasCursor() {
        canvas.classList.remove("can-pan", "space-held", "panning");
        
        if (isPanning) {
          canvas.classList.add("panning");
        } else if (isSpacePressed && canPan()) {
          canvas.classList.add("space-held");
        } else if (canPan()) {
          canvas.classList.add("can-pan");
        }
      }

      function zoomIn() {
        if (zoomLevel < MAX_ZOOM) {
          zoomLevel = Math.min(MAX_ZOOM, zoomLevel + ZOOM_STEP);
          
          // Reset pan if zooming back to 100% or below
          if (zoomLevel <= 1) {
            panX = 0;
            panY = 0;
          }
          
          mainDraw();
          updateZoomDisplay();
        }
      }

      function zoomOut() {
        if (zoomLevel > MIN_ZOOM) {
          zoomLevel = Math.max(MIN_ZOOM, zoomLevel - ZOOM_STEP);
          
          // Reset pan if zooming back to 100% or below
          if (zoomLevel <= 1) {
            panX = 0;
            panY = 0;
          }
          
          mainDraw();
          updateZoomDisplay();
        }
      }

      function resetZoom() {
        zoomLevel = 1;
        panX = 0;
        panY = 0;
        mainDraw();
        updateZoomDisplay();
      }

      function resetPan() {
        panX = 0;
        panY = 0;
        mainDraw();
        updateZoomDisplay();
      }

      function handleWheelZoom(event) {
        // Check if Ctrl key is pressed for zoom
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          
          if (event.deltaY < 0) {
            zoomIn();
          } else {
            zoomOut();
          }
        }
      }

      // ========== PAN FUNCTIONS ==========
      
      function startPan(event) {
        if (!canPan()) return;
        if (!isSpacePressed && event.button !== 1) return; // Space must be held or middle mouse
        
        isPanning = true;
        lastMouseX = event.clientX;
        lastMouseY = event.clientY;
        
        updateCanvasCursor();
        panIndicator.classList.add("active");
        panIndicatorText.textContent = "Panning...";
        
        event.preventDefault();
      }

      function doPan(event) {
        if (!isPanning) return;
        
        const deltaX = event.clientX - lastMouseX;
        const deltaY = event.clientY - lastMouseY;
        
        panX += deltaX;
        panY += deltaY;
        
        lastMouseX = event.clientX;
        lastMouseY = event.clientY;
        
        mainDraw();
        updateZoomDisplay();
      }

      function endPan() {
        if (isPanning) {
          isPanning = false;
          updateCanvasCursor();
          panIndicator.classList.remove("active");
          panIndicatorText.textContent = "Hold Space + Drag";
        }
      }

      function handleSpaceDown(event) {
        if (event.code === "Space" && !event.repeat && canPan()) {
          // Prevent default only if we're in the canvas area
          const activeElement = document.activeElement;
          const isInputFocused = activeElement && (
            activeElement.tagName === "INPUT" || 
            activeElement.tagName === "TEXTAREA" || 
            activeElement.tagName === "SELECT"
          );
          
          if (!isInputFocused) {
            event.preventDefault();
            isSpacePressed = true;
            updateCanvasCursor();
            panIndicator.classList.add("active");
            panIndicatorText.textContent = "Click & Drag to Pan";
          }
        }
      }

      function handleSpaceUp(event) {
        if (event.code === "Space") {
          isSpacePressed = false;
          if (!isPanning) {
            panIndicator.classList.remove("active");
            panIndicatorText.textContent = "Hold Space + Drag";
          }
          updateCanvasCursor();
          endPan();
        }
      }

      // Touch support for panning
      let touchStartX = 0;
      let touchStartY = 0;
      let isTouchPanning = false;

      function handleTouchStart(event) {
        if (!canPan()) return;
        if (event.touches.length === 2) {
          // Two finger touch for panning
          isTouchPanning = true;
          const touch = event.touches[0];
          touchStartX = touch.clientX;
          touchStartY = touch.clientY;
          lastMouseX = touchStartX;
          lastMouseY = touchStartY;
          isPanning = true;
          updateCanvasCursor();
          event.preventDefault();
        }
      }

      function handleTouchMove(event) {
        if (!isTouchPanning || !isPanning) return;
        if (event.touches.length === 2) {
          const touch = event.touches[0];
          const deltaX = touch.clientX - lastMouseX;
          const deltaY = touch.clientY - lastMouseY;
          
          panX += deltaX;
          panY += deltaY;
          
          lastMouseX = touch.clientX;
          lastMouseY = touch.clientY;
          
          mainDraw();
          updateZoomDisplay();
          event.preventDefault();
        }
      }

      function handleTouchEnd() {
        isTouchPanning = false;
        endPan();
      }

      // ========== LOADING & ERROR FUNCTIONS ==========
      
      function showLoading(message = "Processing...", subtext = "Please wait") {
        loadingText.textContent = message;
        loadingSubtext.textContent = subtext;
        loadingOverlay.classList.add("show");
        exportPngBtn.disabled = true;
        exportSvgBtn.disabled = true;
        exportPdfBtn.disabled = true;
      }

      function updateLoading(message, subtext = "") {
        loadingText.textContent = message;
        if (subtext) loadingSubtext.textContent = subtext;
      }

      function hideLoading() {
        loadingOverlay.classList.remove("show");
        exportPngBtn.disabled = false;
        exportSvgBtn.disabled = false;
        exportPdfBtn.disabled = false;
        isExporting = false;
      }

      function showError(title, message) {
        errorTitle.textContent = title;
        errorMessage.textContent = message;
        errorOverlay.classList.add("show");
      }

      function hideError() {
        errorOverlay.classList.remove("show");
      }

      // Only close error modal when clicking OK button
      errorCloseBtn.addEventListener("click", hideError);

      // ========== DOWNLOAD HELPER ==========
      
      function triggerDownload(blob, filename) {
        return new Promise((resolve, reject) => {
          try {
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = filename;
            link.style.display = "none";
            document.body.appendChild(link);
            
            setTimeout(() => {
              link.click();
              setTimeout(() => {
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
                resolve();
              }, 500);
            }, 100);
          } catch (error) {
            reject(error);
          }
        });
      }

      class PathSampler {
        constructor(pathData) {
          this.pathNode = document.createElementNS("http://www.w3.org/2000/svg", "path");
          this.pathNode.setAttribute("d", pathData);
          this.length = this.pathNode.getTotalLength();
        }
        getPointAt(percentage) {
          return this.pathNode.getPointAtLength(this.length * percentage);
        }
      }

      const shapeTypes = {
        round: "Round",
        round_square: "Round Square",
        rectangle: "Rectangle",
        sweet_box: "Sweet Box",
        sweet_box_te: "Sweet Box TE",
      };

      const COMMON_LABEL_MATERIALS = [
        "Bottom", "Label", "Wrap", "Decal", "Logo", "Sticker",
        "label", "bottom", "wrap", "decal", "logo", "sticker",
        "Material", "Material.001", "Material.002", "Material_0"
      ];

      const allBottleShapes = {
        "250ml_round": {
          type: "round",
          view: "bottom",
          name: "250ml Round",
          width: 837,
          height: 244,
          uploadDimensions: { width: 2908, height: 448 },
          path: "M1.37,162.42L73.32,242.27C283.84,56.41,576.84,75.5,764.01,242.27L835.96,162.42C597.61,-50.29,240.85,-53.15,1.37,162.42Z",
          topPath: "M 835.96,162.42 C 597.61,-50.29 240.85,-53.15 1.37,162.42",
          bottomPath: "M 73.32,242.27 C 283.84,56.41 576.84,75.5 764.01,242.27",
          topIsReversed: true,
          bottomIsReversed: false,
          modelPath: "./assets/models/250ml_round_t.glb",
          targetMaterials: ["Texture"],
        },
        "300ml_round": {
          type: "round",
          view: "bottom",
          name: "300ml Round",
          width: 986.98,
          height: 332.17,
          uploadDimensions: { width: 2906, height: 448 },
          path: "M892.85,294.57c-257.8-94.83-540.94-94.83-798.75,0l-5.32,1.98-45.71-122.15,6.01-2.21c286.86-105.52,601.92-105.52,888.78,0l6.04,2.15-45.75,122.2-5.3-1.98Z",
          topPath: "M49.08,172.19c286.86-105.52,601.92-105.52,888.78,0",
          bottomPath: "M892.85,294.57c-257.8-94.83-540.94-94.83-798.75,0",
          topIsReversed: false,
          bottomIsReversed: true,
          modelPath: "./assets/models/300ml_round_container.glb",
          targetMaterials: ["Bottom", "Label", "Wrap"],
        },
         "500ml_round": {
          type: "round",
          view: "bottom",
          name: "500ml Round",
          width: 945.18,
          height: 430.84,
          uploadDimensions: { width: 2890, height: 886 },
          path: "M846.13,387.86c-120.06-43.77-245.71-65.96-373.55-65.96s-252.55,22.02-372.2,65.47l-.61-1.56L24.95,193.11l2.66-.97c143.01-52.15,292.69-78.58,444.97-78.58s301.97,26.44,444.98,78.59l2.65,1.01-74.09,194.71Z",
          topPath:
            "M27.61,192.14c143.01-52.15,292.69-78.58,444.97-78.58s301.97,26.44,444.98,78.59",
          bottomPath:
            "M846.13,387.86c-120.06-43.77-245.71-65.96-373.55-65.96s-252.55,22.02-372.2,65.47",
          topIsReversed: false,
          bottomIsReversed: true,
          modelPath: "./assets/models/500ml_round_container_t.glb",
          targetMaterials: [" Texture"],
        },
        "750ml_round": {
          type: "round",
          view: "bottom",
          name: "750ml Round",
          width: 1187.25,
          height: 279.7,
          uploadDimensions: { width: 4360, height: 701 },
          path: "M3.26,122.79c376.81-163.05,803.93-163.05,1180.74,0l2.6,1.21-1.14,2.55-67.28,150.03-1.21,2.45-2.49-1.01c-332.55-143.26-709.13-143.26-1041.68,0l-2.54,1.04-1.17-2.48L1.8,126.55l-1.14-2.63,2.6-1.13Z",
          topPath: "M3.26,122.79c376.81-163.05,803.93-163.05,1180.74,0",
          bottomPath: "M1114.48,278.02c-332.55-143.26-709.13-143.26-1041.68,0",
          topIsReversed: false,
          bottomIsReversed: true,
          modelPath: "./assets/models/750ml_round_container_t.glb",
          targetMaterials: [" Texture"],
        },
        "1000ml_round": {
          type: "round",
          view: "bottom",
          name: "1000ml Round",
          width: 1186.89,
          height: 332.33,
          uploadDimensions: { width: 4153, height: 929 },
          path: "M97.62,331.03L114.97,323.22L137.59,313.59L160.4,304.43L183.4,295.74L206.58,287.53L229.93,279.8L253.44,272.55L277.1,265.79L300.9,259.51L324.82,253.73L348.86,248.44L373.02,243.64L397.25,239.35L421.59,235.56L446,232.27L470.46,229.48L494.99,227.2L519.56,225.42L544.16,224.15L568.78,223.39L593.42,223.14L618.06,223.39L642.68,224.15L667.28,225.42L691.84,227.2L716.36,229.48L740.84,232.27L765.25,235.56L789.58,239.35L813.82,243.64L837.98,248.44L862.02,253.73L885.93,259.51L909.74,265.79L933.4,272.55L956.9,279.8L980.26,287.53L1003.43,295.74L1026.43,304.43L1049.25,313.59L1071.87,323.22L1089.23,331.04L1091.77,332.1L1092.96,329.66L1185.4,132.99L1186.65,130.47L1184,129.2L1161.31,118.99L1134.45,107.56L1107.36,96.68L1080.05,86.36L1052.53,76.61L1024.8,67.43L996.9,58.83L968.81,50.8L940.56,43.35L912.17,36.48L883.63,30.21L854.97,24.52L826.19,19.42L797.32,14.92L768.35,11.01L739.31,7.71L710.21,5L681.06,2.89L651.87,1.39L622.65,.48L593.42,.18L564.19,.48L534.97,1.39L505.78,2.89L476.63,5L447.52,7.71L418.48,11.01L389.52,14.92L360.64,19.42L331.87,24.52L303.21,30.21L274.67,36.48L246.27,43.35L218.03,50.8L189.94,58.83L162.03,67.43L134.31,76.61L106.79,86.36L79.47,96.68L52.38,107.56L25.53,118.99L2.83,129.21L.24,130.46L1.42,132.99L93.89,329.65L95.16,332.1L97.62,331.03Z",
          topPath:
            "M2.83,129.21L25.53,118.99L52.38,107.56L79.47,96.68L106.79,86.36L134.31,76.61L162.03,67.43L189.94,58.83L218.03,50.8L246.27,43.35L274.67,36.48L303.21,30.21L331.87,24.52L360.64,19.42L389.52,14.92L418.48,11.01L447.52,7.71L476.63,5L505.78,2.89L534.97,1.39L564.19,.48L593.42,.18L622.65,.48L651.87,1.39L681.06,2.89L710.21,5L739.31,7.71L768.35,11.01L797.32,14.92L826.19,19.42L854.97,24.52L883.63,30.21L912.17,36.48L940.56,43.35L968.81,50.8L996.9,58.83L1024.8,67.43L1052.53,76.61L1080.05,86.36L1107.36,96.68L1134.45,107.56L1161.31,118.99L1184,129.2",
          bottomPath:
            "M97.62,331.03L114.97,323.22L137.59,313.59L160.4,304.43L183.4,295.74L206.58,287.53L229.93,279.8L253.44,272.55L277.1,265.79L300.9,259.51L324.82,253.73L348.86,248.44L373.02,243.64L397.25,239.35L421.59,235.56L446,232.27L470.46,229.48L494.99,227.2L519.56,225.42L544.16,224.15L568.78,223.39L593.42,223.14L618.06,223.39L642.68,224.15L667.28,225.42L691.84,227.2L716.36,229.48L740.84,232.27L765.25,235.56L789.58,239.35L813.82,243.64L837.98,248.44L862.02,253.73L885.93,259.51L909.74,265.79L933.4,272.55L956.9,279.8L980.26,287.53L1003.43,295.74L1026.43,304.43L1049.25,313.59L1071.87,323.22L1089.23,331.04",
          topIsReversed: false,
          bottomIsReversed: false,
          modelPath: "./assets/models/1000mlcontainer_t.glb",
          targetMaterials: [" Texture"],
        },
        "450ml_round_square": {
          type: "round_square",
          view: "bottom",
          name: "450ml Round Square",
          width: 879.22,
          height: 276.16,
          uploadDimensions: { width: 2923, height: 748 },
          path: "M93.16,274.8l9.48-5.52c16.09-9.47,32.49-18.51,49.08-27.07l8.02-3.94c9.34-4.49,18.91-8.56,28.62-12.17,8.99-3.3,18.11-6.37,27.27-9.18,15.76-4.79,31.65-9.33,47.56-13.57,18.8-5.19,37.79-9.92,56.83-14.14l9.07-1.84,8.27-1.5c10.82-1.83,21.76-3.15,32.71-3.94,9.81-.7,19.67-1.17,29.5-1.4,21.39-.46,42.86-.55,64.25-.29,12.27.09,24.57.47,36.82,1.13,13.8.7,27.58,2.2,41.2,4.49,9.2,1.6,18.39,3.47,27.48,5.58,15.63,3.68,31.23,7.65,46.71,11.9,15.9,4.24,31.78,8.78,47.53,13.56,9.16,2.81,18.27,5.88,27.27,9.19,9.71,3.61,19.29,7.68,28.62,12.17,9.02,4.37,17.96,8.98,26.74,13.81,13.78,7.6,26.32,14.75,39.8,22.73l1.29.69.73-1.14,89.79-152.32.72-1.21-1.24-.73-13.45-7.78-11.35-6.29-11.74-6.21-12.33-6.23c-19.27-9.43-38.9-18.29-58.72-26.51l-16-6.53-15.31-5.99-14.52-5.41-13.83-4.89c-23.21-8.03-46.9-14.84-70.84-20.34-19.14-4.36-38.5-8.07-57.9-11.09-11.43-1.81-22.92-3.44-34.4-4.91l-19.63-2.35c-18.16-2.05-36.45-3.52-54.71-4.39-9.72-.44-19.47-.67-29.2-.68h-3.78s-3.78,0-3.78,0l-6.4.04-12.28.25-10.51.39-15.42.86c-13.11.89-26.23,2.07-39.29,3.53l-19.63,2.35c-24.07,3.03-48.1,6.91-71.9,11.61-30.91,6.14-61.46,14.42-91.24,24.74l-13.82,4.89-14.52,5.41-15.31,5.99-16,6.53c-19.82,8.21-39.45,17.07-58.72,26.51l-12.33,6.22-11.74,6.21-11.35,6.29-13.43,7.79-1.22.71.71,1.24,89.83,152.25.7,1.19,1.24-.69Z",
          topPath:
            "M1.22,123.55l13.43-7.79l11.35-6.29l11.74-6.21l12.33-6.22c19.27-9.44,38.9-18.3,58.72-26.51l16-6.53l15.31-5.99l14.52-5.41l13.82-4.89c30.78-10.32,60.33-18.6,91.24-24.74c24.07-4.7,47.83-8.58,71.9-11.61l19.63-2.35c13.06-1.46,26.18-2.64,39.29-3.53l15.42-.86l10.51-.39l12.28-.25l6.4-.04h3.78s3.78,0,3.78,0c9.73.01,19.48.24,29.2.68c18.26.87,36.55,2.34,54.71,4.39l19.63,2.35c11.48,1.47,22.97,3.1,34.4,4.91c19.4,3.02,38.76,6.73,57.9,11.09c23.94,5.5,47.63,12.31,70.84,20.34l13.83,4.89l14.52,5.41l15.31,5.99l16,6.53c19.82,8.22,39.45,17.08,58.72,26.51l12.33,6.23l11.74,6.21l11.35,6.29l13.45,7.78",
          bottomPath:
            "M93.16,274.8l9.48-5.52c16.09-9.47,32.49-18.51,49.08-27.07l8.02-3.94c9.34-4.49,18.91-8.56,28.62-12.17,8.99-3.3,18.11-6.37,27.27-9.18,15.76-4.79,31.65-9.33,47.56-13.57,18.8-5.19,37.79-9.92,56.83-14.14l9.07-1.84,8.27-1.5c10.82-1.83,21.76-3.15,32.71-3.94,9.81-.7,19.67-1.17,29.5-1.4,21.39-.46,42.86-.55,64.25-.29,12.27.09,24.57.47,36.82,1.13,13.8.7,27.58,2.2,41.2,4.49,9.2,1.6,18.39,3.47,27.48,5.58,15.63,3.68,31.23,7.65,46.71,11.9,15.9,4.24,31.78,8.78,47.53,13.56,9.16,2.81,18.27,5.88,27.27,9.19,9.71,3.61,19.29,7.68,28.62,12.17,9.02,4.37,17.96,8.98,26.74,13.81,13.78,7.6,26.32,14.75,39.8,22.73",
          topIsReversed: false,
          bottomIsReversed: false,
          modelPath: "./assets/models/500gms&450ml container_t.glb",
          targetMaterials: [" Texture"],
        },
        "500ml_round_square": {
          type: "round_square",
          view: "bottom",
          name: "500ml Round Square",
          width: 888.9,
          height: 297.78,
          uploadDimensions: { width: 2770, height: 886 },
          path: "M100.22,295.91c7.22-3.68,14.49-7.33,21.74-10.94,12.31-6.17,24.8-12.07,37.38-17.66l8.32-3.56c6.19-2.59,12.48-5.01,18.81-7.25,6.79-2.39,13.66-4.62,20.55-6.67,11.2-3.29,22.5-6.38,33.82-9.23,17.32-4.36,34.73-8.55,52.14-12.54,13.13-3.03,26.38-5.76,39.64-8.17,10.65-1.91,21.41-3.37,32.18-4.37,11.78-1.02,23.62-1.67,35.44-1.95,14.74-.34,29.53-.51,44.27-.49,14.74-.01,29.53.15,44.27.49,9.56.23,19.14.7,28.68,1.39,8.72.64,17.44,1.59,26.09,2.85,7.55,1.11,15.1,2.41,22.59,3.88,14.87,2.96,29.72,6.21,44.47,9.74,16.79,3.93,33.58,8.09,50.26,12.45l11.22,3.06,9.92,2.87,8.8,2.71c10.34,3.28,20.56,7.03,30.56,11.21,9.38,3.95,18.7,8.14,27.88,12.53,13.21,6.34,26.37,12.87,39.42,19.55l2.4,1.28,1.41-2.51,94.51-184.07,1.26-2.46-2.5-1.36-12.45-6.29-12.14-5.86-12.54-5.77-13.15-5.78-14.04-5.89-15.25-6.12-16.64-6.41c-16.62-6.28-33.41-12.25-50.26-17.87-14.15-4.7-28.45-9.06-42.81-13.06-17.59-4.88-35.41-9.14-53.32-12.73-26.55-5.22-53.37-9.42-80.24-12.58-18.01-2.19-36.11-4-54.19-5.45l-17.34-1.16-14.62-.7c-10.74-.42-21.52-.6-32.26-.54-10.72-.06-21.47.13-32.18.54l-14.58.7-17.36,1.16-4.33.34-14.71,1.29-18.35,1.87c-25.34,2.71-50.66,6.23-75.78,10.52-29.81,5.17-59.39,12.09-88.41,20.67l-14.1,4.3c-10.3,3.24-20.58,6.65-30.78,10.2l-16.94,6.02c-16.55,5.99-33.03,12.33-49.33,18.98l-14.02,5.88-13.15,5.78-12.54,5.77-12.14,5.86-12.59,6.36-2.54,1.32,1.3,2.52c31.81,61.1,63.35,122.59,94.42,184.07l1.32,2.45,2.5-1.2Z",
          topPath:
            "M 881.89,111.84 l-12.45-6.29 -12.14-5.86 -12.54-5.77 -13.15-5.78 -14.04-5.89 -15.25-6.12 -16.64-6.41 c-16.62-6.28 -33.41-12.25 -50.26-17.87 -14.15-4.7 -28.45-9.06 -42.81-13.06 -17.59-4.88 -35.41-9.14 -53.32-12.73 -26.55-5.22 -53.37-9.42 -80.24-12.58 -18.01-2.19 -36.11-4 -54.19-5.45 l-17.34-1.16 -14.62-0.7 c-10.74-.42 -21.52-.6 -32.26-.54 -10.72-.06 -21.47.13 -32.18.54 l-14.58.7 -17.36,1.16 -4.33.34 -14.71,1.29 -18.35,1.87 c-25.34,2.71 -50.66,6.23 -75.78,10.52 -29.81,5.17 -59.39,12.09 -88.41,20.67 l-14.1,4.3 c-10.3,3.24 -20.58,6.65 -30.78,10.2 l-16.94,6.02 c-16.55,5.99 -33.03,12.33 -49.33,18.98 l-14.02,5.88 -13.15,5.78 -12.54,5.77 -12.14,5.86 -12.59,6.36",
          bottomPath:
            "M100.22,295.91c7.22-3.68,14.49-7.33,21.74-10.94,12.31-6.17,24.8-12.07,37.38-17.66l8.32-3.56c6.19-2.59,12.48-5.01,18.81-7.25,6.79-2.39,13.66-4.62,20.55-6.67,11.2-3.29,22.5-6.38,33.82-9.23,17.32-4.36,34.73-8.55,52.14-12.54,13.13-3.03,26.38-5.76,39.64-8.17,10.65-1.91,21.41-3.37,32.18-4.37,11.78-1.02,23.62-1.67,35.44-1.95,14.74-.34,29.53-.51,44.27-.49,14.74-.01,29.53.15,44.27.49,9.56.23,19.14.7,28.68,1.39,8.72.64,17.44,1.59,26.09,2.85,7.55,1.11,15.1,2.41,22.59,3.88,14.87,2.96,29.72,6.21,44.47,9.74,16.79,3.93,33.58,8.09,50.26,12.45l11.22,3.06,9.92,2.87,8.8,2.71c10.34,3.28,20.56,7.03,30.56,11.21,9.38,3.95,18.7,8.14,27.88,12.53,13.21,6.34,26.37,12.87,39.42,19.55",
          topIsReversed: true,
          bottomIsReversed: false,
          modelPath: "./assets/models/500ml_container_t.glb",
          targetMaterials: [" Texture"],
        },
        "750ml_rectangle": {
          type: "rectangle",
          view: "bottom",
          name: "500ml / 750ml Rectangle",
          width: 462.62,
          height: 309.76,
          uploadDimensions: { width: 1926, height: 1289 },
          path: "M.99,47.31 C.99,21.73 21.73,.99 47.31,.99 H 415.31 C 440.89,.99 461.63,21.73 461.63,47.31 V 262.45 C 461.63,288.03 440.89,308.77 415.31,308.77 H 47.31 C 21.73,308.77 .99,288.03 .99,262.45 Z",
          topPath:
            "M.99,47.31 C.99,21.73 21.73,.99 47.31,.99 H 415.31 C 440.89,.99 461.63,21.73 461.63,47.31",
          bottomPath:
            "M.99,262.45 C.99,288.03 21.73,308.77 47.31,308.77 H 415.31 C 440.89,308.77 461.63,288.03 461.63,262.45",
          topIsReversed: false,
          bottomIsReversed: false,
          modelPath: "./assets/models/750ml rectangular_t.glb",
          targetMaterials: [" Texture"],
        },
        "1kg_sweet_box_top": {
          type: "sweet_box",
          view: "top",
          name: "1kg Sweet Box",
          width: 636.39,
          height: 455.59,
          uploadDimensions: { width: 1926, height: 1289 },
          path: "M.5.5 h635.39 v454.59 h-635.39 Z",
          topPath: "M0,0 H636.39",
          bottomPath: "M0,455.59 H636.39",
          topIsReversed: false,
          bottomIsReversed: false,
          modelPath: "./assets/models/1000gms_sweet_t.glb",
          targetMaterials: [" Texture"],
        },
        "250ml_sweet_box_top": {
          type: "sweet_box",
          view: "top",
          name: "250g Sweet Box",
          width: 361,
          height: 273.49,
          uploadDimensions: { width: 1461, height: 1100 },
          path: "M9.29.5h342.4c4.85,0,8.82,3.94,8.82,8.79v254.92c0,4.82-3.97,8.79-8.82,8.79H9.29c-4.85,0-8.79-3.97-8.79-8.79V9.29C.5,4.44,4.44.5,9.29.5Z",
          topPath: "M0,0 H361",
          bottomPath: "M0,273.49 H361",
          topIsReversed: false,
          bottomIsReversed: false,
          modelPath: "./assets/models/250gms_sweet_t.glb",
          targetMaterials: ["TopTexture"],
        },
        "500ml_sweet_box_top": {
          type: "sweet_box",
          view: "top",
          name: "500g Sweet Box",
          width: 495.82,
          height: 351.4,
          uploadDimensions: { width: 2064, height: 1463 },
          path: "M489.44,351.01H6.42c-3.32,0-6.04-2.72-6.04-6.04V6.38C.38,3.1,3.09.38,6.42.38h483.02c3.29,0,6.01,2.72,6.01,6.01v338.6c0,3.32-2.72,6.04-6.01,6.04h0Z",
          topPath: "M0,0 H495.82",
          bottomPath: "M0,351.4 H495.82",
          topIsReversed: false,
          bottomIsReversed: false,
          modelPath: "./assets/models/500gms_sweet_t.glb",
          targetMaterials: ["TopTexture"],
        },
        "250ml_sweet_box_bottom": {
          type: "sweet_box",
          view: "bottom",
          name: "250g Sweet Box",
          width: 1342.58,
          height: 189.54,
          uploadDimensions: { width: 5533, height: 404 },
          path: "M662.63.55l-278.9,13.66c-.26,0-.48.03-.74.09L8.88,81.16l-8.31,1.59,1.42,8.27,15.85,89.69,1.64,8.25,8.26-1.36,367.77-65.74c1.19-.23,2.41-.37,3.6-.43l259.43-12.7c1.3-.06,2.64-.03,3.94.09h.11l365.58,24.6c1.84.14,3.69.45,5.44.93.14.03.26.06.37.09l266.12,52.89,7.12,1.34,2.57-6.92,29.28-86.34,2.87-8.88-9.25-2.2-289.39-57.68c-2.38-.62-4.82-1.02-7.28-1.19L668.08.66c-1.16-.11-2.33-.16-3.49-.16-.65,0-1.3.02-1.95.05",
          topPath:
            "M8.88,81.16 L382.99,14.3 c.26-.06 .48-.09 .74-.09 L662.63,0.55 c.65-.03 1.3-.05 1.95-.05 c1.16,0 2.33.05 3.49.16 L1042.28,24.34 c2.46.17 4.9.57 7.28,1.19 l289.39,57.68",
          bottomPath:
            "M27.74, 187.6 l367.77-65.74 c1.19-.23,2.41-.37,3.6-.43 l259.43-12.7 c1.3-.06,2.64-.03,3.94.09 h.11 l365.58,24.6 c1.84.14,3.69.45,5.44.93 .14.03 .26.06 .37.09 l266.12,52.89",
          topIsReversed: false,
          bottomIsReversed: false,
          modelPath: "./assets/models/250gms_sweet_t.glb",
          targetMaterials: ["Bottom1"],
        },
        "500ml_sweet_box_bottom": {
          type: "sweet_box",
          view: "bottom",
          name: "500g Sweet Box",
          width: 1798.7,
          height: 215.31,
          uploadDimensions: { width: 7446, height: 403 },
          path: "M1758.59,213.74l-356.09-70.07c-3.32-.65-6.69-1.11-10.09-1.33l-505.42-33.33c-2.98-.2-5.98-.23-8.96-.09l-341.4,15.99c-3.4.14-6.8.54-10.15,1.13L31.24,213.68l-4.25.74c-3.77.65-7.4-1.84-8.14-5.64L.63,115.74c-.37-1.87.06-3.83,1.13-5.41,1.1-1.59,2.78-2.64,4.68-2.92l4.14-.68L503.67,19.45c3.83-.68,7.68-1.1,11.57-1.3L890,.6c3.4-.17,6.83-.11,10.23.11l495.47,32.68c3.85.25,7.71.76,11.54,1.5l381.26,75.03,4.05.85c1.96.4,3.63,1.59,4.65,3.29,1.02,1.73,1.28,3.77.71,5.67l-26.79,90c-1.05,3.54-4.68,5.7-8.28,4.9l-4.25-.91Z",
          topPath:
            "M.63,115.74c-.37-1.87.06-3.83,1.13-5.41,1.1-1.59,2.78-2.64,4.68-2.92l4.14-.68L503.67,19.45c3.83-.68,7.68-1.1,11.57-1.3L890,.6c3.4-.17,6.83-.11,10.23.11l495.47,32.68c3.85.25,7.71.76,11.54,1.5l381.26,75.03,4.05.85c1.96.4,3.63,1.59,4.65,3.29,1.02,1.73,1.28,3.77.71,5.67",
          bottomPath:
            "M1758.59,213.74l-356.09-70.07c-3.32-.65-6.69-1.11-10.09-1.33l-505.42-33.33c-2.98-.2-5.98-.23-8.96-.09l-341.4,15.99c-3.4.14-6.8.54-10.15,1.13L31.24,213.68",
          topIsReversed: false,
          bottomIsReversed: true,
          modelPath: "./assets/models/500gms_sweet_t.glb",
          targetMaterials: ["Bottom1"],
        },
        "250ml_sweet_box_te_top": {
          type: "sweet_box_te",
          view: "top",
          name: "250g Sweet Box TE",
          width: 378.23,
          height: 296.16,
          uploadDimensions: { width: 503, height: 394 },
          path: "M 344.73 .5 346.35 .54 347.96 .65 349.57 .85 351.17 1.12 354.31 1.92 357.36 3.01 360.29 4.39 363.07 6.05 365.67 7.98 368.07 10.17 370.24 12.57 372.18 15.16 373.84 17.94 375.23 20.88 376.32 23.93 377.11 27.07 377.38 28.66 377.58 30.27 377.7 31.89 377.73 33.51 377.73 262.66 377.7 264.28 377.58 265.89 377.38 267.5 377.11 269.1 376.32 272.24 375.23 275.29 373.84 278.22 372.18 281 370.24 283.6 368.07 286 365.67 288.17 363.07 290.11 360.29 291.77 357.36 293.15 354.31 294.24 351.17 295.03 349.57 295.31 347.96 295.51 346.35 295.62 344.73 295.66 33.51 295.66 31.89 295.62 30.27 295.51 28.66 295.31 27.07 295.03 23.92 294.24 20.88 293.15 17.94 291.77 15.16 290.11 12.56 288.17 10.17 286 7.99 283.6 6.06 281 4.39 278.22 3.01 275.29 1.92 272.24 1.13 269.1 .85 267.5 .66 265.89 .54 264.28 .5 262.66 .5 33.51 .54 31.89 .66 30.27 .85 28.66 1.13 27.07 1.92 23.93 3.01 20.88 4.39 17.94 6.06 15.16 7.99 12.57 10.17 10.17 12.56 7.98 15.16 6.05 17.94 4.39 20.88 3.01 23.92 1.92 27.07 1.12 28.66 .85 30.27 .65 31.89 .54 33.51 .5 344.73 .5 Z",
          topPath: "M0,0 H378.23",
          bottomPath: "M0,296.16 H378.23",
          topIsReversed: false,
          bottomIsReversed: false,
          modelPath: "./assets/models/texture_250_gms_te_sb.glb",
          targetMaterials: ["TopTexture"],
        },
        "250ml_sweet_box_te_bottom": {
          type: "sweet_box_te",
          view: "bottom",
          name: "250g Sweet Box TE",
          width: 557.78,
          height: 475.73,
          uploadDimensions: { width: 742, height: 633 },
          path: "M437.53,98.37c12.09,0,21.88,9.8,21.88,21.88h97.87v235.23h-97.87c0,12.08-9.79,21.88-21.88,21.88h0v97.87H120.25v-97.86h0c-12.09-.01-21.88-9.81-21.88-21.89H.5V120.25h97.87c0-12.08,9.79-21.88,21.88-21.88h0V.5h317.28v97.86h0Z",
          topPath: "M0,0 H557.78",
          bottomPath: "M0,475.73 H557.78",
          topIsReversed: false,
          bottomIsReversed: false,
          modelPath: "./assets/models/texture_250_gms_te_sb.glb",
          targetMaterials: ["Bottom1"],
        },
        "500ml_sweet_box_te_bottom": {
          type: "sweet_box_te",
          view: "bottom",
          name: "500g Sweet Box TE",
          width: 695.7,
          height: 560.63,
          uploadDimensions: { width: 7446, height: 403 },
          path: "M 122.64 3.76 122.39 .92 572.87 .5 572.62 3.34 563.84 104.14 564.26 104.14 566.94 104.29 569.58 104.7 572.17 105.36 574.68 106.27 577.09 107.42 579.38 108.8 581.52 110.39 583.5 112.18 585.29 114.16 586.88 116.3 588.26 118.59 589.41 121 590.32 123.51 590.98 126.1 591.39 128.74 591.54 131.41 591.54 131.84 692.37 123.05 695.2 122.78 695.2 437.82 692.37 437.58 591.54 428.8 591.54 429.22 591.28 432.82 590.5 436.5 589.18 440.16 587.3 443.69 584.89 446.96 582 449.84 578.74 452.26 575.21 454.14 571.54 455.46 567.86 456.23 564.26 456.5 563.84 456.5 572.62 557.3 572.88 560.13 122.39 559.7 122.64 556.87 131.39 456.5 130.96 456.5 127.37 456.23 123.69 455.46 120.02 454.14 116.49 452.26 113.23 449.84 110.34 446.96 107.93 443.69 106.05 440.16 104.72 436.5 103.95 432.82 103.69 429.22 103.69 428.99 103.69 428.8 3.34 437.54 .5 437.78 .5 122.84 3.34 123.09 103.69 131.84 103.69 131.64 103.69 131.41 103.95 127.82 104.72 124.14 106.05 120.47 107.93 116.94 110.34 113.68 113.23 110.79 116.49 108.38 120.02 106.5 123.69 105.17 127.37 104.4 130.96 104.14 131.39 104.14 122.64 3.76 Z",
          topPath: "M 131.39 104.14 H 563.84",
          bottomPath: "M 131.39 456.5 H 563.84",
          topIsReversed: false,
          bottomIsReversed: false,
          modelPath: "./assets/models/texture_500_gms_te_sb.glb",
          targetMaterials: ["Bottom1"],
        },
        "500ml_sweet_box_te_top": {
          type: "sweet_box_te",
          view: "top",
          name: "500g Sweet Box TE",
          width: 509.61,
          height: 374.16,
          uploadDimensions: { width: 2064, height: 1436 },
          path: "M3.86,28.85C4.36,15.15,15.42,4.2,29.12,3.86,179.56.04,330.06.04,480.5,3.86c13.7.34,24.76,11.29,25.26,24.99,3.82,105.45,3.82,211.01,0,316.46-.5,13.7-11.56,24.65-25.26,25-150.44,3.81-300.94,3.81-451.38,0-13.7-.35-24.76-11.3-25.26-25C.04,239.86.04,134.3,3.86,28.85Z",
          topPath: "M0,0 H509.61",
          bottomPath: "M0,374.16 H509.61",
          topIsReversed: false,
          bottomIsReversed: false,
          modelPath: "./assets/models/texture_500_gms_te_sb.glb",
          targetMaterials: ["TopTexture"],
        },
      };

      const shapeGroups = {};
      const keyToGroupName = {};

      // ========== 3D VIEWER FUNCTIONS ==========

      function showStatus(message) {
        viewer3DStatus.textContent = message;
        viewer3DStatus.classList.remove("hidden");
      }

      function hideStatus() {
        viewer3DStatus.classList.add("hidden");
      }

      function show3DLoading() {
        viewer3DLoading.classList.remove("hidden");
        hideStatus();
      }

      function hide3DLoading() {
        viewer3DLoading.classList.add("hidden");
      }

      function findBestMaterial(viewer, preferredNames) {
        if (!viewer.model || !viewer.model.materials) return null;
        const materials = viewer.model.materials;

        for (const name of preferredNames) {
          const mat = materials.find(m => m.name === name);
          if (mat) return mat;
        }

        for (const name of preferredNames) {
          const mat = materials.find(m => m.name.toLowerCase() === name.toLowerCase());
          if (mat) return mat;
        }

        for (const name of preferredNames) {
          const mat = materials.find(m => 
            m.name.toLowerCase().includes(name.toLowerCase()) ||
            name.toLowerCase().includes(m.name.toLowerCase())
          );
          if (mat) return mat;
        }

        for (const name of COMMON_LABEL_MATERIALS) {
          const mat = materials.find(m => m.name === name);
          if (mat) return mat;
        }

        return materials.length > 0 ? materials[0] : null;
      }

      async function applyTextureToMaterial(viewer, material, textureUrl) {
        if (!viewer || !material || !textureUrl) return false;

        try {
          const texture = await viewer.createTexture(textureUrl);
          if (!texture) return false;

          const pbr = material.pbrMetallicRoughness;

          if (typeof pbr.setBaseColorFactor === 'function') {
            pbr.setBaseColorFactor([1.0, 1.0, 1.0, 1.0]);
          }

          if (pbr.baseColorTexture) {
            pbr.baseColorTexture.setTexture(texture);
          }

          try {
            const texInfo = pbr.baseColorTexture;
            if (texInfo && texInfo.texture && texInfo.texture.sampler) {
              const sampler = texInfo.texture.sampler;
              const GL_CLAMP_TO_EDGE = 33071;
              const GL_LINEAR = 9729;
              const GL_LINEAR_MIPMAP_LINEAR = 9987;

              if (typeof sampler.setWrapS === 'function') {
                sampler.setWrapS(GL_CLAMP_TO_EDGE);
                sampler.setWrapT(GL_CLAMP_TO_EDGE);
              }
              if (typeof sampler.setMinFilter === 'function') {
                sampler.setMinFilter(GL_LINEAR_MIPMAP_LINEAR);
              }
              if (typeof sampler.setMagFilter === 'function') {
                sampler.setMagFilter(GL_LINEAR);
              }
            }
          } catch (e) {
            console.warn("Could not set sampler settings:", e);
          }

          if (typeof pbr.setMetallicFactor === 'function') {
            pbr.setMetallicFactor(0.0);
          }
          if (typeof pbr.setRoughnessFactor === 'function') {
            pbr.setRoughnessFactor(0.5);
          }

          return true;
        } catch (error) {
          console.error("Error applying texture:", error);
          return false;
        }
      }

      async function applyTextureToModel() {
        if (!modelViewer.model || !textureImageDataUrl) return;

        const shape = getCurrentShape();
        if (!shape) return;

        const materialNames = shape.targetMaterials || COMMON_LABEL_MATERIALS;
        const material = findBestMaterial(modelViewer, materialNames);

        if (!material) return;

        await applyTextureToMaterial(modelViewer, material, textureImageDataUrl);
      }

      async function load3DModel(shape) {
        isModelLoaded = false;

        if (!shape || !shape.modelPath) {
          showStatus("No 3D model");
          modelViewer.src = "";
          return;
        }

        show3DLoading();
        modelViewer.src = shape.modelPath + "?t=" + Date.now();
      }

      modelViewer.addEventListener("load", async () => {
        isModelLoaded = true;
        hide3DLoading();
        hideStatus();

        let attempts = 0;
        while (!modelViewer.model && attempts < 100) {
          await new Promise(r => setTimeout(r, 50));
          attempts++;
        }

        if (textureImageDataUrl && modelViewer.model) {
          await applyTextureToModel();
        }
      });

      modelViewer.addEventListener("error", () => {
        hide3DLoading();
        showStatus("Load failed");
        isModelLoaded = false;
      });

      modelViewer.addEventListener("progress", (event) => {
        const progress = event.detail.totalProgress;
        if (progress < 1) {
          const percent = Math.round(progress * 100);
          viewer3DLoading.querySelector("span").textContent = `${percent}%`;
        }
      });

      function toggleViewer3D() {
        isViewer3DMinimized = !isViewer3DMinimized;
        viewer3DContainer.classList.toggle("minimized", isViewer3DMinimized);
        
        if (isViewer3DMinimized) {
          isViewer3DExpanded = false;
          viewer3DContainer.classList.remove("expanded");
        }
      }

      function toggleViewer3DExpand() {
        if (isViewer3DMinimized) return;
        isViewer3DExpanded = !isViewer3DExpanded;
        viewer3DContainer.classList.toggle("expanded", isViewer3DExpanded);
      }

      viewer3DToggle.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleViewer3D();
      });

      viewer3DExpand.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleViewer3DExpand();
      });

      viewer3DContainer.addEventListener("click", (e) => {
        if (isViewer3DMinimized && !e.target.closest('.viewer3D-btn')) {
          toggleViewer3D();
        }
      });

      // ========== SHAPE FUNCTIONS ==========

      function preProcessShapes() {
        for (const [key, shape] of Object.entries(allBottleShapes)) {
          shape.topSampler = new PathSampler(shape.topPath);
          shape.bottomSampler = new PathSampler(shape.bottomPath);

          if (!shapeGroups[shape.name]) {
            shapeGroups[shape.name] = {};
          }
          shapeGroups[shape.name][shape.view] = key;
          keyToGroupName[key] = shape.name;
        }
      }

      function getCurrentShape() {
        return currentShape ? allBottleShapes[currentShape] : null;
      }

      function updateUploadPlaceholder() {
        const shape = getCurrentShape();
        if (shape && shape.uploadDimensions) {
          const { width, height } = shape.uploadDimensions;
          uploadText.innerHTML = `<span class="text-[0.65vw] text-slate-500 block text-center">${width} × ${height}px</span>Drag & drop or <span class="font-semibold text-blue-600 underline">Browse</span>`;
        } else {
          uploadText.innerHTML = 'Drag & drop or <span class="font-semibold text-blue-600 underline">Browse</span>';
        }
      }

      function toggleViewSelector() {
        if (currentShapeType === "sweet_box" || currentShapeType === "sweet_box_te") {
          viewSelector.classList.remove("hidden");
        } else {
          viewSelector.classList.add("hidden");
        }
      }

      function syncSweetBoxViewControls() {
        const topRadioDiv = document.getElementById("viewTopRadio").parentElement;
        const bottomRadioDiv = document.getElementById("viewBottomRadio").parentElement;

        if ((currentShapeType !== "sweet_box" && currentShapeType !== "sweet_box_te") || !currentShape) {
          topRadioDiv.classList.add("hidden");
          bottomRadioDiv.classList.add("hidden");
          return;
        }

        const groupName = keyToGroupName[currentShape];
        const group = shapeGroups[groupName];

        topRadioDiv.classList.toggle("hidden", !group.top);
        bottomRadioDiv.classList.toggle("hidden", !group.bottom);

        if (currentShape.endsWith("_top")) {
          currentView = "top";
          document.getElementById("viewTopRadio").checked = true;
        } else if (currentShape.endsWith("_bottom")) {
          currentView = "bottom";
          document.getElementById("viewBottomRadio").checked = true;
        }
      }

      function updateSpecificShapeSelector() {
        shapeSelect.innerHTML = "";
        let firstShapeKey = null;

        if (currentShapeType === "sweet_box" || currentShapeType === "sweet_box_te") {
          const uniqueNames = new Set();
          for (const key in allBottleShapes) {
            const shape = allBottleShapes[key];
            if (shape.type === currentShapeType && !uniqueNames.has(shape.name)) {
              uniqueNames.add(shape.name);
              const option = document.createElement("option");
              option.value = shape.name;
              option.textContent = shape.name;
              shapeSelect.appendChild(option);
            }
          }
          if (shapeSelect.options.length > 0) {
            const selectedName = shapeSelect.options[0].value;
            shapeSelect.value = selectedName;
            const group = shapeGroups[selectedName];
            firstShapeKey = group.top || group.bottom;
          }
        } else {
          for (const [key, shape] of Object.entries(allBottleShapes)) {
            if (shape.type === currentShapeType) {
              const option = document.createElement("option");
              option.value = key;
              option.textContent = shape.name;
              shapeSelect.appendChild(option);
              if (!firstShapeKey) firstShapeKey = key;
            }
          }
          if (firstShapeKey) shapeSelect.value = firstShapeKey;
        }

        currentShape = firstShapeKey;
        syncSweetBoxViewControls();

        const shape = getCurrentShape();
        load3DModel(shape);
      }

      function populateShapeTypes() {
        shapeTypeSelect.innerHTML = "";
        for (const [key, name] of Object.entries(shapeTypes)) {
          const option = document.createElement("option");
          option.value = key;
          option.textContent = name;
          shapeTypeSelect.appendChild(option);
        }
        shapeTypeSelect.value = currentShapeType;
      }

      function resizeCanvas() {
        const dpr = window.devicePixelRatio || 1;
        canvas.width = canvas.clientWidth * dpr;
        canvas.height = canvas.clientHeight * dpr;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
      }

      function drawWarp(localCtx, img, shape, offsetX, offsetY, finalScale, isExport, heightAdjust = 1.0) {
        const sliceCountBase = isExport ? 4000 : 2000;
        const imgWidth = img.width;
        const imgHeight = img.height;
        const sliceCount = Math.min(sliceCountBase, Math.max(1, Math.floor(imgWidth)));
        const sourceSliceWidth = imgWidth / sliceCount;

        const isWideShape = shape.type === "round_square" || shape.type === "sweet_box" || shape.type === "sweet_box_te";
        const isSweetBox = shape.type === "sweet_box" || shape.type === "sweet_box_te";
        const isLargeRound = ["300ml_round", "500ml_round", "750ml_round", "1000ml_round"].includes(currentShape);

        let baseOverlap;
        if (isSweetBox) baseOverlap = isExport ? 40 : 20;
        else if (isLargeRound) baseOverlap = isExport ? 30 : 15;
        else if (isWideShape) baseOverlap = isExport ? 20 : 10;
        else baseOverlap = isExport ? 8 : 4;

        for (let i = 0; i < sliceCount; i++) {
          const t0 = i / sliceCount;
          const t1 = (i + 1) / sliceCount;
          const edgeExtension = isSweetBox ? 0.03 : 0.01;
          const tTop0 = shape.topIsReversed ? 1 - t0 : t0;
          const tTop1 = shape.topIsReversed ? 1 - t1 : t1;
          const tBot0 = shape.bottomIsReversed ? 1 - t0 : t0;
          const tBot1 = shape.bottomIsReversed ? 1 - t1 : t1;

          const clampedTTop0 = Math.min(Math.max(tTop0, -edgeExtension), 1 + edgeExtension);
          const clampedTTop1 = Math.min(Math.max(tTop1, -edgeExtension), 1 + edgeExtension);
          const clampedTBot0 = Math.min(Math.max(tBot0, -edgeExtension), 1 + edgeExtension);
          const clampedTBot1 = Math.min(Math.max(tBot1, -edgeExtension), 1 + edgeExtension);

          if ((clampedTTop0 < -0.05 && clampedTTop1 < -0.05) || (clampedTTop0 > 1.05 && clampedTTop1 > 1.05)) continue;

          const pTop1 = shape.topSampler.getPointAt(Math.min(Math.max(clampedTTop0, 0), 1));
          const pBot1 = shape.bottomSampler.getPointAt(Math.min(Math.max(clampedTBot0, 0), 1));
          const pTop2 = shape.topSampler.getPointAt(Math.min(Math.max(clampedTTop1, 0), 1));
          const pBot2 = shape.bottomSampler.getPointAt(Math.min(Math.max(clampedTBot1, 0), 1));

          const top1X = pTop1.x * finalScale + offsetX;
          const top1Y = pTop1.y * finalScale + offsetY;
          const bot1X = pBot1.x * finalScale + offsetX;
          const bot1Y = pBot1.y * finalScale + offsetY;
          const top2X = pTop2.x * finalScale + offsetX;
          const top2Y = pTop2.y * finalScale + offsetY;
          const bot2X = pBot2.x * finalScale + offsetX;
          const bot2Y = pBot2.y * finalScale + offsetY;

          const midTopX = (top1X + top2X) / 2;
          const midTopY = (top1Y + top2Y) / 2;
          const midBotX = (bot1X + bot2X) / 2;
          const midBotY = (bot1Y + bot2Y) / 2;

          const sliceHeight = Math.hypot(midBotX - midTopX, midBotY - midTopY) * heightAdjust;
          const sliceAngle = Math.atan2(midBotY - midTopY, midBotX - midTopX) - Math.PI / 2;

          const topWidth = Math.hypot(top2X - top1X, top2Y - top1Y);
          const botWidth = Math.hypot(bot2X - bot1X, bot2Y - bot1Y);
          const sliceWidth = Math.max(topWidth, botWidth);

          let overlap = baseOverlap;
          const normalizedT = Math.min(Math.max(t0, 0), 1);

          if (isSweetBox) {
            if (isExport) {
              if (normalizedT < 0.02 || normalizedT > 0.98) overlap = 80;
              else if (normalizedT < 0.05 || normalizedT > 0.95) overlap = 60;
              else if (normalizedT < 0.1 || normalizedT > 0.9) overlap = 40;
              else {
                const edgeFactor = Math.min(normalizedT * 3, (1 - normalizedT) * 3, 1);
                overlap = baseOverlap + (20 - baseOverlap) * (1 - edgeFactor);
              }
            } else {
              if (normalizedT < 0.05 || normalizedT > 0.95) overlap = 40;
              else if (normalizedT < 0.1 || normalizedT > 0.9) overlap = 30;
              else overlap = 20;
            }
          } else if (isWideShape) {
            const edgeFactor = Math.min(normalizedT * 5, (1 - normalizedT) * 5, 1);
            overlap = baseOverlap + (15 - baseOverlap) * (1 - edgeFactor);
            if (isExport) {
              if (normalizedT < 0.05 || normalizedT > 0.95) overlap += 25;
              else if (normalizedT < 0.1 || normalizedT > 0.9) overlap += 15;
            } else {
              if (normalizedT < 0.1 || normalizedT > 0.9) overlap += 10;
            }
          } else if (isLargeRound) {
            if (isExport) {
              if (normalizedT < 0.05 || normalizedT > 0.95) overlap += 25;
              else if (normalizedT < 0.1 || normalizedT > 0.9) overlap += 15;
            } else {
              if (normalizedT < 0.1 || normalizedT > 0.9) overlap += 10;
            }
          }

          if (sliceWidth < 0.1) continue;

          localCtx.save();
          localCtx.translate(midTopX, midTopY);
          localCtx.rotate(sliceAngle);

          let verticalExtension = 0;
          if (shape.type !== "rectangle") {
            if (isSweetBox) verticalExtension = isExport ? 40 : 20;
            else if (isWideShape) verticalExtension = isExport ? 22 : 10;
            else if (shape.type === "round") {
              if (shape.name === "250ml Round") verticalExtension = 0;
              else verticalExtension = isExport ? 10 : 0;
            }
          }

          const sourceLeft = Math.max(0, Math.floor(i * sourceSliceWidth));
          const sourceRight = Math.min(imgWidth, Math.ceil((i + 1) * sourceSliceWidth));
          const sourceW = Math.max(1, sourceRight - sourceLeft);

          localCtx.drawImage(img, sourceLeft, 0, sourceW, imgHeight, -(sliceWidth + overlap) / 2, -verticalExtension, sliceWidth + overlap, sliceHeight + verticalExtension * 2);
          localCtx.restore();
        }
      }

      function renderImageContent(localCtx, targetW, targetH, isExport, exportScale, clearBackground, applyPan = false) {
        if (clearBackground) localCtx.clearRect(0, 0, targetW, targetH);

        const shape = getCurrentShape();
        if (!shape) return;

        const margin = isExport ? 0 : 20;
        const scaleXFit = (targetW - 2 * margin) / shape.width;
        const scaleYFit = (targetH - 2 * margin) / shape.height;
        let finalScale = isExport ? exportScale : Math.min(scaleXFit, scaleYFit);
        
        // Apply zoom level for preview (not for export)
        if (!isExport) {
          finalScale *= zoomLevel;
        }

        const scaledW = shape.width * finalScale;
        const scaledH = shape.height * finalScale;
        let offsetX = (targetW - scaledW) / 2;
        let offsetY = (targetH - scaledH) / 2;
        
        // Apply pan offset for preview
        if (applyPan && !isExport) {
          offsetX += panX;
          offsetY += panY;
        }

        const path = new Path2D(shape.path);
        const transformMatrix = new DOMMatrix();
        transformMatrix.translateSelf(offsetX, offsetY);
        transformMatrix.scaleSelf(finalScale, finalScale);

        if (currentImage) {
          localCtx.save();
          localCtx.transform(transformMatrix.a, transformMatrix.b, transformMatrix.c, transformMatrix.d, transformMatrix.e, transformMatrix.f);
          localCtx.clip(path);
          localCtx.setTransform(1, 0, 0, 1, 0, 0);

          if (!isExport && window.devicePixelRatio && localCtx === ctx) {
            localCtx.scale(window.devicePixelRatio, window.devicePixelRatio);
          }

          // ── Warped SVG preview path (SVG source + Paper.js warp engine) ──────
          // When the source was an SVG and the warped preview is ready,
          // draw the pre-rendered warped image directly — it already fills
          // the shape's coordinate space so we just draw it at the shape bounds.
          if (!isExport && warpedSVGPreviewImg && warpedSVGPreviewImg.complete && currentSVGRawText) {
            localCtx.drawImage(warpedSVGPreviewImg, offsetX, offsetY, scaledW, scaledH);
            localCtx.restore();
            return;
          }

          let imageOffsetX = 0;
          const needsHorizontalShift = ["500ml_round", "750ml_round", "1000ml_round", "450ml_round_square", "500ml_round_square"].includes(currentShape);
          if (needsHorizontalShift) imageOffsetX = isExport ? 22 : 5;

          if (shape.type === "rectangle" || shape.view === "top" || shape.type === "sweet_box_te") {
            let drawOffsetX = offsetX + imageOffsetX;
            let drawOffsetY = offsetY;
            let drawScaledW = scaledW;
            let drawScaledH = scaledH;

            if (currentShape === "250ml_sweet_box_te_bottom") {
              const scaleFactor = 1.029;
              drawScaledW = scaledW * scaleFactor;
              drawScaledH = scaledH * scaleFactor;
              drawOffsetX = offsetX - (drawScaledW - scaledW) / 2 + imageOffsetX;
              drawOffsetY = offsetY - (drawScaledH - scaledH) / 2;
            }

            localCtx.drawImage(currentImage, drawOffsetX, drawOffsetY, drawScaledW, drawScaledH);
          } else {
            drawWarp(localCtx, currentImage, shape, offsetX + imageOffsetX, offsetY, finalScale, isExport, 1.0);
          }

          localCtx.restore();
        } else {
          localCtx.save();
          localCtx.transform(transformMatrix.a, transformMatrix.b, transformMatrix.c, transformMatrix.d, transformMatrix.e, transformMatrix.f);
          localCtx.fillStyle = "#eee";
          localCtx.fill(path);
          localCtx.restore();
        }
      }

      function drawShape(localCtx, targetW, targetH, isExport, exportScale, clearBackground, applyPan = false) {
        localCtx.imageSmoothingEnabled = true;
        localCtx.imageSmoothingQuality = "high";

        renderImageContent(localCtx, targetW, targetH, isExport, exportScale, clearBackground, applyPan);

        const shape = getCurrentShape();
        if (!shape) {
          if (clearBackground) localCtx.clearRect(0, 0, targetW * (window.devicePixelRatio || 1), targetH * (window.devicePixelRatio || 1));
          const dpr = window.devicePixelRatio || 1;
          localCtx.font = `${16 * dpr}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
          localCtx.textAlign = "center";
          localCtx.fillStyle = "#9ca3af";
          localCtx.fillText("No shapes available for this type/view.", (targetW * dpr) / 2, (targetH * dpr) / 2);
          return;
        }

        const margin = isExport ? 0 : 20;
        const scaleXFit = (targetW - 2 * margin) / shape.width;
        const scaleYFit = (targetH - 2 * margin) / shape.height;
        let finalScale = isExport ? exportScale : Math.min(scaleXFit, scaleYFit);
        
        // Apply zoom level for preview (not for export)
        if (!isExport) {
          finalScale *= zoomLevel;
        }
        
        const scaledW = shape.width * finalScale;
        const scaledH = shape.height * finalScale;
        let offsetX = (targetW - scaledW) / 2;
        let offsetY = (targetH - scaledH) / 2;
        
        // Apply pan offset for preview
        if (applyPan && !isExport) {
          offsetX += panX;
          offsetY += panY;
        }

        const path = new Path2D(shape.path);
        const transformMatrix = new DOMMatrix();
        transformMatrix.translateSelf(offsetX, offsetY);
        transformMatrix.scaleSelf(finalScale, finalScale);

        localCtx.save();
        localCtx.transform(transformMatrix.a, transformMatrix.b, transformMatrix.c, transformMatrix.d, transformMatrix.e, transformMatrix.f);
        if (!isExport) {
          localCtx.strokeStyle = "#ed312c";
          localCtx.lineWidth = 2 / finalScale;
          localCtx.stroke(path);
        }
        localCtx.restore();
      }

      function mainDraw() {
        resizeCanvas();
        drawShape(ctx, canvas.clientWidth, canvas.clientHeight, false, 1, true, true);
      }

      /**
       * Inline all <image> href/xlink:href attributes in an SVG document as
       * base64 data URIs so the serialised SVG string is fully self-contained.
       * Non-data-URI references are fetched/drawn via a canvas and replaced.
       * Already-inlined data URIs are left untouched.
       *
       * @param {Document} svgDoc  - Parsed SVG document (in-place mutation)
       * @returns {Promise<void>}
       */
      async function inlineSVGImages(svgDoc) {
        const XLINK_NS = "http://www.w3.org/1999/xlink";
        const imageEls = Array.from(svgDoc.querySelectorAll("image"));
        if (!imageEls.length) return;

        await Promise.all(imageEls.map(el => new Promise(resolve => {
          const href = el.getAttribute("href") ||
                       el.getAttributeNS(XLINK_NS, "href") || "";

          // Already a data URI — nothing to do
          if (!href || href.startsWith("data:")) { resolve(); return; }

          const img = new Image();
          img.crossOrigin = "anonymous";

          img.onload = () => {
            try {
              const c = document.createElement("canvas");
              c.width  = img.naturalWidth  || 1;
              c.height = img.naturalHeight || 1;
              c.getContext("2d").drawImage(img, 0, 0);
              const dataUrl = c.toDataURL("image/png");
              el.setAttribute("href", dataUrl);
              el.setAttributeNS(XLINK_NS, "xlink:href", dataUrl);
            } catch (e) {
              // canvas tainted or other error — leave href as-is
              console.warn("inlineSVGImages: could not inline", href, e);
            }
            resolve();
          };

          img.onerror = () => {
            // Could not load — leave href as-is so the browser at least tries
            console.warn("inlineSVGImages: failed to load", href);
            resolve();
          };

          img.src = href;
        })));
      }

      async function processUploadedImage(img, shape) {
        updateLoading("Applying to shape...", "Almost done");
        
        currentImage = img;

        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = img.width;
        tempCanvas.height = img.height;
        const tempCtx = tempCanvas.getContext("2d");
        tempCtx.drawImage(img, 0, 0);
        currentImageDataUrl = tempCanvas.toDataURL("image/png");
        textureImageDataUrl = currentImageDataUrl;

        // If source was an SVG, build the warped preview image now so the
        // canvas shows the true vector warp immediately after upload.
        if (currentSVGRawText) {
          await buildWarpedPreview();
        }

        await new Promise(r => setTimeout(r, 100));

        if (isModelLoaded && modelViewer.model) {
          updateLoading("Applying 3D texture...", "Finishing up");
          await applyTextureToModel();
        }

        mainDraw();
        hideLoading();
      }

      /**
       * Build the warped SVG preview image that is drawn live on the canvas.
       * Runs Paper.js envelope warp on the raw SVG and caches the result as
       * an <img> element so renderImageContent() can draw it instantly.
       */
      async function buildWarpedPreview() {
        const shape = getCurrentShape();
        if (!shape || !currentSVGRawText) {
          warpedSVGPreviewImg = null;
          return;
        }

        try {
          // Run the warp engine (same logic used for export)
          const warpedSVGString = buildWarpedSVG(currentSVGRawText, shape);
          if (!warpedSVGString) {
            warpedSVGPreviewImg = null;
            return;
          }

          // Load warped SVG into an <img> via Blob URL
          await new Promise((resolve) => {
            const blob = new Blob([warpedSVGString], { type: "image/svg+xml" });
            const url  = URL.createObjectURL(blob);

            const img = new Image();
            img.width  = Math.round(shape.width);
            img.height = Math.round(shape.height);

            img.onload = () => {
              // Release the old preview blob URL
              if (warpedSVGPreviewImg && warpedSVGPreviewImg._blobUrl) {
                URL.revokeObjectURL(warpedSVGPreviewImg._blobUrl);
              }
              img._blobUrl = url;
              warpedSVGPreviewImg = img;
              resolve();
            };

            img.onerror = () => {
              URL.revokeObjectURL(url);
              warpedSVGPreviewImg = null;
              resolve();
            };

            img.src = url;
          });

        } catch (err) {
          console.warn("buildWarpedPreview failed:", err);
          warpedSVGPreviewImg = null;
        }
      }

      async function handleImageUpload(event) {
        const file = (event.target.files || [])[0];

        if (!file) {
          currentImage = null;
          currentImageDataUrl = null;
          textureImageDataUrl = null;
          mainDraw();
          updateUploadPlaceholder();
          const shape = getCurrentShape();
          if (shape) load3DModel(shape);
          return;
        }

        showLoading("Loading image...", "Reading file");

        const isSVG = file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg");
        const isAI = file.name.toLowerCase().endsWith(".ai");
        const shape = getCurrentShape();

        if (isAI) {
          const reader = new FileReader();
          reader.onload = async function (e) {
            updateLoading("Processing AI file...", "Rendering content");
            try {
              const loadingTask = pdfjsLib.getDocument({ data: e.target.result });
              const pdf = await loadingTask.promise;
              const page = await pdf.getPage(1);
              
              // Calculate scale to match required upload dimensions or minimum 3000px width
              const targetWidth = shape && shape.uploadDimensions ? shape.uploadDimensions.width : 3000;
              const viewportOriginal = page.getViewport({ scale: 1.0 });
              const scale = targetWidth / viewportOriginal.width;
              const viewport = page.getViewport({ scale });
              
              const tempCanvas = document.createElement("canvas");
              const context = tempCanvas.getContext("2d");
              tempCanvas.width = viewport.width;
              tempCanvas.height = viewport.height;
              
              await page.render({ canvasContext: context, viewport: viewport }).promise;
              
              const img = new Image();
              img.onload = async () => {
                if (shape && shape.uploadDimensions) {
                  if (img.width < shape.uploadDimensions.width || img.height < shape.uploadDimensions.height) {
                    hideLoading();
                    showError("Image Too Small", `The rendered AI dimensions (${img.width} × ${img.height}px) are smaller than required.\n\nMinimum size: ${shape.uploadDimensions.width} × ${shape.uploadDimensions.height}px`);
                    return;
                  }
                }
                
                const fullName = file.name;
                const dotIndex = fullName.lastIndexOf(".");
                let name = dotIndex !== -1 ? fullName.substring(0, dotIndex) : fullName;
                const ext = dotIndex !== -1 ? fullName.substring(dotIndex) : "";
                if (name.length > 12) name = name.substring(0, 12) + "...";
                uploadText.textContent = `${name}${ext}`;
                
                await processUploadedImage(img, shape);
              };
              img.src = tempCanvas.toDataURL("image/png");
              
            } catch (err) {
              console.error("AI rendering failed:", err);
              hideLoading();
              showError("Invalid AI File", "The Adobe Illustrator file could not be parsed. Please ensure it was saved with 'Create PDF Compatible File' checked in Illustrator.");
              fileInput.value = "";
              updateUploadPlaceholder();
            }
          };
          reader.readAsArrayBuffer(file);
          return;
        }

        if (isSVG) {
          const reader = new FileReader();
          reader.onload = async function (e) {
            updateLoading("Processing SVG...", "Parsing file");
            
            let svgText = e.target.result;
            const parser = new DOMParser();
            const svgDoc = parser.parseFromString(svgText, "image/svg+xml");
            const svgElement = svgDoc.querySelector("svg");

            const parserError = svgDoc.querySelector("parsererror");
            if (parserError || !svgElement) {
              hideLoading();
              showError("Invalid SVG File", "The SVG file could not be parsed. Please make sure it's a valid SVG file.");
              currentImage = null;
              currentImageDataUrl = null;
              textureImageDataUrl = null;
              currentSVGRawText = null;
              clearWarpedPreview();
              fileInput.value = "";
              updateUploadPlaceholder();
              mainDraw();
              return;
            }

            // ── Inline all <image> hrefs as base64 data URIs ─────────────────
            // Warped SVGs are loaded from Blob URLs; external image references
            // are blocked by the browser in that context. Converting them to
            // data URIs makes the serialised output fully self-contained.
            updateLoading("Processing SVG...", "Inlining embedded images");
            await inlineSVGImages(svgDoc);

            // ── Store original raw SVG text for the vector-native warp export ──
            // We save it AFTER inlining so the warp engine has access to the
            // fully self-contained SVG with embedded image data.
            currentSVGRawText = new XMLSerializer().serializeToString(svgDoc);

            let width = svgElement.getAttribute("width");
            let height = svgElement.getAttribute("height");
            const viewBox = svgElement.getAttribute("viewBox");

            if (width) width = parseFloat(width);
            if (height) height = parseFloat(height);

            if ((!width || !height) && viewBox) {
              const vbParts = viewBox.split(/[\s,]+/).map(parseFloat);
              if (vbParts.length === 4) {
                if (!width) width = vbParts[2];
                if (!height) height = vbParts[3];
              }
            }

            // Force high resolution for warping quality
            if (shape && shape.uploadDimensions) {
              // If SVG has dimensions, calculate aspect ratio
              const aspectRatio = (width && height) ? width / height : 
                                 (viewBox ? (() => {
                                   const parts = viewBox.split(/[\s,]+/).map(parseFloat);
                                   return parts.length === 4 ? parts[2] / parts[3] : shape.uploadDimensions.width / shape.uploadDimensions.height;
                                 })() : shape.uploadDimensions.width / shape.uploadDimensions.height);

              // Set width to match upload dimensions for best quality
              width = shape.uploadDimensions.width;
              height = width / aspectRatio; // Maintain aspect ratio
              
              // If the height is less than target, scale by height instead
              if (height < shape.uploadDimensions.height) {
                 height = shape.uploadDimensions.height;
                 width = height * aspectRatio;
              }
            } else {
               // Fallback for no shape selected or no dims
               if (!width || width < 2000) {
                 const aspectRatio = (width && height) ? width / height : 1;
                 width = 2000;
                 height = width / aspectRatio;
               }
            }

            svgElement.setAttribute("width", width);
            svgElement.setAttribute("height", height);
            if (!viewBox) svgElement.setAttribute("viewBox", `0 0 ${width} ${height}`);

            svgText = new XMLSerializer().serializeToString(svgDoc);
            const blob = new Blob([svgText], { type: "image/svg+xml" });
            const url = URL.createObjectURL(blob);

            const img = new Image();
            img.onload = async () => {
              if (shape && shape.uploadDimensions) {
                const expectedWidth = shape.uploadDimensions.width;
                const expectedHeight = shape.uploadDimensions.height;

                if (width < expectedWidth || height < expectedHeight) {
                  hideLoading();
                  showError(
                    "Image Too Small",
                    `The image dimensions (${Math.round(width)} × ${Math.round(height)}px) are smaller than required.\n\nMinimum size: ${expectedWidth} × ${expectedHeight}px`
                  );
                  currentImage = null;
                  currentImageDataUrl = null;
                  textureImageDataUrl = null;
                  currentSVGRawText = null;
                  clearWarpedPreview();
                  fileInput.value = "";
                  updateUploadPlaceholder();
                  URL.revokeObjectURL(url);
                  mainDraw();
                  return;
                }
              }

              const fullName = file.name;
              const dotIndex = fullName.lastIndexOf(".");
              let name = dotIndex !== -1 ? fullName.substring(0, dotIndex) : fullName;
              const ext = dotIndex !== -1 ? fullName.substring(dotIndex) : "";
              if (name.length > 12) name = name.substring(0, 12) + "...";
              uploadText.textContent = `${name}${ext}`;

              await processUploadedImage(img, shape);
            };

            img.onerror = () => {
              URL.revokeObjectURL(url);
              hideLoading();
              showError("Failed to Load SVG", "The SVG file could not be loaded. Please try a different file.");
              currentImage = null;
              currentImageDataUrl = null;
              textureImageDataUrl = null;
              currentSVGRawText = null;
              clearWarpedPreview();
              fileInput.value = "";
              updateUploadPlaceholder();
              mainDraw();
            };

            img.src = url;
          };

          reader.onerror = () => {
            hideLoading();
            showError("File Read Error", "Failed to read the SVG file. Please try again.");
            fileInput.value = "";
            updateUploadPlaceholder();
            mainDraw();
          };

          reader.readAsText(file);
        } else {
          // Non-SVG upload — clear stored SVG source and warped preview
          currentSVGRawText = null;
          clearWarpedPreview();
          const reader = new FileReader();
          reader.onload = async function (e) {
            updateLoading("Processing image...", "Loading pixels");
            
            const img = new Image();
            img.onload = async () => {
              if (shape && shape.uploadDimensions) {
                const expectedWidth = shape.uploadDimensions.width;
                const expectedHeight = shape.uploadDimensions.height;

                if (img.width < expectedWidth || img.height < expectedHeight) {
                  hideLoading();
                  showError(
                    "Image Too Small",
                    `The image dimensions (${img.width} × ${img.height}px) are smaller than required.\n\nMinimum size: ${expectedWidth} × ${expectedHeight}px`
                  );
                  currentImage = null;
                  currentImageDataUrl = null;
                  textureImageDataUrl = null;
                  fileInput.value = "";
                  updateUploadPlaceholder();
                  mainDraw();
                  return;
                }
              }

              const fullName = file.name;
              const dotIndex = fullName.lastIndexOf(".");
              let name = dotIndex !== -1 ? fullName.substring(0, dotIndex) : fullName;
              const ext = dotIndex !== -1 ? fullName.substring(dotIndex) : "";
              if (name.length > 12) name = name.substring(0, 12) + "...";
              uploadText.textContent = `${name}${ext}`;

              await processUploadedImage(img, shape);
            };
            img.onerror = () => {
              hideLoading();
              showError("Failed to Load Image", "The image file could not be loaded. Please try a different file format (PNG, JPG, etc.).");
              currentImage = null;
              currentImageDataUrl = null;
              textureImageDataUrl = null;
              fileInput.value = "";
              updateUploadPlaceholder();
              mainDraw();
            };
            img.src = e.target.result;
          };
          
          reader.onerror = () => {
            hideLoading();
            showError("File Read Error", "Failed to read the image file. Please try again.");
            fileInput.value = "";
            updateUploadPlaceholder();
            mainDraw();
          };
          
          reader.readAsDataURL(file);
        }
      }

      async function handleViewChange(event) {
        const newView = event.target.value;
        currentView = newView;

        if (currentShapeType === "sweet_box" || currentShapeType === "sweet_box_te") {
          const groupName = shapeSelect.value;
          const group = shapeGroups[groupName];
          const newShapeKey = group[newView];

          if (newShapeKey) {
            currentShape = newShapeKey;
            updateUploadPlaceholder();
            currentImage = null;
            currentImageDataUrl = null;
            textureImageDataUrl = null;
            fileInput.value = "";

            const shape = getCurrentShape();
            load3DModel(shape);
            mainDraw();
          }
        }
      }

      async function handleShapeTypeChange(event) {
        currentShapeType = event.target.value;
        toggleViewSelector();
        updateSpecificShapeSelector();
        updateUploadPlaceholder();
        currentImage = null;
        currentImageDataUrl = null;
        textureImageDataUrl = null;
        currentSVGRawText = null;
        clearWarpedPreview();
        fileInput.value = "";
        // Reset zoom and pan when changing shape type
        zoomLevel = 1;
        panX = 0;
        panY = 0;
        updateZoomDisplay();
        mainDraw();
      }

      async function handleShapeChange(event) {
        const selectedValue = event.target.value;

        if (currentShapeType === "sweet_box" || currentShapeType === "sweet_box_te") {
          const group = shapeGroups[selectedValue];
          currentShape = group.top || group.bottom;
        } else {
          currentShape = selectedValue;
        }

        syncSweetBoxViewControls();
        updateUploadPlaceholder();
        currentImage = null;
        currentImageDataUrl = null;
        textureImageDataUrl = null;
        currentSVGRawText = null;
        clearWarpedPreview();
        fileInput.value = "";
        // Reset zoom and pan when changing shape
        zoomLevel = 1;
        panX = 0;
        panY = 0;
        updateZoomDisplay();

        const shape = getCurrentShape();
        load3DModel(shape);
        mainDraw();
      }

      // ========== EXPORT FUNCTIONS ==========

      // Upscale image for better quality export
      function upscaleImage(img, targetWidth, targetHeight) {
        return new Promise((resolve) => {
          const upscaleCanvas = document.createElement("canvas");
          upscaleCanvas.width = targetWidth;
          upscaleCanvas.height = targetHeight;
          const upscaleCtx = upscaleCanvas.getContext("2d");
          
          upscaleCtx.imageSmoothingEnabled = true;
          upscaleCtx.imageSmoothingQuality = "high";
          upscaleCtx.drawImage(img, 0, 0, targetWidth, targetHeight);
          
          const upscaledImg = new Image();
          upscaledImg.onload = () => resolve(upscaledImg);
          upscaledImg.src = upscaleCanvas.toDataURL("image/png", 1.0);
        });
      }

      async function exportPNG() {
        if (isExporting) return;
        
        if (!currentImage) {
          showError("No Image", "Please upload an image first before exporting.");
          return;
        }
        const shape = getCurrentShape();
        if (!shape) {
          showError("No Shape Selected", "Please select a shape before exporting.");
          return;
        }

        isExporting = true;
        showLoading("Exporting PNG...", "Generating high-resolution image");

        await new Promise(r => setTimeout(r, 50));

        try {
          updateLoading("Exporting PNG...", "Upscaling image");
          
          // Upscale the source image if needed
          const targetImgWidth = shape.uploadDimensions ? shape.uploadDimensions.width * 2 : currentImage.width * 2;
          const targetImgHeight = shape.uploadDimensions ? shape.uploadDimensions.height * 2 : currentImage.height * 2;
          
          let processedImage = currentImage;
          if (currentImage.width < targetImgWidth || currentImage.height < targetImgHeight) {
            processedImage = await upscaleImage(currentImage, 
              Math.max(currentImage.width, targetImgWidth), 
              Math.max(currentImage.height, targetImgHeight)
            );
          }
          
          // Temporarily swap currentImage for export
          const originalImage = currentImage;
          currentImage = processedImage;
          
          updateLoading("Exporting PNG...", "Creating canvas");
          
          const exportWidth = shape.width * EXPORT_SCALE;
          const exportHeight = shape.height * EXPORT_SCALE;
          const exportCanvas = document.createElement("canvas");
          exportCanvas.width = exportWidth;
          exportCanvas.height = exportHeight;
          const exportCtx = exportCanvas.getContext("2d", { alpha: true });

          await new Promise(r => setTimeout(r, 50));
          updateLoading("Exporting PNG...", "Rendering image");

          drawShape(exportCtx, exportWidth, exportHeight, true, EXPORT_SCALE, true, false);
          
          // Restore original image
          currentImage = originalImage;

          await new Promise(r => setTimeout(r, 50));
          updateLoading("Exporting PNG...", "Generating file");

          const blob = await new Promise((resolve, reject) => {
            exportCanvas.toBlob(
              (b) => {
                if (b) resolve(b);
                else reject(new Error("Failed to create blob"));
              },
              "image/png",
              1.0
            );
          });

          updateLoading("Exporting PNG...", "Starting download");
          
          await triggerDownload(blob, `${currentShape}_Wrap.png`);
          
          hideLoading();
        } catch (error) {
          console.error("Export error:", error);
          hideLoading();
          showError("Export Failed", "Failed to generate the PNG file. Please try again.");
        }
      }

      function hexToRgb(hex) {
        const h = hex.replace("#", "");
        const bigint = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
        return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
      }

      function rgbToCmyk(r, g, b) {
        const rn = r / 255, gn = g / 255, bn = b / 255;
        const k = 1 - Math.max(rn, gn, bn);
        if (k >= 1) return { c: 0, m: 0, y: 0, k: 1 };
        return { c: (1 - rn - k) / (1 - k), m: (1 - gn - k) / (1 - k), y: (1 - bn - k) / (1 - k), k };
      }

      function hexToCmykPercentString(hex) {
        const rgb = hexToRgb(hex);
        const cmyk = rgbToCmyk(rgb.r, rgb.g, rgb.b);
        const pc = (v) => Math.round(v * 100);
        return `${pc(cmyk.c)}% ${pc(cmyk.m)}% ${pc(cmyk.y)}% ${pc(cmyk.k)}%`;
      }

      // ═══════════════════════════════════════════════════════════════════
      // PAPER.JS SVG ENVELOPE WARP ENGINE v2 — SEGMENT-PRESERVING
      // Warps SVG through shape's bezier envelope by transforming each
      // bezier control point directly, preserving ALL vector structure.
      // NO polyline resampling — curves stay as curves.
      // ═══════════════════════════════════════════════════════════════════

      /** Number formatter */
      function warpF(n) { return parseFloat(n.toFixed(6)); }

      /**
       * Creates a Paper.js path from an SVG path string.
       * Handles both simple paths and compound paths (multiple sub-paths).
       * Returns a paper.Path or paper.CompoundPath, or null on failure.
       */
      function makePaperPath(d) {
        try {
          // Paper.js Path constructor handles simple paths
          const p = new paper.Path(d);
          if (p.segments && p.segments.length > 0) return p;
          p.remove();
        } catch (e) { /* fall through to CompoundPath */ }

        try {
          // Try as CompoundPath for multi-subpath 'd' attributes (e.g. donut shapes)
          const cp = new paper.CompoundPath(d);
          if (cp.children && cp.children.length > 0) return cp;
          cp.remove();
        } catch (e) { /* both failed */ }

        return null;
      }

      /**
       * Envelope transform: maps a point from source SVG coordinate space
       * to the shape's envelope bezier mesh.
       *
       * Uses bilinear (Coons-patch-style) interpolation between the top
       * and bottom edge paths. Each source (u, v) coordinate maps to a
       * position on the shape surface by:
       *   1. Sampling along the top edge at parameter u → topPt
       *   2. Sampling along the bottom edge at parameter u → bottomPt
       *   3. Linearly blending vertically by v
       *
       * @param {number} px  - x in source coordinates
       * @param {number} py  - y in source coordinates
       * @param {paper.Rectangle} srcBounds  - source viewBox rectangle
       * @param {paper.Path} topPaperPath    - evaluated top edge path
       * @param {paper.Path} bottomPaperPath - evaluated bottom edge path
       * @param {boolean} topIsReversed      - whether top edge runs right-to-left at u=0
       * @param {boolean} bottomIsReversed   - whether bottom edge runs right-to-left at u=0
       * @returns {{ x: number, y: number }}
       */
      function envelopeTransformForShape(px, py, srcBounds, topPaperPath, bottomPaperPath, topIsReversed, bottomIsReversed) {
        const u = srcBounds.width > 0  ? Math.max(0, Math.min(1, (px - srcBounds.x) / srcBounds.width))  : 0.5;
        const v = srcBounds.height > 0 ? Math.max(0, Math.min(1, (py - srcBounds.y) / srcBounds.height)) : 0.5;

        const topT   = topIsReversed    ? (1 - u) : u;
        const bottomT = bottomIsReversed ? (1 - u) : u;

        const topOffset    = topT    * topPaperPath.length;
        const bottomOffset = bottomT * bottomPaperPath.length;

        const topPt    = topPaperPath.getPointAt(topOffset)    || topPaperPath.getPointAt(0);
        const bottomPt = bottomPaperPath.getPointAt(bottomOffset) || bottomPaperPath.getPointAt(0);

        if (!topPt || !bottomPt) return { x: px, y: py }; // safety fallback

        return {
          x: topPt.x * (1 - v) + bottomPt.x * v,
          y: topPt.y * (1 - v) + bottomPt.y * v
        };
      }

      /**
       * Transform a single {x,y} point through the envelope.
       * Convenience wrapper that handles edge-case null returns.
       */
      function warpPoint(pt, srcBounds, topPP, bottomPP, topRev, botRev) {
        return envelopeTransformForShape(pt.x, pt.y, srcBounds, topPP, bottomPP, topRev, botRev);
      }

      /**
       * Determine how many subdivisions a straight-line segment needs so
       * the warped result closely follows the curved envelope.
       * 
       * Updated to handle higher precision for "perfect" vector output.
       */
      function adaptiveLineSubdivisions(p0, p1, srcBounds, topPP, bottomPP, topRev, botRev, maxDepth = 8) {
        const wp0 = warpPoint(p0, srcBounds, topPP, bottomPP, topRev, botRev);
        const wp1 = warpPoint(p1, srcBounds, topPP, bottomPP, topRev, botRev);
        const mid = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
        const wMid = warpPoint(mid, srcBounds, topPP, bottomPP, topRev, botRev);
        const linearMid = { x: (wp0.x + wp1.x) / 2, y: (wp0.y + wp1.y) / 2 };
        const deviation = Math.hypot(wMid.x - linearMid.x, wMid.y - linearMid.y);

        // Threshold: 0.1 SVG units — improved perfection for vector paths
        if (deviation < 0.1 || maxDepth <= 0) return 1;

        // Recursively check each half
        const leftSubs  = adaptiveLineSubdivisions(p0, mid, srcBounds, topPP, bottomPP, topRev, botRev, maxDepth - 1);
        const rightSubs = adaptiveLineSubdivisions(mid, p1, srcBounds, topPP, bottomPP, topRev, botRev, maxDepth - 1);
        return leftSubs + rightSubs;
      }

      /**
       * Subdivide a cubic bezier curve at parameter t using de Casteljau's algorithm.
       * Returns two sets of 4 control points: [left4, right4].
       *
       * @param {object} p0 - start anchor {x,y}
       * @param {object} p1 - first control point {x,y}
       * @param {object} p2 - second control point {x,y}
       * @param {object} p3 - end anchor {x,y}
       * @param {number} t  - parameter 0..1
       * @returns {Array} [[lp0,lp1,lp2,lp3], [rp0,rp1,rp2,rp3]]
       */
      function subdivideCubic(p0, p1, p2, p3, t) {
        const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
        const a = lerp(p0, p1, t);
        const b = lerp(p1, p2, t);
        const c = lerp(p2, p3, t);
        const d = lerp(a, b, t);
        const e = lerp(b, c, t);
        const f = lerp(d, e, t);
        return [
          [p0, a, d, f],
          [f, e, c, p3]
        ];
      }

      /**
       * Check if a cubic bezier segment needs subdivision for accurate warping.
       * Samples several points along the bezier and compares the naively-warped
       * control-point bezier against the true warped positions.
       *
       * @returns {number} recommended number of subdivisions (power of 2)
       */
      function adaptiveBezierSubdivisions(p0, cp1, cp2, p3, srcBounds, topPP, bottomPP, topRev, botRev, maxDepth = 6) {
        // Sample the actual bezier at t=0.25, 0.5, 0.75
        const bezierAt = (t) => {
          const mt = 1 - t;
          return {
            x: mt*mt*mt*p0.x + 3*mt*mt*t*cp1.x + 3*mt*t*t*cp2.x + t*t*t*p3.x,
            y: mt*mt*mt*p0.y + 3*mt*mt*t*cp1.y + 3*mt*t*t*cp2.y + t*t*t*p3.y
          };
        };

        // Get true warped positions at test params
        const testTs = [0.25, 0.5, 0.75];
        const wp0  = warpPoint(p0,  srcBounds, topPP, bottomPP, topRev, botRev);
        const wcp1 = warpPoint(cp1, srcBounds, topPP, bottomPP, topRev, botRev);
        const wcp2 = warpPoint(cp2, srcBounds, topPP, bottomPP, topRev, botRev);
        const wp3  = warpPoint(p3,  srcBounds, topPP, bottomPP, topRev, botRev);

        let maxDeviation = 0;
        for (const t of testTs) {
          // Where the warped-control-point bezier thinks the point is
          const mt = 1 - t;
          const warpedBezierPt = {
            x: mt*mt*mt*wp0.x + 3*mt*mt*t*wcp1.x + 3*mt*t*t*wcp2.x + t*t*t*wp3.x,
            y: mt*mt*mt*wp0.y + 3*mt*mt*t*wcp1.y + 3*mt*t*t*wcp2.y + t*t*t*wp3.y
          };
          // Where the point actually should be (warp the true source position)
          const srcPt = bezierAt(t);
          const truePt = warpPoint(srcPt, srcBounds, topPP, bottomPP, topRev, botRev);
          const dev = Math.hypot(warpedBezierPt.x - truePt.x, warpedBezierPt.y - truePt.y);
          if (dev > maxDeviation) maxDeviation = dev;
        }

        // Threshold: 0.1 SVG unit — improved perfection for vector paths
        if (maxDeviation < 0.1 || maxDepth <= 0) return 1;
        return 2; // subdivide once, then recursively re-check
      }

      /**
       * Recursively warp a cubic bezier segment, subdividing as needed
       * for envelope fidelity. Pushes warped segments into the result path.
       *
       * @param {paper.Path} resultPath - path to append warped segments to
       * @param {object} p0  - start point {x,y}
       * @param {object} cp1 - first control point {x,y}
       * @param {object} cp2 - second control point {x,y}
       * @param {object} p3  - end point {x,y}
       * @param {object} srcBounds, topPP, bottomPP, topRev, botRev - envelope params
       * @param {number} depth - current recursion depth
       */
      function warpBezierSegment(resultPath, p0, cp1, cp2, p3, srcBounds, topPP, bottomPP, topRev, botRev, depth) {
        const subs = adaptiveBezierSubdivisions(p0, cp1, cp2, p3, srcBounds, topPP, bottomPP, topRev, botRev, depth);
        if (subs <= 1 || depth <= 0) {
          // Warp control points directly and emit a cubic bezier segment
          const wp0  = warpPoint(p0,  srcBounds, topPP, bottomPP, topRev, botRev);
          const wcp1 = warpPoint(cp1, srcBounds, topPP, bottomPP, topRev, botRev);
          const wcp2 = warpPoint(cp2, srcBounds, topPP, bottomPP, topRev, botRev);
          const wp3  = warpPoint(p3,  srcBounds, topPP, bottomPP, topRev, botRev);

          // Use Paper.js cubicCurveTo
          resultPath.cubicCurveTo(
            new paper.Point(wcp1.x, wcp1.y),
            new paper.Point(wcp2.x, wcp2.y),
            new paper.Point(wp3.x, wp3.y)
          );
        } else {
          // Subdivide at t=0.5 and recurse
          const [left, right] = subdivideCubic(p0, cp1, cp2, p3, 0.5);
          warpBezierSegment(resultPath, left[0], left[1], left[2], left[3], srcBounds, topPP, bottomPP, topRev, botRev, depth - 1);
          warpBezierSegment(resultPath, right[0], right[1], right[2], right[3], srcBounds, topPP, bottomPP, topRev, botRev, depth - 1);
        }
      }

      /**
       * Warp a straight line segment with adaptive subdivision so it follows
       * the curve of the envelope. Emits cubicCurveTo segments into resultPath.
       */
      function warpLineSegment(resultPath, p0, p1, srcBounds, topPP, bottomPP, topRev, botRev, depth = 8) {
        const wp0 = warpPoint(p0, srcBounds, topPP, bottomPP, topRev, botRev);
        const wp1 = warpPoint(p1, srcBounds, topPP, bottomPP, topRev, botRev);
        const mid = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
        const wMid = warpPoint(mid, srcBounds, topPP, bottomPP, topRev, botRev);
        const linearMid = { x: (wp0.x + wp1.x) / 2, y: (wp0.y + wp1.y) / 2 };
        const deviation = Math.hypot(wMid.x - linearMid.x, wMid.y - linearMid.y);

        // Threshold: 0.1 SVG units — improved perfection for vector paths
        if (deviation < 0.1 || depth <= 0) {
          // Approximate this line sub-segment with a cubic bezier to match curvature better
          const scp1 = { x: p0.x + (p1.x - p0.x) / 3, y: p0.y + (p1.y - p0.y) / 3 };
          const scp2 = { x: p0.x + (p1.x - p0.x) * 2 / 3, y: p0.y + (p1.y - p0.y) * 2 / 3 };
          const wcp1 = warpPoint(scp1, srcBounds, topPP, bottomPP, topRev, botRev);
          const wcp2 = warpPoint(scp2, srcBounds, topPP, bottomPP, topRev, botRev);
          
          resultPath.cubicCurveTo(
            new paper.Point(wcp1.x, wcp1.y),
            new paper.Point(wcp2.x, wcp2.y),
            new paper.Point(wp1.x,  wp1.y)
          );
        } else {
          warpLineSegment(resultPath, p0, mid, srcBounds, topPP, bottomPP, topRev, botRev, depth - 1);
          warpLineSegment(resultPath, mid, p1, srcBounds, topPP, bottomPP, topRev, botRev, depth - 1);
        }
      }

      /**
       * Warp a single Paper.js Path (not CompoundPath) through the envelope.
       * Iterates over each segment and preserves the bezier structure.
       *
       * @param {paper.Path} singlePath - a simple Paper.js path
       * @returns {string|null} new SVG 'd' attribute string
       */
      function warpSinglePaperPath(singlePath, srcBounds, topPP, bottomPP, topRev, botRev) {
        if (!singlePath || !singlePath.segments || singlePath.segments.length < 1) return null;

        const segs = singlePath.segments;
        const resultPath = new paper.Path();

        // MOVE TO: warp the first anchor point
        const firstPt = { x: segs[0].point.x, y: segs[0].point.y };
        const wFirst = warpPoint(firstPt, srcBounds, topPP, bottomPP, topRev, botRev);
        resultPath.moveTo(new paper.Point(wFirst.x, wFirst.y));

        // Process each segment pair
        const segCount = singlePath.closed ? segs.length : segs.length - 1;
        for (let i = 0; i < segCount; i++) {
          const seg0 = segs[i];
          const seg1 = segs[(i + 1) % segs.length];

          const p0 = { x: seg0.point.x, y: seg0.point.y };
          const p3 = { x: seg1.point.x, y: seg1.point.y };

          // Paper.js stores handles as offsets from the anchor point
          const handleOut = seg0.handleOut;
          const handleIn  = seg1.handleIn;

          const hasHandles = (handleOut.x !== 0 || handleOut.y !== 0 ||
                              handleIn.x  !== 0 || handleIn.y  !== 0);

          if (hasHandles) {
            // This is a cubic bezier segment
            const cp1 = { x: p0.x + handleOut.x, y: p0.y + handleOut.y };
            const cp2 = { x: p3.x + handleIn.x,  y: p3.y + handleIn.y  };
            warpBezierSegment(resultPath, p0, cp1, cp2, p3, srcBounds, topPP, bottomPP, topRev, botRev, 6);
          } else {
            // Straight line — needs adaptive subdivision for curved envelopes
            warpLineSegment(resultPath, p0, p3, srcBounds, topPP, bottomPP, topRev, botRev);
          }
        }

        if (singlePath.closed) resultPath.closePath();

        // Export the warped path's 'd' string
        const svgEl = resultPath.exportSVG({ asString: false });
        const newD = svgEl.getAttribute("d");
        resultPath.remove();
        return newD;
      }

      /**
       * Warp a Paper.js path (Path or CompoundPath) through the envelope
       * and return the new 'd' string. This is the main entry point.
       *
       * Replaces the old sample-then-smooth approach with direct bezier
       * control point transformation. Every segment's anchors and handles
       * are individually warped, preserving full vector fidelity.
       *
       * For straight-line segments: adaptive subdivision ensures the warped
       * result follows the curved envelope accurately.
       *
       * For bezier segments: recursive subdivision is used only when the
       * naively-warped control points deviate too much from the true
       * warped curve, keeping output compact while staying accurate.
       */
      function warpPaperPath(paperPath, srcBounds, topPP, bottomPP, topRev, botRev, precision, smoothFactor) {
        if (!paperPath) return null;

        // Handle CompoundPath (multiple sub-paths from a single 'd' attribute)
        if (paperPath.className === 'CompoundPath') {
          const subDs = [];
          for (const child of paperPath.children) {
            const subD = warpSinglePaperPath(child, srcBounds, topPP, bottomPP, topRev, botRev);
            if (subD) subDs.push(subD);
          }
          return subDs.length > 0 ? subDs.join(' ') : null;
        }

        // Simple Path
        if (!paperPath.length || !paperPath.segments || paperPath.segments.length < 1) return null;
        return warpSinglePaperPath(paperPath, srcBounds, topPP, bottomPP, topRev, botRev);
      }

      /** Tags whose children we skip entirely during warp */
      const WARP_SKIP_TAGS = new Set([
        "defs","style","script","metadata","title","desc",
        "lineargradient","radialgradient","pattern","filter","clippath",
        "mask","marker","symbol","stop","animate","animatetransform","set",
        "font","font-face","glyph","missing-glyph"
      ]);

      const SHAPE_SKIP_ATTRS = {
        rect:["x","y","width","height","rx","ry"],
        circle:["cx","cy","r"],
        ellipse:["cx","cy","rx","ry"],
        line:["x1","y1","x2","y2"],
        polyline:["points"],
        polygon:["points"]
      };

      function copyAttrs(src, dst, skip = []) {
        for (const attr of Array.from(src.attributes)) {
          if (!skip.includes(attr.name)) dst.setAttribute(attr.name, attr.value);
        }
      }

      // ═══════════════════════════════════════════════════════════════════
      // SVG TRANSFORM FLATTENING — resolves ALL group transforms into
      // absolute element coordinates BEFORE the warp phase runs.
      // Handles: translate, rotate, scale, matrix, skewX, skewY
      // ═══════════════════════════════════════════════════════════════════

      const _IDENTITY_M = [1, 0, 0, 1, 0, 0]; // [a, b, c, d, e, f]

      function _mmul(a, b) {
        return [
          a[0]*b[0]+a[2]*b[1],   a[1]*b[0]+a[3]*b[1],
          a[0]*b[2]+a[2]*b[3],   a[1]*b[2]+a[3]*b[3],
          a[0]*b[4]+a[2]*b[5]+a[4], a[1]*b[4]+a[3]*b[5]+a[5]
        ];
      }

      function _isIdentity(m) {
        return Math.abs(m[0]-1)<1e-6 && Math.abs(m[1])<1e-6 &&
               Math.abs(m[2])<1e-6 && Math.abs(m[3]-1)<1e-6 &&
               Math.abs(m[4])<1e-6 && Math.abs(m[5])<1e-6;
      }

      function _txPt(x, y, m) {
        return { x: m[0]*x + m[2]*y + m[4], y: m[1]*x + m[3]*y + m[5] };
      }

      /** Parse an SVG `transform` attribute string into a 2D affine matrix [a,b,c,d,e,f]. */
      function parseSVGTransform(str) {
        if (!str) return _IDENTITY_M.slice();
        let m = _IDENTITY_M.slice();
        const re = /(translate|scale|rotate|skewX|skewY|matrix)\s*\(([^)]+)\)/gi;
        let match;
        while ((match = re.exec(str)) !== null) {
          const type = match[1].toLowerCase();
          const a = match[2].split(/[\s,]+/).map(Number);
          let t;
          switch (type) {
            case 'matrix':    t = a.slice(0, 6); break;
            case 'translate': t = [1,0,0,1, a[0]||0, a[1]||0]; break;
            case 'scale':     { const sx=a[0]||1, sy=a.length>1?a[1]:sx; t=[sx,0,0,sy,0,0]; break; }
            case 'rotate': {
              const rad = (a[0]||0)*Math.PI/180, c=Math.cos(rad), s=Math.sin(rad);
              if (a.length >= 3) {
                const cx=a[1], cy=a[2];
                t = _mmul([1,0,0,1,cx,cy], _mmul([c,s,-s,c,0,0], [1,0,0,1,-cx,-cy]));
              } else { t = [c,s,-s,c,0,0]; }
              break;
            }
            case 'skewx': t = [1,0,Math.tan((a[0]||0)*Math.PI/180),1,0,0]; break;
            case 'skewy': t = [1,Math.tan((a[0]||0)*Math.PI/180),0,1,0,0]; break;
            default: continue;
          }
          m = _mmul(m, t);
        }
        return m;
      }

      /** Apply a matrix to an SVG path 'd' string via Paper.js. */
      function _applyMatrixToD(d, m) {
        if (!d || _isIdentity(m)) return d;
        try {
          const pp = makePaperPath(d);
          if (!pp) return d;
          const pm = new paper.Matrix(m[0], m[1], m[2], m[3], m[4], m[5]);
          if (pp.className === 'CompoundPath') {
            pp.children.forEach(ch => ch.transform(pm));
          } else {
            pp.transform(pm);
          }
          const el = pp.exportSVG({ asString: false });
          const nd = el.getAttribute("d");
          pp.remove();
          return nd || d;
        } catch(e) { return d; }
      }

      /**
       * Recursively flatten all `transform` attributes in the SVG DOM tree,
       * pushing group transforms down into leaf element coordinates.
       *
       * After this runs, NO element will have a `transform` attribute —
       * all coordinates are in absolute SVG viewport space.
       */
      function flattenSVGTransforms(node, parentMatrix, ns, isRoot = false) {
        if (!node || node.nodeType !== 1) return;
        const tag = (node.tagName || "").toLowerCase();
        if (WARP_SKIP_TAGS.has(tag)) return;

        // Compose this node's local transform with the inherited parent matrix
        const localM = parseSVGTransform(node.getAttribute("transform"));
        let cumM   = _mmul(parentMatrix, localM);

        // Handle nested SVG viewports (x, y, width, height)
        if (tag === "svg" && !isRoot) {
            const x = parseFloat(node.getAttribute("x") || "0");
            const y = parseFloat(node.getAttribute("y") || "0");
            if (x !== 0 || y !== 0) {
                cumM = _mmul(cumM, [1, 0, 0, 1, x, y]);
            }
        }

        // Remove the transform attribute — coordinates will be absolute
        if (node.hasAttribute("transform")) node.removeAttribute("transform");

        // ── GROUPS / CONTAINERS: propagate matrix to children ──────────────
        if (tag === "g" || tag === "a" || tag === "svg") {
          Array.from(node.children).forEach(c => flattenSVGTransforms(c, cumM, ns, false));
          return;
        }

        // If matrix is identity, nothing to transform on leaf elements
        if (_isIdentity(cumM)) {
          // Still recurse into children (e.g. text > tspan)
          Array.from(node.children).forEach(c => flattenSVGTransforms(c, _IDENTITY_M.slice(), ns, false));
          return;
        }

        // ── PATH ───────────────────────────────────────────────────────────
        if (tag === "path") {
          const d = node.getAttribute("d");
          if (d) node.setAttribute("d", _applyMatrixToD(d, cumM));
          return;
        }

        // ── GEOMETRIC SHAPES → convert to <path> with matrix applied ───────
        if (["rect","circle","ellipse","line","polyline","polygon"].includes(tag)) {
          try {
            let pp = null;
            switch (tag) {
              case "rect": {
                const rx = parseFloat(node.getAttribute("rx")||"0");
                const ry = parseFloat(node.getAttribute("ry")||rx);
                pp = new paper.Path.Rectangle({
                  point: [parseFloat(node.getAttribute("x")||"0"), parseFloat(node.getAttribute("y")||"0")],
                  size:  [parseFloat(node.getAttribute("width")||"0"), parseFloat(node.getAttribute("height")||"0")],
                  ...(rx>0||ry>0 ? {radius:[Math.min(rx,parseFloat(node.getAttribute("width")||"0")/2), Math.min(ry,parseFloat(node.getAttribute("height")||"0")/2)]} : {})
                }); break;
              }
              case "circle":  pp = new paper.Path.Circle({center:[parseFloat(node.getAttribute("cx")||"0"),parseFloat(node.getAttribute("cy")||"0")],radius:parseFloat(node.getAttribute("r")||"0")}); break;
              case "ellipse": pp = new paper.Path.Ellipse({center:[parseFloat(node.getAttribute("cx")||"0"),parseFloat(node.getAttribute("cy")||"0")],radius:[parseFloat(node.getAttribute("rx")||"0"),parseFloat(node.getAttribute("ry")||"0")]}); break;
              case "line":    pp = new paper.Path.Line({from:[parseFloat(node.getAttribute("x1")||"0"),parseFloat(node.getAttribute("y1")||"0")],to:[parseFloat(node.getAttribute("x2")||"0"),parseFloat(node.getAttribute("y2")||"0")]}); break;
              case "polyline": case "polygon": {
                const pts = (node.getAttribute("points")||"").trim().split(/[\s,]+/).map(Number);
                const sg = [];
                for (let i=0; i<pts.length; i+=2) sg.push(new paper.Point(pts[i],pts[i+1]));
                pp = new paper.Path(sg);
                if (tag === "polygon") pp.closePath();
                break;
              }
            }
            if (pp) {
              pp.transform(new paper.Matrix(cumM[0],cumM[1],cumM[2],cumM[3],cumM[4],cumM[5]));
              const svgEl = pp.exportSVG({ asString: false });
              const newD = svgEl.getAttribute("d");
              pp.remove();
              if (newD) {
                const pathEl = node.ownerDocument.createElementNS(ns, "path");
                copyAttrs(node, pathEl, [...(SHAPE_SKIP_ATTRS[tag]||[]), "transform"]);
                pathEl.setAttribute("d", newD);
                node.parentNode.replaceChild(pathEl, node);
              }
            }
          } catch(e) { console.warn("flattenSVGTransforms shape:", tag, e); }
          return;
        }

        // ── TEXT / TSPAN ────────────────────────────────────────────────────
        if (tag === "text" || tag === "tspan") {
          const ox = parseFloat(node.getAttribute("x") || "0");
          const oy = parseFloat(node.getAttribute("y") || "0");
          const tp = _txPt(ox, oy, cumM);
          node.setAttribute("x", warpF(tp.x));
          node.setAttribute("y", warpF(tp.y));
          // Decompose rotation/scale and keep as a local transform on the text
          const sx = Math.sqrt(cumM[0]*cumM[0] + cumM[1]*cumM[1]);
          const sy = Math.sqrt(cumM[2]*cumM[2] + cumM[3]*cumM[3]);
          const angle = Math.atan2(cumM[1], cumM[0]) * 180 / Math.PI;
          const parts = [];
          if (Math.abs(angle) > 0.01) parts.push(`rotate(${warpF(angle)},${warpF(tp.x)},${warpF(tp.y)})`);
          if (Math.abs(sx-1) > 0.01 || Math.abs(sy-1) > 0.01) parts.push(`scale(${warpF(sx)},${warpF(sy)})`);
          if (parts.length) node.setAttribute("transform", parts.join(" "));
          // Recurse into tspan children with identity (already resolved)
          Array.from(node.children).forEach(c => flattenSVGTransforms(c, _IDENTITY_M.slice(), ns, false));
          return;
        }

        // ── IMAGE ──────────────────────────────────────────────────────────
        if (tag === "image") {
          const ox = parseFloat(node.getAttribute("x")||"0");
          const oy = parseFloat(node.getAttribute("y")||"0");
          const ow = parseFloat(node.getAttribute("width")||"0");
          const oh = parseFloat(node.getAttribute("height")||"0");
          const c0 = _txPt(ox,    oy,    cumM);
          const c1 = _txPt(ox+ow, oy,    cumM);
          const c2 = _txPt(ox+ow, oy+oh, cumM);
          const c3 = _txPt(ox,    oy+oh, cumM);
          const xs = [c0.x,c1.x,c2.x,c3.x], ys = [c0.y,c1.y,c2.y,c3.y];
          node.setAttribute("x", warpF(Math.min(...xs)));
          node.setAttribute("y", warpF(Math.min(...ys)));
          node.setAttribute("width",  warpF(Math.max(...xs)-Math.min(...xs)));
          node.setAttribute("height", warpF(Math.max(...ys)-Math.min(...ys)));
          return;
        }

        // ── USE ────────────────────────────────────────────────────────────
        if (tag === "use") {
          const ox = parseFloat(node.getAttribute("x")||"0");
          const oy = parseFloat(node.getAttribute("y")||"0");
          const tp = _txPt(ox, oy, cumM);
          node.setAttribute("x", warpF(tp.x));
          node.setAttribute("y", warpF(tp.y));
          return;
        }

        // ── FALLBACK: recurse ──────────────────────────────────────────────
        Array.from(node.children).forEach(c => flattenSVGTransforms(c, cumM, ns, false));
      }

      // ═══════════════════════════════════════════════════════════════════
      // WARP NODE — applies envelope distortion to flattened SVG elements
      // ═══════════════════════════════════════════════════════════════════

      function warpImageEl(el, doc, ns, srcBounds, topPP, bottomPP, topRev, botRev) {
        const x = parseFloat(el.getAttribute("x") || "0");
        const y = parseFloat(el.getAttribute("y") || "0");
        const w = parseFloat(el.getAttribute("width")  || "0");
        const h = parseFloat(el.getAttribute("height") || "0");
        const corners = [
          envelopeTransformForShape(x,   y,   srcBounds, topPP, bottomPP, topRev, botRev),
          envelopeTransformForShape(x+w, y,   srcBounds, topPP, bottomPP, topRev, botRev),
          envelopeTransformForShape(x+w, y+h, srcBounds, topPP, bottomPP, topRev, botRev),
          envelopeTransformForShape(x,   y+h, srcBounds, topPP, bottomPP, topRev, botRev),
        ];
        const xs = corners.map(c => c.x), ys = corners.map(c => c.y);
        const minX = Math.min(...xs), maxX = Math.max(...xs);
        const minY = Math.min(...ys), maxY = Math.max(...ys);

        const XLINK_NS = "http://www.w3.org/1999/xlink";
        const hrefVal = el.getAttribute("href") || el.getAttributeNS(XLINK_NS, "href") || null;

        let defs = doc.querySelector("defs");
        if (!defs) { defs = doc.createElementNS(ns, "defs"); doc.documentElement.insertBefore(defs, doc.documentElement.firstChild); }
        const clipId = "imgClip_" + Math.random().toString(36).slice(2, 9);
        const clipEl = doc.createElementNS(ns, "clipPath");
        clipEl.setAttribute("id", clipId);
        const poly = doc.createElementNS(ns, "polygon");
        poly.setAttribute("points", corners.map(c => `${warpF(c.x)},${warpF(c.y)}`).join(" "));
        clipEl.appendChild(poly);
        defs.appendChild(clipEl);

        el.setAttribute("x",      warpF(minX));
        el.setAttribute("y",      warpF(minY));
        el.setAttribute("width",  warpF(maxX - minX));
        el.setAttribute("height", warpF(maxY - minY));
        el.setAttribute("preserveAspectRatio", "none");
        el.setAttribute("clip-path", `url(#${clipId})`);

        if (hrefVal) {
          el.setAttribute("href", hrefVal);
          el.setAttributeNS(XLINK_NS, "xlink:href", hrefVal);
        }
      }

      function warpNode(node, doc, ns, srcBounds, topPP, bottomPP, topRev, botRev, precision, smoothing) {
        if (!node || node.nodeType !== 1) return;
        const tag = (node.tagName || "").toLowerCase();
        if (WARP_SKIP_TAGS.has(tag)) return;

        // ── PATH (transforms already flattened) ────────────────────────────
        if (tag === "path") {
          const d = node.getAttribute("d");
          if (d) {
            try {
              const pp = makePaperPath(d);
              if (pp) {
                const newD = warpPaperPath(pp, srcBounds, topPP, bottomPP, topRev, botRev, precision, smoothing);
                pp.remove();
                if (newD) node.setAttribute("d", newD);
              }
            } catch(e) { console.warn("warpNode path:", e); }
          }
          return;
        }

        // ── SHAPES (should already be converted to path by flatten, but handle fallback) ──
        if (["rect","circle","ellipse","line","polyline","polygon"].includes(tag)) {
          try {
            let pp = null;
            switch (tag) {
              case "rect": {
                const rx = parseFloat(node.getAttribute("rx")||"0");
                const ry = parseFloat(node.getAttribute("ry")||rx);
                pp = new paper.Path.Rectangle({
                  point: [parseFloat(node.getAttribute("x")||"0"), parseFloat(node.getAttribute("y")||"0")],
                  size:  [parseFloat(node.getAttribute("width")||"0"), parseFloat(node.getAttribute("height")||"0")],
                  ...(rx>0||ry>0?{radius:[Math.min(rx,parseFloat(node.getAttribute("width")||"0")/2),Math.min(ry,parseFloat(node.getAttribute("height")||"0")/2)]}:{})
                }); break;
              }
              case "circle":  pp = new paper.Path.Circle({center:[parseFloat(node.getAttribute("cx")||"0"),parseFloat(node.getAttribute("cy")||"0")],radius:parseFloat(node.getAttribute("r")||"0")}); break;
              case "ellipse": pp = new paper.Path.Ellipse({center:[parseFloat(node.getAttribute("cx")||"0"),parseFloat(node.getAttribute("cy")||"0")],radius:[parseFloat(node.getAttribute("rx")||"0"),parseFloat(node.getAttribute("ry")||"0")]}); break;
              case "line":    pp = new paper.Path.Line({from:[parseFloat(node.getAttribute("x1")||"0"),parseFloat(node.getAttribute("y1")||"0")],to:[parseFloat(node.getAttribute("x2")||"0"),parseFloat(node.getAttribute("y2")||"0")]}); break;
              case "polyline": case "polygon": {
                const pts = (node.getAttribute("points")||"").trim().split(/[\s,]+/).map(Number);
                const segs = [];
                for (let i=0; i<pts.length; i+=2) segs.push(new paper.Point(pts[i],pts[i+1]));
                pp = new paper.Path(segs);
                if (tag === "polygon") pp.closePath();
                break;
              }
            }
            if (pp) {
              const newD = warpPaperPath(pp, srcBounds, topPP, bottomPP, topRev, botRev, precision, smoothing);
              pp.remove();
              if (newD) {
                const pathEl = doc.createElementNS(ns, "path");
                copyAttrs(node, pathEl, SHAPE_SKIP_ATTRS[tag]||[]);
                pathEl.setAttribute("d", newD);
                node.parentNode.replaceChild(pathEl, node);
              }
            }
          } catch(e) { console.warn("warpNode shape:", tag, e); }
          return;
        }

        // ── IMAGE ──────────────────────────────────────────────────────────
        if (tag === "image") {
          warpImageEl(node, doc, ns, srcBounds, topPP, bottomPP, topRev, botRev);
          return;
        }

        // ── TEXT / TSPAN ───────────────────────────────────────────────────
        if (tag === "text" || tag === "tspan") {
          if (node.hasAttribute("x") || node.hasAttribute("y")) {
            const wp = envelopeTransformForShape(
              parseFloat(node.getAttribute("x") || "0"),
              parseFloat(node.getAttribute("y") || "0"),
              srcBounds, topPP, bottomPP, topRev, botRev
            );
            if (node.hasAttribute("x")) node.setAttribute("x", warpF(wp.x));
            if (node.hasAttribute("y")) node.setAttribute("y", warpF(wp.y));
          }
          Array.from(node.children).forEach(c =>
            warpNode(c, doc, ns, srcBounds, topPP, bottomPP, topRev, botRev, precision, smoothing)
          );
          return;
        }

        // ── USE ────────────────────────────────────────────────────────────
        if (tag === "use") {
          const wp = envelopeTransformForShape(
            parseFloat(node.getAttribute("x") || "0"),
            parseFloat(node.getAttribute("y") || "0"),
            srcBounds, topPP, bottomPP, topRev, botRev
          );
          node.setAttribute("x", warpF(wp.x));
          node.setAttribute("y", warpF(wp.y));
          return;
        }

        // ── GROUPS / CONTAINERS (transforms already flattened) ─────────────
        if (tag === "g" || tag === "a" || tag === "svg") {
          Array.from(node.children).forEach(c =>
            warpNode(c, doc, ns, srcBounds, topPP, bottomPP, topRev, botRev, precision, smoothing)
          );
          return;
        }

        // ── FALLBACK ───────────────────────────────────────────────────────
        Array.from(node.children).forEach(c =>
          warpNode(c, doc, ns, srcBounds, topPP, bottomPP, topRev, botRev, precision, smoothing)
        );
      }

      /**
       * Build a warped SVG string from the uploaded SVG source, using the
       * selected shape's topPath / bottomPath as the envelope bezier curves.
       *
       * @param {string} rawSvgText  - Original SVG source text
       * @param {object} shape       - Current shape definition
       * @returns {string|null}      - Warped SVG string, or null on failure
       */
      function buildWarpedSVG(rawSvgText, shape) {
        if (typeof paper === "undefined" || !paper.project) {
          console.warn("Paper.js not available — falling back to raster export");
          return null;
        }

        try {
          const parser   = new DOMParser();
          const doc      = parser.parseFromString(rawSvgText, "image/svg+xml");
          if (doc.querySelector("parsererror")) return null;

          const root = doc.documentElement;
          const ns   = root.getAttribute("xmlns") || "http://www.w3.org/2000/svg";

          // ── Guarantee xlink namespace is declared on the root ────────────
          // XMLSerializer drops xlink:href on <image> elements when the
          // xmlns:xlink declaration is missing from the root element.
          const XLINK_NS = "http://www.w3.org/1999/xlink";
          if (!root.getAttribute("xmlns:xlink")) {
            root.setAttributeNS("http://www.w3.org/2000/xmlns/", "xmlns:xlink", XLINK_NS);
          }

          // ── Determine source coordinate bounds ──────────────────────────
          let srcBounds;
          const vb = root.getAttribute("viewBox");
          if (vb) {
            const parts = vb.trim().split(/[\s,]+/).map(parseFloat);
            if (parts.length >= 4 && parts[2] > 0 && parts[3] > 0)
              srcBounds = new paper.Rectangle(parts[0], parts[1], parts[2], parts[3]);
          }
          if (!srcBounds) {
            const wAttr = root.getAttribute("width");
            const hAttr = root.getAttribute("height");
            if (wAttr && hAttr) {
              srcBounds = new paper.Rectangle(0, 0, parseFloat(wAttr), parseFloat(hAttr));
            } else {
              // Final fallback: Use Paper.js to measure the actual content bounds
              // This handles SVGs with no viewBox/width/height reliably.
              const tempGroup = new paper.Group();
              try {
                paper.project.importSVG(rawSvgText, {
                    expandShapes: true,
                    insert: true,
                    onLoad: (item) => { tempGroup.addChild(item); }
                });
                const bounds = tempGroup.bounds;
                if (bounds.width > 0 && bounds.height > 0) {
                   srcBounds = new paper.Rectangle(bounds.x, bounds.y, bounds.width, bounds.height);
                }
              } catch (e) { console.warn("Bounds measurement failed:", e); }
              
              if (!srcBounds) {
                srcBounds = new paper.Rectangle(0, 0, shape.width, shape.height);
              }
              tempGroup.remove();
            }
          }

          // ── Build Paper.js paths for the top & bottom bezier curves ─────
          paper.project.clear();
          const topPP    = makePaperPath(shape.topPath);
          const bottomPP = makePaperPath(shape.bottomPath);
          // Note: do NOT clear project here — topPP & bottomPP are needed for warping

          if (!topPP || !bottomPP) {
            console.warn("Could not create Paper.js paths for shape envelope");
            return null;
          }

          // ══════════════════════════════════════════════════════════════════
          // PHASE 1: FLATTEN ALL TRANSFORMS
          // Resolve every group/element transform into absolute coordinates
          // so the warp engine sees clean, transform-free elements.
          // ══════════════════════════════════════════════════════════════════
          const drawContent = Array.from(root.children).filter(el =>
            el.tagName && el.tagName.toLowerCase() !== "defs"
          );
          drawContent.forEach(child =>
            flattenSVGTransforms(child, _IDENTITY_M.slice(), ns, true)
          );

          // ── Rewire output viewBox to match shape bounds ──────────────────
          root.setAttribute("viewBox", `0 0 ${shape.width} ${shape.height}`);
          root.setAttribute("width",   shape.width);
          root.setAttribute("height",  shape.height);

          // ── Ensure <defs> exists ─────────────────────────────────────────
          let defs = root.querySelector("defs");
          if (!defs) {
            defs = doc.createElementNS(ns, "defs");
            root.insertBefore(defs, root.firstChild);
          }

          // ── Add shape clip-path ──────────────────────────────────────────
          const clipId   = "envelopeClip_" + Date.now();
          const clipEl   = doc.createElementNS(ns, "clipPath");
          clipEl.setAttribute("id", clipId);
          const clipPath = doc.createElementNS(ns, "path");
          clipPath.setAttribute("d", shape.path);
          clipEl.appendChild(clipPath);
          defs.appendChild(clipEl);

          // ── Wrap all non-defs content in a clipped group ─────────────────
          const drawKids = Array.from(root.children).filter(el => el.tagName.toLowerCase() !== "defs");
          const wrapper  = doc.createElementNS(ns, "g");
          wrapper.setAttribute("clip-path", `url(#${clipId})`);
          wrapper.setAttribute("id", "envelopeWarp");
          drawKids.forEach(k => { root.removeChild(k); wrapper.appendChild(k); });
          root.appendChild(wrapper);

          // ══════════════════════════════════════════════════════════════════
          // PHASE 2: ENVELOPE WARP
          // Transform all flattened coordinates through the shape envelope.
          // ══════════════════════════════════════════════════════════════════
          Array.from(wrapper.children).forEach(child =>
            warpNode(child, doc, ns, srcBounds, topPP, bottomPP,
                     shape.topIsReversed, shape.bottomIsReversed, 2, 0.5)
          );

          // Cleanup Paper.js paths
          topPP.remove();
          bottomPP.remove();
          paper.project.clear();

          // ── Optional shape outline ───────────────────────────────────────
          const outlineEl = doc.createElementNS(ns, "path");
          outlineEl.setAttribute("d", shape.path);
          outlineEl.setAttribute("fill", "none");
          outlineEl.setAttribute("stroke", "none");
          outlineEl.setAttribute("id", "envelopeOutline");
          root.appendChild(outlineEl);

          return new XMLSerializer().serializeToString(doc);

        } catch (err) {
          console.error("buildWarpedSVG failed:", err);
          return null;
        }
      }

      function createSVGString() {
        const shape = getCurrentShape();
        if (!shape) return null;

        // ── VECTOR PATH: source was an SVG file ──────────────────────────
        if (currentImage && currentSVGRawText) {
          const warped = buildWarpedSVG(currentSVGRawText, shape);
          if (warped) return warped;
          // Paper.js unavailable or failed → fall through to raster
        }

        // ── RASTER FALLBACK ───────────────────────────────────────────────
        let svgContent = "";
        if (currentImage) {
          const exportWidth = shape.width * EXPORT_SCALE;
          const exportHeight = shape.height * EXPORT_SCALE;
          const exportCanvas = document.createElement("canvas");
          exportCanvas.width = exportWidth;
          exportCanvas.height = exportHeight;
          const exportCtx = exportCanvas.getContext("2d", { alpha: true });
          
          exportCtx.imageSmoothingEnabled = true;
          exportCtx.imageSmoothingQuality = "high";
          renderImageContent(exportCtx, exportWidth, exportHeight, true, EXPORT_SCALE, true, false);
          const rasterData = exportCanvas.toDataURL("image/png");
          svgContent = `<image x="0" y="0" width="${shape.width}" height="${shape.height}" xlink:href="${rasterData}" preserveAspectRatio="none" image-rendering="auto"
    shape-rendering="geometricPrecision"/>`;
          svgContent += `\n<!-- CMYK-VECTORS-HINT: fill=${hexToCmykPercentString("#eeeeee")} (vectors only) -->`;
        } else {
          svgContent = `<path d="${shape.path}" fill="#eeeeee" data-cmyk-fill="${hexToCmykPercentString("#eeeeee")}" />`;
        }

        return `<?xml version="1.0" encoding="UTF-8"?>\n<svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${shape.width} ${shape.height}" xml:space="preserve">\n${svgContent}\n</svg>`;
      }

      async function exportSVG() {
        if (isExporting) return;
        
        if (!currentImage) {
          showError("No Image", "Please upload an image first before exporting.");
          return;
        }
        const shape = getCurrentShape();
        if (!shape) {
          showError("No Shape Selected", "Please select a shape before exporting.");
          return;
        }
        
        isExporting = true;
        showLoading("Exporting SVG...", "Creating vector file");

        await new Promise(r => setTimeout(r, 50));

        try {
          updateLoading("Exporting SVG...", "Generating content");
          
          const svgString = createSVGString();
          if (!svgString) {
            throw new Error("Failed to create SVG content");
          }

          await new Promise(r => setTimeout(r, 50));
          updateLoading("Exporting SVG...", "Starting download");

          const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
          await triggerDownload(blob, `${currentShape}_Wrap.svg`);
          
          hideLoading();
        } catch (error) {
          console.error("Export error:", error);
          hideLoading();
          showError("Export Failed", "Failed to generate the SVG file. Please try again.");
        }
      }

      // ========== PDF EXPORT (Transparent Background for Adobe Illustrator) ==========
      async function exportPDF() {
        if (isExporting) return;
        
        if (!currentImage) {
          showError("No Image", "Please upload an image first before exporting.");
          return;
        }
        
        const shape = getCurrentShape();
        if (!shape) {
          showError("No Shape Selected", "Please select a shape before exporting.");
          return;
        }
        
        // Check if jsPDF is loaded
        if (typeof window.jspdf === 'undefined') {
          showError("Library Error", "PDF library not loaded. Please refresh the page and try again.");
          return;
        }

        isExporting = true;
        showLoading("Exporting PDF...", "Creating document");

        await new Promise(r => setTimeout(r, 50));

        try {
          const { jsPDF } = window.jspdf;
          
          updateLoading("Exporting PDF...", "Rendering image");
          
          // Create high-resolution canvas with TRANSPARENCY
          const exportWidth = shape.width * EXPORT_SCALE;
          const exportHeight = shape.height * EXPORT_SCALE;
          const exportCanvas = document.createElement("canvas");
          exportCanvas.width = exportWidth;
          exportCanvas.height = exportHeight;
          const exportCtx = exportCanvas.getContext("2d", { alpha: true });
          
          // Clear with transparent background (NO white fill)
          exportCtx.clearRect(0, 0, exportWidth, exportHeight);
          
          // Draw only the shape content (no background)
          renderImageContent(exportCtx, exportWidth, exportHeight, true, EXPORT_SCALE, false, false);

          await new Promise(r => setTimeout(r, 50));
          updateLoading("Exporting PDF...", "Generating PDF");

          // Get image data as PNG to preserve transparency
          const imgData = exportCanvas.toDataURL('image/png');
          
          // Create PDF with exact dimensions
          const pdf = new jsPDF({
            orientation: shape.width > shape.height ? 'landscape' : 'portrait',
            unit: 'pt',
            format: [shape.width, shape.height],
            compress: true
          });
          
          // Add the transparent PNG image
          pdf.addImage(imgData, 'PNG', 0, 0, shape.width, shape.height, undefined, 'FAST');
          
          // Add metadata
          pdf.setProperties({
            title: `${currentShape}_Wrap`,
            subject: 'Label Wrap Export - Transparent Background',
            creator: 'Terra Tech Packs',
            keywords: 'label, wrap, packaging, transparent'
          });

          await new Promise(r => setTimeout(r, 50));
          updateLoading("Exporting PDF...", "Starting download");

          // Save the PDF
          pdf.save(`${currentShape}_Wrap.pdf`);
          
          await new Promise(r => setTimeout(r, 500));
          
          hideLoading();
        } catch (error) {
          console.error("PDF Export error:", error);
          hideLoading();
          showError("Export Failed", "Failed to generate the PDF file. Please try again.");
        }
      }

      // --- Event Listeners ---
      window.addEventListener("resize", debounce(mainDraw, 150));
      fileInput.addEventListener("input", handleImageUpload);
      exportPngBtn.addEventListener("click", exportPNG);
      exportSvgBtn.addEventListener("click", exportSVG);
      exportPdfBtn.addEventListener("click", exportPDF);
      shapeTypeSelect.addEventListener("change", handleShapeTypeChange);
      shapeSelect.addEventListener("change", handleShapeChange);
      document.querySelectorAll('input[name="view_type"]').forEach((radio) => {
        radio.addEventListener("change", handleViewChange);
      });

      // Zoom controls
      zoomInBtn.addEventListener("click", zoomIn);
      zoomOutBtn.addEventListener("click", zoomOut);
      zoomDisplay.addEventListener("click", resetZoom);
      resetPanBtn.addEventListener("click", resetPan);
      canvas.addEventListener("wheel", handleWheelZoom, { passive: false });

      // Pan controls - Mouse
      canvas.addEventListener("mousedown", startPan);
      window.addEventListener("mousemove", doPan);
      window.addEventListener("mouseup", endPan);
      window.addEventListener("mouseleave", endPan);

      // Pan controls - Touch
      canvas.addEventListener("touchstart", handleTouchStart, { passive: false });
      canvas.addEventListener("touchmove", handleTouchMove, { passive: false });
      canvas.addEventListener("touchend", handleTouchEnd);
      canvas.addEventListener("touchcancel", handleTouchEnd);

      // Pan controls - Keyboard (Space)
      window.addEventListener("keydown", handleSpaceDown);
      window.addEventListener("keyup", handleSpaceUp);

      // Handle window blur to reset space state
      window.addEventListener("blur", () => {
        isSpacePressed = false;
        endPan();
        updateCanvasCursor();
      });

      document.addEventListener("keydown", (e) => {
        if (e.ctrlKey || e.metaKey) {
          if (e.key === "p") {
            e.preventDefault();
            exportPNG();
          } else if (e.key === "s") {
            e.preventDefault();
            exportSVG();
          } else if (e.key === "=" || e.key === "+") {
            e.preventDefault();
            zoomIn();
          } else if (e.key === "-") {
            e.preventDefault();
            zoomOut();
          } else if (e.key === "0") {
            e.preventDefault();
            resetZoom();
          }
        }
      });

      const fileUploadLabel = document.querySelector(".file-upload-label");
      fileUploadLabel.addEventListener("dragover", (e) => {
        e.preventDefault();
        fileUploadLabel.classList.add("dragover");
      });
      fileUploadLabel.addEventListener("dragleave", (e) => {
        e.preventDefault();
        fileUploadLabel.classList.remove("dragover");
      });
      fileUploadLabel.addEventListener("drop", (e) => {
        e.preventDefault();
        fileUploadLabel.classList.remove("dragover");
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          fileInput.files = e.dataTransfer.files;
          fileInput.dispatchEvent(new Event("input", { bubbles: true }));
        }
      });

      // --- Initialization ---
      function initializeApp() {
        // Initialise Paper.js with the hidden off-screen canvas
        try {
          const paperCanvas = document.getElementById("paperCanvas");
          if (paperCanvas && typeof paper !== "undefined") {
            paper.setup(paperCanvas);
          }
        } catch (e) {
          console.warn("Paper.js setup failed:", e);
        }

        preProcessShapes();
        populateShapeTypes();
        toggleViewSelector();
        updateSpecificShapeSelector();
        updateUploadPlaceholder();
        updateZoomDisplay();
        mainDraw();
      }

      initializeApp();