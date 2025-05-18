let number_of_processes = 1;
let simulationData = []; // Almacena los pasos de la simulación combinada
let currentStepIndex = 0;

// Función para agregar un nuevo proceso al formulario
function addProcess() {
    const container = document.getElementById("processes");
    const newBox = document.createElement("div");
    // Validar el número máximo de procesos antes de agregar
    if (document.querySelectorAll('.process-box').length >= 20) {
        alert("No se pueden agregar más de 20 procesos.");
        return;
    }
    number_of_processes += 1;
    newBox.classList.add("process-box");
    // Usar template literals para insertar HTML de forma más limpia
    newBox.innerHTML = `
        <p class="process_name">Proceso #<span class="number_process">${number_of_processes}</span></p>
        <label>Tiempo CPU: <input type="number" name="cpu_time" required min="1" value="3"></label>
        <label>Llegada: <input type="number" name="process_birth" required min="0" value="0"></label>
        <label class="priority-label">Prioridad: <input type="number" name="priority" value="0" min="0"></label>
        <button type="button" class="remove-btn" onclick="removeProcess(this)">Eliminar</button>
    `;
    container.appendChild(newBox);
    updateProcessNumbers();
    // Habilitar botón de eliminar si hay más de un proceso
    document.querySelectorAll('.remove-btn').forEach(btn => btn.disabled = false);
}

// Función para eliminar un proceso
function removeProcess(button) {
    const box = button.closest('.process-box');
    if (document.querySelectorAll('.process-box').length > 1) {
        box.remove();
        updateProcessNumbers();
        // Deshabilitar botón de eliminar si solo queda un proceso
        if (document.querySelectorAll('.process-box').length === 1) {
            document.querySelector('.remove-btn').disabled = true;
        }
    } else {
        // Este alert ya no debería ser necesario si el botón se deshabilita
        // alert("Debe haber al menos un proceso");
    }
}

// Función para actualizar los números mostrados en cada caja de proceso
function updateProcessNumbers() {
    const processBoxes = document.querySelectorAll(".process-box");
    processBoxes.forEach((box, index) => {
        box.querySelector('.number_process').textContent = index + 1;
    });
    number_of_processes = processBoxes.length;
     // Asegurarse de que el primer proceso no se pueda eliminar
     if (processBoxes.length === 1) {
        processBoxes[0].querySelector('.remove-btn').disabled = true;
    } else {
         processBoxes.forEach(box => box.querySelector('.remove-btn').disabled = false);
    }
}

