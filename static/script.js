let number_of_processes = 1;
let simulationData = [];
let currentStepIndex = 0;

function addProcess() {
    const container = document.getElementById("processes");
    const newBox = document.createElement("div");
    if (document.querySelectorAll('.process-box').length >= 20) {
        alert("No se pueden agregar más de 20 procesos.");
        return;
    }
    number_of_processes += 1;
    newBox.classList.add("process-box");
    newBox.innerHTML = `
        <p class="process_name">Proceso #<span class="number_process">${number_of_processes}</span></p>
        <label>Tiempo CPU: <input type="number" name="cpu_time" required min="1" value="3"></label>
        <label>Llegada: <input type="number" name="process_birth" required min="0" value="0"></label>
        <button type="button" class="remove-btn" onclick="removeProcess(this)">Eliminar</button>
    `;
    container.appendChild(newBox);
    updateProcessNumbers();
    document.querySelectorAll('.remove-btn').forEach(btn => btn.disabled = false);
}

function removeProcess(button) {
    const box = button.closest('.process-box');
    if (document.querySelectorAll('.process-box').length > 1) {
        box.remove();
        updateProcessNumbers();
        if (document.querySelectorAll('.process-box').length === 1) {
            document.querySelector('.remove-btn').disabled = true;
        }
    }
}

function updateProcessNumbers() {
    const processBoxes = document.querySelectorAll(".process-box");
    processBoxes.forEach((box, index) => {
        box.querySelector('.number_process').textContent = index + 1;
    });
    number_of_processes = processBoxes.length;
    if (processBoxes.length === 1) {
        processBoxes[0].querySelector('.remove-btn').disabled = true;
    } else {
        processBoxes.forEach(box => box.querySelector('.remove-btn').disabled = false);
    }
}

