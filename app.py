from flask import Flask, render_template, request, jsonify, redirect, url_for
from functions import simulador_RR, simulador_STRF
import sqlite3
import os

app = Flask(__name__)

@app.route("/")
def hello_world():
    return render_template('index.html')

@app.route("/simulate", methods=['POST'])
def simulate():
    try:
        data = request.get_json()
        algorithm = data.get('algorithm')
        processes = data.get('processes')
        
        if not algorithm or not processes:
            return jsonify({"error": "Datos incompletos"}), 400
        
        # Asignar IDs y validar procesos
        valid_processes = []
        for i, p in enumerate(processes):
            if p.get('cpu_time') is not None and p.get('process_birth') is not None:
                valid_processes.append({
                    'id': i+1,
                    'cpu_time': int(p['cpu_time']),
                    'process_birth': int(p['process_birth']),
                    'priority': int(p.get('priority', 0))
                })
        
        if not valid_processes:
            return jsonify({"error": "No hay procesos válidos"}), 400
        
        # Ejecutar simulación
        if algorithm == "RR":
            simulation_steps = simulador_RR(valid_processes)
        elif algorithm == "STRF":
            simulation_steps = simulador_STRF(valid_processes)
        else:
            return jsonify({"error": "Algoritmo no soportado"}), 400
            
        # Guardar en base de datos (opcional)
        save_to_database(algorithm, valid_processes, simulation_steps)
            
        return jsonify(simulation_steps)
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def save_to_database(algorithm, processes, steps):
    try:
        con = sqlite3.connect("os_simulation.db")
        cur = con.cursor()
        
        # Obtener el último ID de simulación
        cur.execute("SELECT MAX(id_simulation) FROM simulations")
        last_id = cur.fetchone()[0] or 0
        new_id = last_id + 1
        
        # Insertar datos de la simulación
        for step in steps:
            for process in step['processes']:
                original_process = next(p for p in processes if p['id'] == process['id'])
                cur.execute("""
                    INSERT INTO simulations VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (
                    process['id'],
                    new_id,
                    original_process['cpu_time'],
                    original_process['process_birth'],
                    step['currentTime'],
                    step['currentTime'] + 1,  # tiempo fin (simplificado)
                    original_process['priority']
                ))
        
        con.commit()
        con.close()
    except Exception as e:
        print(f"Error al guardar en BD: {e}")

@app.route("/simulation", methods=['GET'])
def visual():
    return render_template('simulation.html')

@app.route("/stadistics")
def stats():
    return render_template('stats.html')

if __name__ == '__main__':
    app.run(debug=True)