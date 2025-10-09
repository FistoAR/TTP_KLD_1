// Set up PDF.js worker
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

        const viewer = document.getElementById('viewer');

        // Display message
        function showMessage(text, type = '') {
            viewer.innerHTML = `<div class="message ${type}">${text}</div>`;
        }

        // Load and display AI file using PDF.js
        async function loadAIFile(filePath) {
            try {
                showMessage('Loading ' + filePath + '...', 'loading');
                
                // Read the AI file using window.fs.readFile
                const fileData = await window.fs.readFile(filePath);
                
                // Convert to Uint8Array for PDF.js
                const uint8Array = new Uint8Array(fileData);
                
                // Load PDF using PDF.js
                const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
                const pdf = await loadingTask.promise;
                
                // Clear viewer
                viewer.innerHTML = '';
                
                // Render all pages
                for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                    const page = await pdf.getPage(pageNum);
                    
                    // Create canvas for this page
                    const canvas = document.createElement('canvas');
                    canvas.className = 'pdf-page';
                    const context = canvas.getContext('2d');
                    
                    // Set scale for better quality
                    const viewport = page.getViewport({ scale: 2.0 });
                    canvas.height = viewport.height;
                    canvas.width = viewport.width;
                    
                    // Render page
                    const renderContext = {
                        canvasContext: context,
                        viewport: viewport
                    };
                    
                    await page.render(renderContext).promise;
                    viewer.appendChild(canvas);
                }
                
            } catch (error) {
                console.error('Error loading AI file:', error);
                showMessage(
                    `Error loading file: ${error.message}<br><br>` +
                    'Make sure the AI file exists at the specified path.',
                    'error'
                );
            }
        }

        // Event listeners
        document.getElementById('diagramType').addEventListener('change', function() {
            // Only load file if 500ml Round TUB is selected
            if (this.value === 'curveRectangle500') {
                loadAIFile('./assets/sample.ai');
            } else {
                showMessage('No file configured for this option', '');
            }
        });

        // Load initial file on page load (500ml Round TUB)
        window.addEventListener('load', () => {
            const diagramType = document.getElementById('diagramType').value;
            if (diagramType === 'curveRectangle500') {
                loadAIFile('./assets/500ml_Tub.ai');
            }
        });