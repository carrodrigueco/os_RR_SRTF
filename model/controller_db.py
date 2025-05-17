from flask import Blueprint, jsonify, request
import threading
from queue import Queue
from functions.functions import *
import sqlite3
import os

controller = Blueprint("controller", __name__)
path = 'model/os_simulation.db'

@controller.get('/simulate')
def info_get():
    try:
        if not os.path.exists(path):
            raise Exception("Base de datos no encontrada, por favor ejecute db.py primero")

        con = sqlite3.connect(path)
        cur = con.cursor()

        # Fetch all unique simulation IDs
        cur.execute("SELECT DISTINCT id_simulation FROM simulations")
        simulation_ids = [row[0] for row in cur.fetchall()]

        simulations = []

        for sim_id in simulation_ids:
            # Fetch both algorithm results
            cur.execute("""
                SELECT type_algorithm, quamtum_time, time_ends, prom_time
                FROM simulations
                WHERE id_simulation = ?
                ORDER BY type_algorithm
            """, (sim_id,))
            algo_rows = cur.fetchall()

            # Fetch processes
            cur.execute("""
                SELECT id_process, time_arrive, time_cpu
                FROM processes
                WHERE id_simulation = ?
            """, (sim_id,))
            process_rows = cur.fetchall()
            process_list = [
                {
                    "id_process": pid,
                    "process_birth": arrive,
                    "cpu_time": cpu
                }
                for pid, arrive, cpu in process_rows
            ]

            # Format the simulation object
            simulation_data = {
                "id_simulation": sim_id,
                "processes": process_list,
                "results": []
            }

            for algo in algo_rows:
                type_algorithm, quantum, end_time, prom_time = algo
                simulation_data["results"].append({
                    "type_algorithm": type_algorithm,
                    "quantum": quantum,
                    "end_time": end_time,
                    "average_time": prom_time,
                    # If you store timeline in DB in future, include it here
                })

            simulations.append(simulation_data)

        con.close()
        return jsonify(simulations), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
@controller.post('/')
def info_post():
    json_data = request.get_json()
    try:
        if not os.path.exists(path):
            raise Exception("Base de datos no encontrada, por favor ejecute db.py primero")

        quantum = json_data["quantum"]
        processes = json_data["processes"]

        con = sqlite3.connect(path)
        cur = con.cursor()

        cur.execute("SELECT MAX(id_simulation) FROM simulations")
        result = cur.fetchone()
        id_simulation = result[0] + 1 if result[0] is not None else 1

        # Run both simulators (RR and SRTF)
        results = threads_exec(processes=processes, quantum=quantum)  # returns [RR_result, SRTF_result]


        # Insert a single simulation record to get shared simulation ID
        cur.execute("""
            INSERT INTO simulations (id_simulation, type_algorithm, quamtum_time, time_ends, prom_time)
            VALUES (?, ?, ?, ?, ?)
        """, (id_simulation, 0, quantum, results[0]["end_time"], results[0]["average_time"]))

        # Insert second algorithm result (SRTF) using the same id_simulation
        cur.execute("""
            INSERT INTO simulations (id_simulation, type_algorithm, quamtum_time, time_ends, prom_time)
            VALUES (?, ?, ?, ?, ?)
        """, (id_simulation, 1, quantum, results[1]["end_time"], results[1]["average_time"]))

        # Insert process entries once per simulation (they're shared)
        for proc in processes:
            cur.execute("""
                INSERT INTO processes (id_process, id_simulation, time_arrive, time_cpu)
                VALUES (?, ?, ?, ?)
            """, (
                proc["id_process"],
                id_simulation,
                proc["process_birth"],
                proc["cpu_time"]
            ))

        con.commit()
        con.close()

        return jsonify({
            "RESPONSE_CODE": 200,
            "simulation_id": id_simulation,
            "simulations": [
                {
                    "algorithm": "RR",
                    "timeline": results[0]["timeline"],
                    "end_time": results[0]["end_time"],
                    "average_time": results[0]["average_time"]
                },
                {
                    "algorithm": "STRF",
                    "timeline": results[1]["timeline"],
                    "end_time": results[1]["end_time"],
                    "average_time": results[1]["average_time"]
                }
            ]
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

def threads_exec(processes:list, quantum:int)->list:
# Create queues to hold results from each thread
        rr_result_queue = Queue()
        strf_result_queue = Queue()

        # Define target wrappers for the threads
        def run_rr():
            result = simulador_RR(processes, quantum)
            rr_result_queue.put(result)

        def run_strf():
            result = simulador_STRF(processes)
            strf_result_queue.put(result)

        # Start threads
        rr_thread = threading.Thread(target=run_rr)
        strf_thread = threading.Thread(target=run_strf)

        rr_thread.start()
        strf_thread.start()

        # Wait for both to finish
        rr_thread.join()
        strf_thread.join()

        # Retrieve results
        rr_result = rr_result_queue.get()
        strf_result = strf_result_queue.get()

        return [rr_result, strf_result]

if __name__ == '__main__':
    controller.run(debug=True)