// Función para iniciar la simulación
async function simulate() {
    const processBoxes = document.querySelectorAll(".process-box");

    // Validar número de procesos (entre 3 y 20)
    if (processBoxes.length < 3 || processBoxes.length > 20) {
        alert("El número de procesos debe estar entre 3 y 20.");
        return;
    }

    const processesData = [];
    let hasErrors = false;

    processBoxes.forEach((box, index) => {
        const cpuInput = box.querySelector('input[name="cpu_time"]');
        const birthInput = box.querySelector('input[name="process_birth"]');
        const priorityInput = box.querySelector('input[name="priority"]');

        // Validar que los campos requeridos tengan valor
        if (!cpuInput.value || !birthInput.value) {
            cpuInput.style.border = "1px solid red";
            birthInput.style.border = "1px solid red";
            hasErrors = true;
            // No retornar aquí, para que se validen todos los campos
        } else {
             cpuInput.style.border = ""; // Restaurar borde si es válido
             birthInput.style.border = ""; // Restaurar borde si es válido
        }

         // Validar que los valores sean números positivos o cero para llegada y prioridad, y >= 1 para CPU
        const cpuTime = parseInt(cpuInput.value);
        const birthTime = parseInt(birthInput.value);
        const priority = parseInt(priorityInput.value);

        if (isNaN(cpuTime) || cpuTime < 1 || isNaN(birthTime) || birthTime < 0 || isNaN(priority) || priority < 0) {
             alert(`Valores inválidos para Proceso #${index + 1}. Tiempo CPU debe ser >= 1, Llegada y Prioridad >= 0.`);
             hasErrors = true;
             // No retornar aquí, para que se validen todos los campos
        }


        processesData.push({
            // Usar 'id' en el frontend para enviar al backend
            id: index + 1, // Asignar ID basado en el orden del formulario
            cpu_time: cpuTime,
            process_birth: birthTime,
            priority: priority
        });
    });

    if (hasErrors) {
        // El alert específico ya se mostró dentro del forEach si hubo valores inválidos
        // Si solo faltaban campos, mostramos este alert general
        // Ya no necesitamos este alert general si la validación de NaN/negativos es suficiente
        // if (processesData.length !== processBoxes.length) {
        //      alert("Por favor complete todos los campos requeridos con valores válidos.");
        // }
        return;
    }

     // Obtener el valor del quantum
    const quantumInput = document.querySelector('input[name="quantum"]');
    const quantum = parseInt(quantumInput.value);

    // Validar el valor del quantum
    if (isNaN(quantum) || quantum < 1 || quantum > 4) {
        alert("El valor de QUANTUM debe ser un número entre 1 y 4.");
        quantumInput.style.border = "1px solid red";
        return;
    } else {
         quantumInput.style.border = ""; // Restaurar borde si es válido
    }

    // No necesitamos seleccionar un algoritmo aquí, ya que simulamos ambos
    // const algorithmSelect = document.getElementById("algorithm-select");
    // const selectedAlgorithm = algorithmSelect.value;

    const payload = {
        // Ya no enviamos un solo algoritmo, el backend simula ambos
        // algorithm: selectedAlgorithm,
        processes: processesData, // Frontend envía procesos con clave 'id'
        quantum: quantum // Enviar el valor del quantum al backend
    };

    console.log("Sending data to server:", JSON.stringify(payload));

    try {
        document.getElementById("explanation-content").innerHTML = "<p>Ejecutando simulación...</p>";
        // Limpiar SVGs anteriores mientras se espera la respuesta
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

        // La respuesta del backend ahora debe contener los pasos para ambos algoritmos en responseData.steps
        const responseData = await response.json();
        console.log("Datos de simulación recibidos:", responseData);

        // Asumiendo que responseData tiene una clave 'steps' que es un array
        if (responseData && Array.isArray(responseData.steps) && responseData.steps.length > 0) {
            simulationData = responseData.steps;
            currentStepIndex = 0;
            displaySimulationStep(currentStepIndex); // Mostrar el primer paso
            // Habilitar botones de control de pasos
            document.getElementById("prev-step-button").disabled = true; // Deshabilitar 'Anterior' al inicio
            document.getElementById("next-step-button").disabled = false;
        } else {
            document.getElementById("explanation-content").innerHTML =
                `<p>La simulación no produjo resultados válidos o la estructura de datos es incorrecta.</p>`;
            // Deshabilitar botones si no hay datos
            document.getElementById("next-step-button").disabled = true;
            document.getElementById("prev-step-button").disabled = true;
        }

    } catch (error) {
        console.error("Error durante la simulación:", error);
        document.getElementById("explanation-content").innerHTML =
            `<p>Error al ejecutar la simulación: ${error.message}</p>`;
        // Deshabilitar botones en caso de error
        document.getElementById("next-step-button").disabled = true;
        document.getElementById("prev-step-button").disabled = true;
    }
}

