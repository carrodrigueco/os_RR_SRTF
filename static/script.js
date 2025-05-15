let number_of_processes = 1;
let simulationData = [];
let currentStepIndex = 0;

function addProcess() {
    const container = document.getElementById("processes");
    const newBox = document.createElement("div");
    number_of_processes += 1;
    newBox.classList.add("process-box");
    newBox.innerHTML = `
        <p class="process_name">Proceso #<span class="number_process">${number_of_processes}</span></p>
        <label>Tiempo CPU: <input type="number" name="cpu_time" required min="1"></label>
        <label>Llegada: <input type="number" name="process_birth" required min="0"></label>
        <label class="priority-label">Prioridad: <input type="number" name="priority" value="0" min="0"></label>
        <button type="button" class="remove-btn" onclick="removeProcess(this)">Eliminar</button>
    `;
    container.appendChild(newBox);
    updateProcessNumbers();
}

function removeProcess(button) {
    const box = button.closest('.process-box');
    if (document.querySelectorAll('.process-box').length > 1) {
        box.remove();
        updateProcessNumbers();
    } else {
        alert("Debe haber al menos un proceso");
    }
}

function updateProcessNumbers() {
    const processBoxes = document.querySelectorAll(".process-box");
    processBoxes.forEach((box, index) => {
        box.querySelector('.number_process').textContent = index + 1;
    });
    number_of_processes = processBoxes.length;
}

async function simulate() {
    const processBoxes = document.querySelectorAll(".process-box");
    const processesData = [];
    let hasErrors = false;
    
    processBoxes.forEach((box, index) => {
        const cpuInput = box.querySelector('input[name="cpu_time"]');
        const birthInput = box.querySelector('input[name="process_birth"]');
        const priorityInput = box.querySelector('input[name="priority"]');
        
        if (!cpuInput.value || !birthInput.value) {
            cpuInput.style.border = "1px solid red";
            birthInput.style.border = "1px solid red";
            hasErrors = true;
            return;
        }
        
        cpuInput.style.border = "";
        birthInput.style.border = "";
        
        processesData.push({
            cpu_time: parseInt(cpuInput.value),
            process_birth: parseInt(birthInput.value),
            priority: parseInt(priorityInput.value) || 0
        });
    });
    
    if (hasErrors) {
        alert("Por favor complete todos los campos requeridos");
        return;
    }
    
    const algorithmSelect = document.getElementById("algorithm-select");
    const selectedAlgorithm = algorithmSelect.value;

    const payload = {
        algorithm: selectedAlgorithm,
        processes: processesData
    };

    try {
        document.getElementById("explanation-content").innerHTML = "<p>Ejecutando simulación...</p>";
        
        const response = await fetch('/simulate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Error HTTP! estado: ${response.status}`);
        }

        simulationData = await response.json();
        console.log("Datos de simulación recibidos:", simulationData);

        if (simulationData && simulationData.length > 0) {
            currentStepIndex = 0;
            displaySimulationStep(currentStepIndex);
            document.getElementById("next-step-button").disabled = false;
            document.getElementById("prev-step-button").disabled = true;
        } else {
            document.getElementById("explanation-content").innerHTML = 
                "<p>La simulación no produjo resultados.</p>";
            document.getElementById("next-step-button").disabled = true;
            document.getElementById("prev-step-button").disabled = true;
        }

    } catch (error) {
        console.error("Error durante la simulación:", error);
        document.getElementById("explanation-content").innerHTML = 
            `<p>Error al ejecutar la simulación: ${error.message}</p>`;
        document.getElementById("next-step-button").disabled = true;
        document.getElementById("prev-step-button").disabled = true;
    }
}

function displaySimulationStep(stepIndex) {
    if (!simulationData || stepIndex < 0 || stepIndex >= simulationData.length) {
        console.error("Índice de paso inválido o sin datos de simulación");
        return;
    }

    const step = simulationData[stepIndex];
    document.getElementById("explanation-content").innerHTML = `<p>${step.explanation}</p>`;
    renderTimeline(step);

    // Actualizar botones de navegación
    document.getElementById("prev-step-button").disabled = stepIndex === 0;
    document.getElementById("next-step-button").disabled = stepIndex === simulationData.length - 1;
}

