from flask import Flask, render_template, request, jsonify
from functions.functions import simulador_RR, simulador_STRF
from model.controller_db import controller
import sqlite3

app = Flask(__name__)
app.register_blueprint(controller, url_prefix = "/api")

@app.route("/")
def index():
    return render_template('index.html')

@app.route("/stadistics")
def stats():
    return render_template('stats.html')

@app.route("/simulate", methods=['POST'])
def simulate():
    try:
        data = request.get_json()
        processes = data.get('processes')
        quantum = data.get('quantum')

        if not processes or quantum is None:
            return jsonify({"error": "Datos incompletos (faltan procesos o quantum)"}), 400

        valid_processes = []
        for i, p in enumerate(processes):
            cpu_time = p.get('cpu_time')
            birth_time = p.get('process_birth')

            if cpu_time is not None and birth_time is not None:
                try:
                    valid_processes.append({
                        'id_process': i+1,
                        'cpu_time': int(cpu_time),
                        'process_birth': int(birth_time)
                    })
                except ValueError:
                    return jsonify({"error": f"Valores de proceso inválidos para el proceso #{i+1}"}), 400

        if not valid_processes:
            return jsonify({"error": "No hay procesos válidos después de la validación"}), 400

        try:
            quantum_int = int(quantum)
            if quantum_int < 1 or quantum_int > 4:
                return jsonify({"error": "El valor de quantum debe estar entre 1 y 4"}), 400
        except ValueError:
            return jsonify({"error": "El valor de quantum no es un número entero válido"}), 400

        rr_simulation_result = simulador_RR(valid_processes, quantum_int)
        strf_simulation_result = simulador_STRF(valid_processes)

        max_end_time = max(rr_simulation_result.get('end_time', 0), strf_simulation_result.get('end_time', 0))
        simulation_steps = []

        for time in range(max_end_time + 1):
            rr_data_at_time = get_state_at_time(rr_simulation_result, time, 'RR')
            strf_data_at_time = get_state_at_time(strf_simulation_result, time, 'STRF')

            explanation_for_step = generate_explanation(rr_data_at_time, strf_data_at_time, time)

            step_data = {
                "currentTime": time,
                "explanation": explanation_for_step,
                "rr_data": rr_data_at_time,
                "strf_data": strf_data_at_time
            }

            if time == max_end_time:
                step_data["final_summary"] = {
                    "RR": {
                        "end_time": rr_simulation_result.get('end_time', 0),
                        "average_time": rr_simulation_result.get('average_time', 0.0)
                    },
                    "STRF": {
                        "end_time": strf_simulation_result.get('end_time', 0),
                        "average_time": strf_simulation_result.get('average_time', 0.0)
                    },
                    "comparison": generate_comparison_result(rr_simulation_result, strf_simulation_result)
                }

            simulation_steps.append(step_data)

        save_to_database(valid_processes, {'RR': rr_simulation_result, 'STRF': strf_simulation_result})

        return jsonify({"steps": simulation_steps})

    except Exception as e:
        print(f"Error en la ruta /simulate: {e}")
        return jsonify({"error": f"Error interno del servidor: {e}"}), 500

def get_state_at_time(simulation_result, time, algorithm_type):
    timeline_up_to_time = [item for item in simulation_result.get('timeline', []) if item[0] <= time]
    
    current_process_id = None
    if timeline_up_to_time:
        current_process_id = timeline_up_to_time[-1][1]
    
    remaining_time = 'N/A'
    remaining_times_history = simulation_result.get('remaining_times_history', {})
    
    for t in sorted(remaining_times_history.keys(), reverse=True):
        if t <= time:
            if current_process_id in remaining_times_history[t]:
                remaining_time = remaining_times_history[t][current_process_id]
            break

    return {
        'timeline': timeline_up_to_time,
        'process': current_process_id,
        'remaining_time': remaining_time
    }

def generate_explanation(rr_data, strf_data, time):
    explanation = f"Tiempo {time} unidades:\n"

    rr_process = rr_data.get('process')
    strf_process = strf_data.get('process')

    explanation += "  - Round Robin: "
    if rr_process is not None:
        explanation += f"Proceso {rr_process} ejecutando (tiempo restante: {rr_data.get('remaining_time', 'N/A')})."
    else:
        explanation += "CPU inactiva o esperando procesos."

    explanation += "\n  - STRF: "
    if strf_process is not None:
        explanation += f"Proceso {strf_process} ejecutando (tiempo restante: {strf_data.get('remaining_time', 'N/A')})."
    else:
        explanation += "CPU inactiva o esperando procesos."

    return explanation.strip()

def generate_comparison_result(rr_result, strf_result):
    rr_avg = rr_result.get('average_time', float('inf'))
    strf_avg = strf_result.get('average_time', float('inf'))

    comparison = "Comparación de resultados:\n"
    comparison += f"  - Round Robin: Tiempo Promedio {rr_avg} unidades, Tiempo Total {rr_result.get('end_time', 0)} unidades.\n"
    comparison += f"  - STRF: Tiempo Promedio {strf_avg} unidades, Tiempo Total {strf_result.get('end_time', 0)} unidades.\n"

    if rr_avg < strf_avg:
        comparison += "  - Resultado: Round Robin fue más eficiente en tiempo promedio."
    elif strf_avg < rr_avg:
        comparison += "  - Resultado: STRF fue más eficiente en tiempo promedio."
    else:
        comparison += "  - Resultado: Ambos algoritmos tuvieron el mismo tiempo promedio."

    return comparison

def save_to_database(processes, simulation_results):
    try:
        con = sqlite3.connect("model/os_simulation.db")
        cur = con.cursor()

        cur.execute("SELECT MAX(id_simulation) FROM simulations")
        last_id = cur.fetchone()[0] or 0
        new_id = last_id + 1

        for process in processes:
            cur.execute("""
                INSERT INTO processes (id_process, id_simulation, time_arrive, time_cpu)
                VALUES (?, ?, ?, ?)
            """, (
                process['id_process'],
                new_id,
                process['process_birth'],
                process['cpu_time']
            ))

        for algo_type, algo_data in simulation_results.items():
            algo_type_id = 1 if algo_type == 'RR' else 2
            quantum_value = algo_data.get('quantum', None) if algo_type == 'RR' else None

            cur.execute("""
                INSERT INTO simulations (id_simulation, type_algorithm, quamtum_time, time_ends, prom_time)
                VALUES (?, ?, ?, ?, ?)
            """, (
                new_id,
                algo_type_id,
                quantum_value,
                algo_data.get('end_time', 0),
                algo_data.get('average_time', 0.0)
            ))

        con.commit()
        con.close()
    except sqlite3.Error as er:
        print(f"Error de base de datos al guardar: {er}")
    except Exception as e:
        print(f"Error inesperado al guardar en BD: {e}")

if __name__ == '__main__':
    app.run(debug=True)