// Función para mostrar un paso específico de la simulación
function displaySimulationStep(stepIndex) {
    // Validar el índice del paso
    if (!simulationData || stepIndex < 0 || stepIndex >= simulationData.length) {
        console.error("Índice de paso inválido o sin datos de simulación.");
        return;
    }

    const step = simulationData[stepIndex];
    console.log(`Mostrando paso ${stepIndex}:`, step);

    // Asegurarse de que step contenga los datos esperados para RR y STRF
    // Aunque la visualización del timeline solo necesita 'timeline', la explicación
    // puede necesitar 'process' y 'remaining_time'.
    if (!step.rr_data || !step.strf_data) {
        console.error("Datos de simulación incompletos para el paso", stepIndex, step);
        document.getElementById("explanation-content").innerHTML = `<p>Datos de simulación incompletos para este paso.</p>`;
        // Opcional: Deshabilitar navegación si los datos son inconsistentes
        // document.getElementById("prev-step-button").disabled = true;
        // document.getElementById("next-step-button").disabled = true;
        return;
    }

    // Renderizar ambas líneas de tiempo
    // Pasamos los datos específicos de cada algoritmo y el ID del SVG correspondiente
    renderTimeline('Round Robin', step.rr_data, 'rr-timeline-svg', step.currentTime);
    renderTimeline('STRF', step.strf_data, 'strf-timeline-svg', step.currentTime);


    // Actualizar el área de explicación
    const explanationContent = document.getElementById("explanation-content");

    // Mostrar explicación paso a paso
    let explanationHTML = `
        <h4>Paso ${stepIndex + 1}: Tiempo ${step.currentTime || 0} unidades</h4>
        <p>${step.explanation || 'No hay explicación disponible para este paso.'}</p>
        <div class="algorithm-details">
            <div class="rr-details">
                <h5>Round Robin:</h5>
                <p>Proceso en ejecución: <strong>${step.rr_data.process ? `P${step.rr_data.process}` : 'Ninguno'}</strong></p>
                <p>Tiempo restante del proceso en ejecución: <strong>${step.rr_data.remaining_time !== undefined ? step.rr_data.remaining_time : 'N/A'}</strong></p>
            </div>
            <div class="strf-details">
                <h5>STRF:</h5>
                <p>Proceso en ejecución: <strong>${step.strf_data.process ? `P${step.strf_data.process}` : 'Ninguno'}</strong></p>
                 <p>Tiempo restante del proceso en ejecución: <strong>${step.strf_data.remaining_time !== undefined ? step.strf_data.remaining_time : 'N/A'}</strong></p>
            </div>
        </div>
    `;

    // Si es el último paso, añadir el resumen final
    if (step.final_summary) {
        const rr_results = step.final_summary.RR;
        const strf_results = step.final_summary.STRF;
        const comparison = step.final_summary.comparison;

        explanationHTML += `
            <div class="final-summary">
                <h4>Resultados Finales de la Simulación</h4>
                <div class="algorithm-results">
                    <div class="rr-results">
                        <h5>Round Robin (RR):</h5>
                        <p>Tiempo Promedio: <strong>${rr_results.average_time !== undefined ? rr_results.average_time : 'N/A'}</strong> unidades</p>
                        <p>Tiempo Total: <strong>${rr_results.end_time !== undefined ? rr_results.end_time : 'N/A'}</strong> unidades</p>
                    </div>
                    <div class="strf-results">
                        <h5>STRF:</h5>
                        <p>Tiempo Promedio: <strong>${strf_results.average_time !== undefined ? strf_results.average_time : 'N/A'}</strong> unidades</p>
                        <p>Tiempo Total: <strong>${strf_results.end_time !== undefined ? strf_results.end_time : 'N/A'}</strong> unidades</p>
                    </div>
                </div>
                <div class="comparison-result">
                    <h5>Conclusión:</h5>
                    <p>${comparison || 'No hay resultado de comparación disponible.'}</p>
                </div>
            </div>
        `;
    }

    explanationContent.innerHTML = explanationHTML;


    // Actualizar el estado de los botones de navegación
    document.getElementById("prev-step-button").disabled = stepIndex === 0;
    document.getElementById("next-step-button").disabled = stepIndex === simulationData.length - 1;
}