function renderTimeline(stepData) {
    const svg = document.getElementById("timeline-svg");
    svg.innerHTML = '';

    const svgWidth = svg.clientWidth;
    const svgHeight = svg.clientHeight;
    const margin = { top: 20, right: 20, bottom: 30, left: 40 };
    const drawingWidth = svgWidth - margin.left - margin.right;
    const drawingHeight = svgHeight - margin.top - margin.bottom;

    // Calcular tiempo máximo para la escala
    const maxTime = Math.max(...stepData.processes.map(p => p.positionTime), 10) + 2;

    // Función de escala
    const xScale = (time) => margin.left + (time / maxTime) * drawingWidth;
    const yScale = (index) => margin.top + (index + 0.5) * (drawingHeight / stepData.processes.length);

    // Dibujar línea del timeline
    const timelineLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
    timelineLine.setAttribute("x1", xScale(0));
    timelineLine.setAttribute("y1", margin.top + drawingHeight / 2);
    timelineLine.setAttribute("x2", xScale(maxTime));
    timelineLine.setAttribute("y2", margin.top + drawingHeight / 2);
    timelineLine.classList.add("timeline-line");
    svg.appendChild(timelineLine);

    // Marcas del timeline
    for (let i = 0; i <= maxTime; i++) {
        const xPos = xScale(i);
        
        const tick = document.createElementNS("http://www.w3.org/2000/svg", "line");
        tick.setAttribute("x1", xPos);
        tick.setAttribute("y1", margin.top + drawingHeight / 2 - 5);
        tick.setAttribute("x2", xPos);
        tick.setAttribute("y2", margin.top + drawingHeight / 2 + 5);
        tick.classList.add("timeline-tick");
        svg.appendChild(tick);

        if (i % 2 === 0) {
            const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
            label.setAttribute("x", xPos);
            label.setAttribute("y", margin.top + drawingHeight / 2 + 20);
            label.textContent = i;
            label.classList.add("timeline-label");
            svg.appendChild(label);
        }
    }

    // Dibujar procesos
    stepData.processes.forEach((process, index) => {
        const xPos = xScale(process.positionTime);
        const yPos = yScale(index);

        // Nodo del proceso
        const node = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        node.setAttribute("x", xPos - 20);
        node.setAttribute("y", yPos - 15);
        node.setAttribute("width", 40);
        node.setAttribute("height", 30);
        node.setAttribute("rx", 5);
        node.setAttribute("ry", 5);
        node.classList.add("process-node", `process-state-${process.state}`);
        node.setAttribute("data-process-id", process.id);
        svg.appendChild(node);

        // Texto del proceso
        const nodeText = document.createElementNS("http://www.w3.org/2000/svg", "text");
        nodeText.setAttribute("x", xPos);
        nodeText.setAttribute("y", yPos);
        nodeText.textContent = `P${process.id}`;
        nodeText.classList.add("process-node-text");
        svg.appendChild(nodeText);

        // Tiempo restante (si existe)
        if (process.remaining_time !== undefined && process.remaining_time !== null) {
            const timeText = document.createElementNS("http://www.w3.org/2000/svg", "text");
            timeText.setAttribute("x", xPos);
            timeText.setAttribute("y", yPos + 20);
            timeText.textContent = `${process.remaining_time}u`;
            timeText.classList.add("process-time-text");
            svg.appendChild(timeText);
        }
    });

    // Indicador de tiempo actual
    const currentTimeLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
    currentTimeLine.setAttribute("x1", xScale(stepData.currentTime));
    currentTimeLine.setAttribute("y1", margin.top);
    currentTimeLine.setAttribute("x2", xScale(stepData.currentTime));
    currentTimeLine.setAttribute("y2", margin.top + drawingHeight);
    currentTimeLine.classList.add("current-time-line");
    svg.appendChild(currentTimeLine);
}

function nextStep() {
    if (currentStepIndex < simulationData.length - 1) {
        currentStepIndex++;
        displaySimulationStep(currentStepIndex);
    }
}

function prevStep() {
    if (currentStepIndex > 0) {
        currentStepIndex--;
        displaySimulationStep(currentStepIndex);
    }
}

function searchHistory() {
    window.location.href = "/stadistics";
}

// Event listeners
document.getElementById("next-step-button").addEventListener("click", nextStep);
document.getElementById("prev-step-button").addEventListener("click", prevStep);

window.onload = updateProcessNumbers;

window.addEventListener('resize', () => {
    if (simulationData && simulationData.length > 0) {
        renderTimeline(simulationData[currentStepIndex]);
    }
});