async function simulate() {
    const processBoxes = document.querySelectorAll(".process-box");

    if (processBoxes.length < 3 || processBoxes.length > 20) {
        alert("El número de procesos debe estar entre 3 y 20.");
        return;
    }

    const processesData = [];
    let hasErrors = false;

    processBoxes.forEach((box, index) => {
        const cpuInput = box.querySelector('input[name="cpu_time"]');
        const birthInput = box.querySelector('input[name="process_birth"]');

        if (!cpuInput.value || !birthInput.value) {
            cpuInput.style.border = "1px solid red";
            birthInput.style.border = "1px solid red";
            hasErrors = true;
        } else {
            cpuInput.style.border = "";
            birthInput.style.border = "";
        }

        const cpuTime = parseInt(cpuInput.value);
        const birthTime = parseInt(birthInput.value);

        if (isNaN(cpuTime) || cpuTime < 1 || isNaN(birthTime) || birthTime < 0) {
            alert(`Valores inválidos para Proceso #${index + 1}. Tiempo CPU debe ser >= 1, Llegada >= 0.`);
            hasErrors = true;
        }

        processesData.push({
            id: index + 1,
            cpu_time: cpuTime,
            process_birth: birthTime
        });
    });

    if (hasErrors) {
        return;
    }

    const quantumInput = document.querySelector('input[name="quantum"]');
    const quantum = parseInt(quantumInput.value);

    if (isNaN(quantum) || quantum < 1 || quantum > 4) {
        alert("El valor de QUANTUM debe ser un número entre 1 y 4.");
        quantumInput.style.border = "1px solid red";
        return;
    } else {
        quantumInput.style.border = "";
    }

    const payload = {
        processes: processesData,
        quantum: quantum
    };

    console.log("Sending data to server:", JSON.stringify(payload));

    try {
        document.getElementById("explanation-content").innerHTML = "<p>Ejecutando simulación...</p>";
        document.getElementById('rr-timeline-svg').innerHTML = '';
        document.getElementById('strf-timeline-svg').innerHTML = '';

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

        const responseData = await response.json();
        console.log("Datos de simulación recibidos:", responseData);

        if (responseData && Array.isArray(responseData.steps) && responseData.steps.length > 0) {
            simulationData = responseData.steps;
            currentStepIndex = 0;
            // Pasar los datos iniciales de procesos para ayudar a determinar si un proceso está terminado
            displaySimulationStep(currentStepIndex, processesData);
            document.getElementById("prev-step-button").disabled = true;
            document.getElementById("next-step-button").disabled = false;
        } else {
            document.getElementById("explanation-content").innerHTML =
                `<p>La simulación no produjo resultados válidos o la estructura de datos es incorrecta.</p>`;
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

// Modificar displaySimulationStep para aceptar los datos iniciales de los procesos
function displaySimulationStep(stepIndex, initialProcesses = []) {
    if (!simulationData || stepIndex < 0 || stepIndex >= simulationData.length) {
        console.error("Índice de paso inválido o sin datos de simulación.");
        return;
    }

    const step = simulationData[stepIndex];
    console.log(`Mostrando paso ${stepIndex}:`, step);

    if (!step.rr_data || !step.strf_data) {
        console.error("Datos de simulación incompletos para el paso", stepIndex, step);
        document.getElementById("explanation-content").innerHTML = `<p>Datos de simulación incompletos para este paso.</p>`;
        return;
    }

    // Determinar procesos completados en este paso para RR y STRF
    const completedRR = new Set();
    const completedSTRF = new Set();

    // Acceder a remaining_times_history para el estado al inicio de este paso
    const rrRemaining = step.rr_data.remaining_times_history ? step.rr_data.remaining_times_history[step.currentTime] : {};
    const strfRemaining = step.strf_data.remaining_times_history ? step.strf_data.remaining_times_history[step.currentTime] : {};

    // También podemos verificar el estado después de ejecutar en este paso si hay un proceso
    const rrProcess = step.rr_data.process;
    const strfProcess = step.strf_data.process;

     // Una forma más fiable es comprobar los remaining_times_history en el siguiente paso si existe,
     // o si estamos en el último paso, ver el estado final en el último remaining_times_history entry.
    const nextStep = simulationData[stepIndex + 1];
    let rrRemainingAfterStep = null;
    let strfRemainingAfterStep = null;

    if (nextStep && nextStep.rr_data.remaining_times_history && nextStep.rr_data.remaining_times_history[nextStep.currentTime]) {
         rrRemainingAfterStep = nextStep.rr_data.remaining_times_history[nextStep.currentTime];
    } else if (stepIndex === simulationData.length - 1 && step.rr_data.remaining_times_history) {
         const lastTime = Math.max(...Object.keys(step.rr_data.remaining_times_history).map(Number));
         if (step.currentTime >= lastTime) { // Asegurarse de que estamos en o después del último estado registrado
             rrRemainingAfterStep = step.rr_data.remaining_times_history[lastTime];
         }
    }

     if (nextStep && nextStep.strf_data.remaining_times_history && nextStep.strf_data.remaining_times_history[nextStep.currentTime]) {
         strfRemainingAfterStep = nextStep.strf_data.remaining_times_history[nextStep.currentTime];
    } else if (stepIndex === simulationData.length - 1 && step.strf_data.remaining_times_history) {
        const lastTime = Math.max(...Object.keys(step.strf_data.remaining_times_history).map(Number));
         if (step.currentTime >= lastTime) { // Asegurarse de que estamos en o después del último estado registrado
             strfRemainingAfterStep = step.strf_data.remaining_times_history[lastTime];
         }
    }


    if (rrRemainingAfterStep) {
         for (const pid in rrRemainingAfterStep) {
             if (rrRemainingAfterStep[pid] <= 0) {
                 completedRR.add(parseInt(pid));
             }
         }
    } else { // Fallback si no hay remaining_times_history después del paso (ej. paso final)
         // Intentar inferir de timeline y el estado ANTES del paso si no hay estado DESPUES
         const currentRRTimeline = step.rr_data.timeline.filter(item => item[0] === step.currentTime);
         if (currentRRTimeline.length > 0 && rrRemaining && rrRemaining[rrProcess] !== undefined && rrRemaining[rrProcess] <= 1) {
             completedRR.add(rrProcess);
         }
    }

    if (strfRemainingAfterStep) {
         for (const pid in strfRemainingAfterStep) {
             if (strfRemainingAfterStep[pid] <= 0) {
                 completedSTRF.add(parseInt(pid));
             }
         }
    } else { // Fallback
         const currentSTRFTimeline = step.strf_data.timeline.filter(item => item[0] === step.currentTime);
          if (currentSTRFTimeline.length > 0 && strfRemaining && strfRemaining[strfProcess] !== undefined && strfRemaining[strfProcess] <= 1) {
             completedSTRF.add(strfProcess);
          }
    }


    // Pasar conjuntos de procesos completados a renderTimeline
    renderTimeline('Round Robin', step.rr_data, 'rr-timeline-svg', step.currentTime, completedRR);
    renderTimeline('STRF', step.strf_data, 'strf-timeline-svg', step.currentTime, completedSTRF);

    const explanationContent = document.getElementById("explanation-content");

    let explanationHTML = `
        <h4>Paso ${stepIndex + 1}: Tiempo ${step.currentTime || 0} unidades</h4>
        <p>${step.explanation || 'No hay explicación disponible para este paso.'}</p>
        <div class="algorithm-details">
            <div class="rr-details">
                <h5>Round Robin:</h5>
                <p>Proceso en ejecución: <strong>${step.rr_data.process ? `P${step.rr_data.process}` : 'Ninguno'}</strong></p>
                <p>Tiempo restante del proceso: <strong>${step.rr_data.remaining_time !== undefined ? step.rr_data.remaining_time : 'N/A'}</strong></p>
            </div>
            <div class="strf-details">
                <h5>STRF:</h5>
                <p>Proceso en ejecución: <strong>${step.strf_data.process ? `P${step.strf_data.process}` : 'Ninguno'}</strong></p>
                <p>Tiempo restante del proceso: <strong>${step.strf_data.remaining_time !== undefined ? step.strf_data.remaining_time : 'N/A'}</strong></p>
            </div>
        </div>
    `;

    if (step.final_summary) {
        const rr_results = step.final_summary.RR;
        const strf_results = step.final_summary.STRF;
        const comparison = step.final_summary.comparison;

        explanationHTML += `
            <div class="final-summary">
                <h4>Resultados Finales de la Simulación</h4>
                <table>
                    <thead>
                        <tr>
                            <th>Algoritmo</th>
                            <th>Tiempo Promedio</th>
                            <th>Tiempo Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Round Robin (RR)</td>
                            <td>${rr_results.average_time !== undefined ? rr_results.average_time : 'N/A'} unidades</td>
                            <td>${rr_results.end_time !== undefined ? rr_results.end_time : 'N/A'} unidades</td>
                        </tr>
                        <tr>
                            <td>STRF</td>
                            <td>${strf_results.average_time !== undefined ? strf_results.average_time : 'N/A'} unidades</td>
                            <td>${strf_results.end_time !== undefined ? strf_results.end_time : 'N/A'} unidades</td>
                        </tr>
                    </tbody>
                </table>
                <div class="comparison-result">
                    <h5>Conclusión:</h5>
                    <p>${comparison || 'No hay resultado de comparación disponible.'}</p>
                </div>
            </div>
        `;
    }

    explanationContent.innerHTML = explanationHTML;

    document.getElementById("prev-step-button").disabled = stepIndex === 0;
    document.getElementById("next-step-button").disabled = stepIndex === simulationData.length - 1;
}

// Modificar renderTimeline para aceptar el conjunto de procesos completados
function renderTimeline(algorithmName, stepAlgorithmData, svgId, currentTime, completedProcesses = new Set()) {
    const svg = document.getElementById(svgId);
    svg.innerHTML = '';

    const svgWidth = svg.clientWidth;
    const svgHeight = svg.clientHeight;
    const margin = { top: 30, right: 20, bottom: 40, left: 60 };
    const drawingWidth = svgWidth - margin.left - margin.right;
    const drawingHeight = svgHeight - margin.top - margin.bottom;

    const timeline = stepAlgorithmData && stepAlgorithmData.timeline ? stepAlgorithmData.timeline : [];
    const maxTime = Math.max(currentTime + 5, 10); // Asegurar que la línea de tiempo tenga un tamaño mínimo
    const xScale = (time) => margin.left + (time / maxTime) * drawingWidth;

    // Obtener IDs de procesos presentes en la línea de tiempo actual y ordenarlos
    const processIdsInStep = [...new Set(timeline.map(([time, processId]) => processId))].sort((a, b) => a - b);
    // Incluir procesos que existen pero no han llegado aún, si es necesario visualizarlos.
    // Por ahora, solo incluiremos los que están en la timeline del paso actual.
    const numberOfProcessesToShow = processIdsInStep.length > 0 ? processIdsInStep.length : 1;

    const processIdToIndex = {};
    processIdsInStep.forEach((id, index) => {
        processIdToIndex[id] = index;
    });
    const yScale = (processId) => {
        const processIndex = processIdToIndex[processId];
        return margin.top + (processIndex + 0.5) * (drawingHeight / numberOfProcessesToShow);
    }

    // Dibujar línea principal de la línea de tiempo
    const timelineLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
    timelineLine.setAttribute("x1", xScale(0));
    timelineLine.setAttribute("y1", margin.top + drawingHeight / 2); // Centrar verticalmente si hay procesos
    timelineLine.setAttribute("x2", xScale(maxTime));
    timelineLine.setAttribute("y2", margin.top + drawingHeight / 2); // Centrar verticalmente si hay procesos
    timelineLine.classList.add("timeline-line");
    svg.appendChild(timelineLine);

    // Dibujar marcas y etiquetas de tiempo
    for (let i = 0; i <= maxTime; i++) {
        const xPos = xScale(i);

        const tick = document.createElementNS("http://www.w3.org/2000/svg", "line");
        tick.setAttribute("x1", xPos);
        tick.setAttribute("y1", margin.top + drawingHeight / 2 - 5); // Ajustar posición del tick
        tick.setAttribute("x2", xPos);
        tick.setAttribute("y2", margin.top + drawingHeight / 2 + 5); // Ajustar posición del tick
        tick.classList.add("timeline-tick");
        svg.appendChild(tick);

        if (i % 2 === 0 || i === currentTime || i === maxTime) {
            const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
            label.setAttribute("x", xPos);
            label.setAttribute("y", margin.top + drawingHeight / 2 + 25); // Ajustar posición de la etiqueta
            label.textContent = i;
            label.classList.add("timeline-label");
            svg.appendChild(label);
        }
    }

    // Agrupar segmentos de línea de tiempo por proceso
    const processSegments = {};
    timeline.forEach(([time, processId]) => {
        if (!processSegments[processId]) {
            processSegments[processId] = [];
        }
        processSegments[processId].push(time);
    });

    // Dibujar segmentos de procesos y etiquetas
    Object.entries(processSegments).forEach(([processIdStr, times]) => {
        const processId = parseInt(processIdStr);
         // Solo dibujar si el proceso está en la lista de IDs a mostrar en este paso
        if (processIdsInStep.includes(processId)) {
            const yPos = yScale(processId);

            // Etiqueta del proceso
            const processLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
            processLabel.setAttribute("x", margin.left - 10);
            processLabel.setAttribute("y", yPos);
            processLabel.textContent = `P${processId}`;
            processLabel.classList.add("process-label");
            processLabel.setAttribute("text-anchor", "end");
            processLabel.setAttribute("dominant-baseline", "middle");
            svg.appendChild(processLabel);

            times.sort((a, b) => a - b);

            // Dibujar segmentos continuos de ejecución
            let segmentStart = times[0];
            for (let i = 1; i < times.length; i++) {
                if (times[i] !== times[i-1] + 1) {
                    const segment = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                    segment.setAttribute("x", xScale(segmentStart));
                    segment.setAttribute("y", yPos - 10); // Altura del segmento
                    segment.setAttribute("width", xScale(times[i-1] + 1) - xScale(segmentStart));
                    segment.setAttribute("height", 20); // Altura del segmento
                    segment.classList.add("process-segment");
                     // Marcar como completado si el proceso terminó en este paso
                    if (completedProcesses.has(processId) && times[i-1] === currentTime) {
                         segment.classList.add("completed");
                    } else if (stepAlgorithmData.process === processId && times[i-1] === currentTime) {
                        segment.classList.add("is-running");
                    }
                    svg.appendChild(segment);
                    segmentStart = times[i];
                }
            }
            // Dibujar el último segmento continuo
            const segment = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            segment.setAttribute("x", xScale(segmentStart));
            segment.setAttribute("y", yPos - 10); // Altura del segmento
            segment.setAttribute("width", xScale(times[times.length - 1] + 1) - xScale(segmentStart));
            segment.setAttribute("height", 20); // Altura del segmento
            segment.classList.add("process-segment");
             // Marcar como completado si el proceso terminó en este paso
            if (completedProcesses.has(processId) && times[times.length - 1] === currentTime) {
                 segment.classList.add("completed");
            } else if (stepAlgorithmData.process === processId && times[times.length - 1] === currentTime) {
                segment.classList.add("is-running");
            }
            svg.appendChild(segment);

            // Indicador de proceso actual (si aplica a este paso y algoritmo)
            if (stepAlgorithmData.process === processId) {
                const currentNode = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                currentNode.setAttribute("cx", xScale(currentTime + 0.5));
                currentNode.setAttribute("cy", yPos);
                currentNode.setAttribute("r", 8);
                currentNode.classList.add("current-process-indicator");
                 // Añadir un estilo para el indicador del proceso en ejecución si es necesario
                svg.appendChild(currentNode);
            }
        }
    });

    // Línea indicadora del tiempo actual
    const currentTimeLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
    currentTimeLine.setAttribute("x1", xScale(currentTime + 0.5));
    currentTimeLine.setAttribute("y1", margin.top);
    currentTimeLine.setAttribute("x2", xScale(currentTime + 0.5));
    currentTimeLine.setAttribute("y2", svgHeight - margin.bottom); // Extender hasta el final del área de dibujo
    currentTimeLine.classList.add("current-time-line");
    svg.appendChild(currentTimeLine);

    // Título del algoritmo
    const algoTitle = document.createElementNS("http://www.w3.org/2000/svg", "text");
    algoTitle.setAttribute("x", svgWidth / 2);
    algoTitle.setAttribute("y", 20);
    algoTitle.textContent = algorithmName;
    algoTitle.classList.add("algorithm-title"); // Asegúrate de tener estilos para .algorithm-title en tu CSS
    algoTitle.setAttribute("text-anchor", "middle");
    svg.appendChild(algoTitle);
}


function nextStep() {
    if (currentStepIndex < simulationData.length - 1) {
        currentStepIndex++;
        displaySimulationStep(currentStepIndex); // No necesitamos pasar processesData aquí nuevamente
    }
}

function prevStep() {
    if (currentStepIndex > 0) {
        currentStepIndex--;
        displaySimulationStep(currentStepIndex); // No necesitamos pasar processesData aquí nuevamente
    }
}

function searchHistory() {
    window.location.href = "/stadistics";
}

document.getElementById("next-step-button").addEventListener("click", nextStep);
document.getElementById("prev-step-button").addEventListener("click", prevStep);

window.onload = () => {
    updateProcessNumbers();
    if (document.querySelectorAll('.process-box').length === 1) {
        document.querySelector('.remove-btn').disabled = true;
    }
};

window.addEventListener('resize', () => {
    if (simulationData && simulationData.length > 0) {
        displaySimulationStep(currentStepIndex); // Al redimensionar, refrescar la visualización con los datos actuales
    }
});