// Función para renderizar el timeline y los nodos SVG para un paso dado
// Recibe el nombre del algoritmo, los datos específicos de ese algoritmo para el paso actual,
// el ID del elemento SVG donde dibujar, y el tiempo actual del paso.
function renderTimeline(algorithmName, stepAlgorithmData, svgId, currentTime) {
    const svg = document.getElementById(svgId);
    // Limpiar SVG anterior
    svg.innerHTML = '';

    const svgWidth = svg.clientWidth;
    const svgHeight = svg.clientHeight;
    const margin = { top: 30, right: 20, bottom: 40, left: 60 }; // Ajustar márgenes
    const drawingWidth = svgWidth - margin.left - margin.right;
    const drawingHeight = svgHeight - margin.top - margin.bottom;

    // Asegurarse de que stepAlgorithmData y timeline existen
    const timeline = stepAlgorithmData && stepAlgorithmData.timeline ? stepAlgorithmData.timeline : [];

     // Determinar el tiempo máximo para la escala X.
     // Podríamos basarnos en el tiempo actual del paso + un buffer,
     // o en el tiempo total de la simulación si el backend lo proporciona.
     // Para empezar, usemos un rango basado en el tiempo actual y un mínimo.
    // TODO: Considerar obtener el tiempo total de la simulación del backend para una escala consistente
    const maxTime = Math.max(currentTime + 5, 10); // Escala X hasta el tiempo actual + buffer, mínimo 10

    // Crear una escala para mapear el tiempo a la posición X en el SVG
    const xScale = (time) => margin.left + (time / maxTime) * drawingWidth;

    // Escala Y: Distribuir procesos verticalmente.
    // Necesitamos saber cuántos procesos hay en total para esta simulación.
    // Basémonos en los IDs de proceso presentes en el timeline de este paso para determinar las filas.
    const processIdsInStep = [...new Set(timeline.map(([time, processId]) => processId))].sort((a, b) => a - b);
    const numberOfProcessesToShow = processIdsInStep.length > 0 ? processIdsInStep.length : 1; // Evitar división por cero

    // Mapeo de ID de proceso a índice vertical (fila)
    const processIdToIndex = {};
    processIdsInStep.forEach((id, index) => {
        processIdToIndex[id] = index;
    });
    const yScale = (processId) => {
        const processIndex = processIdToIndex[processId];
        return margin.top + (processIndex + 0.5) * (drawingHeight / numberOfProcessesToShow);
    }


    // Dibujar la línea del timeline principal
    const timelineLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
    timelineLine.setAttribute("x1", xScale(0));
    timelineLine.setAttribute("y1", margin.top + drawingHeight / 2); // Posición central vertical
    timelineLine.setAttribute("x2", xScale(maxTime));
    timelineLine.setAttribute("y2", margin.top + drawingHeight / 2); // Posición central vertical
    timelineLine.classList.add("timeline-line");
    svg.appendChild(timelineLine);

    // Dibujar marcas y etiquetas en el timeline
    const numberOfTicks = Math.min(maxTime, 10); // No más de 10 marcas para no saturar
    for (let i = 0; i <= maxTime; i++) { // Dibujar marcas en cada unidad de tiempo hasta maxTime
        const xPos = xScale(i);

        // Marca
        const tick = document.createElementNS("http://www.w3.org/2000/svg", "line");
        tick.setAttribute("x1", xPos);
        tick.setAttribute("y1", margin.top + drawingHeight / 2 - 5); // 5px arriba de la línea central
        tick.setAttribute("x2", xPos);
        tick.setAttribute("y2", margin.top + drawingHeight / 2 + 5); // 5px abajo de la línea central
        tick.classList.add("timeline-tick");
        svg.appendChild(tick);

        // Etiqueta de tiempo (mostrar cada 2 unidades o ajustar)
        if (i % 2 === 0 || i === currentTime || i === maxTime) { // Mostrar tiempo actual, 0, maxTime y cada 2 unidades
            const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
            label.setAttribute("x", xPos);
            label.setAttribute("y", margin.top + drawingHeight / 2 + 25); // 25px abajo de la línea central
            label.textContent = i;
            label.classList.add("timeline-label");
            svg.appendChild(label);
        }
    }

    // Dibujar segmentos de proceso en sus respectivas "filas"
    // Necesitamos agrupar los puntos del timeline por ID de proceso
    const processSegments = {};
    timeline.forEach(([time, processId]) => {
        if (!processSegments[processId]) {
            processSegments[processId] = [];
        }
        processSegments[processId].push(time);
    });

    Object.entries(processSegments).forEach(([processIdStr, times]) => {
        const processId = parseInt(processIdStr);
        // Solo dibujar si el ID del proceso está en la lista de IDs para mostrar en este paso
        if (processIdsInStep.includes(processId)) {
            const yPos = yScale(processId);

            // Dibujar nombre del proceso a la izquierda
            const processLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
            processLabel.setAttribute("x", margin.left - 10); // Posicionar a la izquierda del área de dibujo
            processLabel.setAttribute("y", yPos);
            processLabel.textContent = `P${processId}`;
            processLabel.classList.add("process-label");
            processLabel.setAttribute("text-anchor", "end"); // Alinear texto a la derecha
            processLabel.setAttribute("dominant-baseline", "middle"); // Centrar verticalmente
            svg.appendChild(processLabel);


            // Dibujar los segmentos de tiempo donde el proceso estuvo activo
            // Ordenar los tiempos para dibujar segmentos continuos
            times.sort((a, b) => a - b);

            let segmentStart = times[0];
            for (let i = 1; i < times.length; i++) {
                // Si el tiempo actual es consecutivo al anterior, continuamos el segmento
                if (times[i] === times[i-1] + 1) {
                    // Continuar segmento
                } else {
                    // Hay un hueco, dibujar el segmento anterior y empezar uno nuevo
                    const segment = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                    segment.setAttribute("x", xScale(segmentStart));
                    segment.setAttribute("y", yPos - 10); // Centrar verticalmente en la fila del proceso
                    segment.setAttribute("width", xScale(times[i-1] + 1) - xScale(segmentStart)); // Ancho basado en la duración
                    segment.setAttribute("height", 20); // Altura del segmento
                    segment.classList.add("process-segment");
                    // Añadir clase para el proceso en ejecución en el tiempo actual
                    // Un segmento está "ejecutando" si el tiempo actual está dentro de su rango
                    if (currentTime >= segmentStart && currentTime < times[i-1] + 1) {
                        segment.classList.add("is-running");
                    }
                    svg.appendChild(segment);
                    segmentStart = times[i]; // Iniciar nuevo segmento
                }
            }
            // Dibujar el último segmento
            const segment = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            segment.setAttribute("x", xScale(segmentStart));
            segment.setAttribute("y", yPos - 10); // Centrar verticalmente
            segment.setAttribute("width", xScale(times[times.length - 1] + 1) - xScale(segmentStart));
            segment.setAttribute("height", 20);
            segment.classList.add("process-segment");
            // Añadir clase para el proceso en ejecución en el tiempo actual
            if (currentTime >= segmentStart && currentTime < times[times.length - 1] + 1) {
                segment.classList.add("is-running");
            }
            svg.appendChild(segment);


            // Opcional: Dibujar un nodo o marcador en el tiempo actual si el proceso está activo
            // Verificamos si el proceso está en ejecución en este instante según los datos del paso
            if (stepAlgorithmData.process === processId) {
                const currentNode = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                currentNode.setAttribute("cx", xScale(currentTime + 0.5)); // Centrar el círculo en el instante de tiempo
                currentNode.setAttribute("cy", yPos);
                currentNode.setAttribute("r", 8); // Radio del círculo
                currentNode.classList.add("current-process-indicator");
                svg.appendChild(currentNode);
            }
        }
    });


    // Dibujar la línea indicadora del tiempo actual en todo el timeline
    const currentTimeLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
    currentTimeLine.setAttribute("x1", xScale(currentTime + 0.5)); // Posicionar la línea en el centro del instante de tiempo
    currentTimeLine.setAttribute("y1", margin.top);
    currentTimeLine.setAttribute("x2", xScale(currentTime + 0.5));
    currentTimeLine.setAttribute("y2", margin.top + drawingHeight);
    currentTimeLine.classList.add("current-time-line");
    svg.appendChild(currentTimeLine);

    // Añadir el nombre del algoritmo como título dentro del SVG
    const algoTitle = document.createElementNS("http://www.w3.org/2000/svg", "text");
    algoTitle.setAttribute("x", svgWidth / 2); // Centrar horizontalmente
    algoTitle.setAttribute("y", 20); // Posicionar cerca de la parte superior
    algoTitle.textContent = algorithmName;
    algoTitle.classList.add("algorithm-title"); // Clase para estilizar el título
    algoTitle.setAttribute("text-anchor", "middle"); // Alinear texto al centro
    svg.appendChild(algoTitle);
}


