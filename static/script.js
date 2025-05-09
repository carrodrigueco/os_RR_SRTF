let number_of_processes = 1

function addProcess()
{
    const container = document.getElementById("processes");
    const newBox = document.createElement("div");
    number_of_processes += 1
    newBox.classList.add("process-box");
    newBox.innerHTML = `
        <p class = "process_name">Process #<span id = "number_process">`+number_of_processes+`</span></p>
        <label>CPU Time: <input type="number" name="cpu_time" required></label>
        <label>Process Birth: <input type="number" name="process_birth" required></label>
    `;
    container.appendChild(newBox);
}

function removeProcess()
{
    console.log('remove process')
}

function simulate()
{
    const data = Array.from(document.querySelectorAll(".process-box")).map(box => {
        return {
        cpu_time: parseInt(box.querySelector('input[name="cpu_time"]').value),
        process_birth: parseInt(box.querySelector('input[name="process_birth"]').value),
        };
    });

    const payload = {
        algorithm,
        processes: data
    };

    console.log("Sending data to server:", JSON.stringify(payload));
    // For now just simulating navigation
    window.location.href = "/simulate"; // Replace with actual endpoint as needed
}

function searchHistory()
{
    window.location.href = "/history"; // Replace with actual route
}