const ALGO_MAP = {
            1: "RR",
            2: "STRF"
        };

fetch('api/simulate')
    .then(response => response.json())
    .then(data => {
        const container = document.getElementById('simulations-container');

        data.forEach((simulacion, index) => {
            const simDiv = document.createElement('div');
            simDiv.classList.add('simulacion');
            simDiv.innerHTML += `<h2>Simulación #${index + 1}</h2>`;

            const processLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
            const procesosHTML = simulacion.processes.map((proc, i) => `
                <div class="process-box">
                    <div class="process_name">Proceso ${processLetters[i] || proc.id_process}</div>
                    <label>Arrival Time<input type="number" value="${proc.process_birth}" disabled></label>
                    <label>Burst Time<input type="number" value="${proc.cpu_time}" disabled></label>
                </div>
            `).join('');

            simulacion.results.forEach(result => {
                const algoNombre = ALGO_MAP[result.type_algorithm] || "Desconocido";
                const algoClase = result.type_algorithm === 1 ? "rr" : "srtf";

                simDiv.innerHTML += `
                    <div class="algoritmo ${algoClase}">
                        <h3>Algoritmo: ${algoNombre}</h3>
                        ${result.quantum !== null ? `<p><strong>Quantum:</strong> ${result.quantum}</p>` : ""}
                        <div class="procesos">${procesosHTML}</div>
                        <div class="estadisticas">
                            <p><strong>Tiempo Promedio:</strong> ${result.average_time.toFixed(2)}</p>
                            <p><strong>Tiempo Total:</strong> ${result.end_time}</p>
                        </div>
                    </div>
                `;
            });

            // Comparación simple
            const rr = simulacion.results.find(r => r.type_algorithm === 1);
            const strf = simulacion.results.find(r => r.type_algorithm === 2);

            let mejor = "Ambos algoritmos tienen el mismo desempeño.";
            if (rr && strf) {
                if (rr.average_time < strf.average_time) {
                    mejor = "RR fue más eficiente en esta simulación.";
                } else if (strf.average_time < rr.average_time) {
                    mejor = "STRF fue más eficiente en esta simulación.";
                }
            }

            simDiv.innerHTML += `
                <div class="mejor">
                    <p><strong>Resultado:</strong> ${mejor}</p>
                </div>
            `;

            container.appendChild(simDiv);
        });
    })
    .catch(error => {
        console.error("Error al cargar las simulaciones:", error);
        document.getElementById('simulations-container').innerHTML = "<p>Error al cargar las simulaciones.</p>";
    });