// Función para ir al siguiente paso de la simulación
function nextStep() {
    if (currentStepIndex < simulationData.length - 1) {
        currentStepIndex++;
        displaySimulationStep(currentStepIndex);
    }
}

// Función para ir al paso anterior de la simulación
function prevStep() {
    if (currentStepIndex > 0) {
        currentStepIndex--;
        displaySimulationStep(currentStepIndex);
    }
}

// Función para buscar historial
function searchHistory() {
    window.location.href = "/stadistics"; // Asegúrate de que esta es la ruta correcta
}

// Asignar eventos a los botones de navegación de pasos
document.getElementById("next-step-button").addEventListener("click", nextStep);
document.getElementById("prev-step-button").addEventListener("click", prevStep);

// Asegurarse de que los números de proceso se actualicen al cargar la página
window.onload = () => {
    updateProcessNumbers();
    // Deshabilitar el botón de eliminar para el proceso inicial al cargar la página
    if (document.querySelectorAll('.process-box').length === 1) {
        document.querySelector('.remove-btn').disabled = true;
    }
};


// Manejar el redimensionamiento de la ventana para redibujar los SVGs
window.addEventListener('resize', () => {
    // Solo redibujar si hay datos de simulación cargados
    if (simulationData && simulationData.length > 0) {
        displaySimulationStep(currentStepIndex); // Vuelve a mostrar el paso actual para redibujar
    }
});

