from flask import Blueprint, jsonify
import sqlite3
import os

controller = Blueprint("controller", __name__)

@controller.get('/<int:id_simulation>')
def info_get(id_simulation):
    path = 'model/os_simulation.db'
    try:
        if not os.path.exists(path):
            raise Exception("Base de datos no encontrada, por favor ejecute db.py primero")
        
        con = sqlite3.connect(path)
        con.row_factory = sqlite3.Row  # Para acceder a las columnas por nombre
        cur = con.cursor()

        # Obtener información de la simulación
        cur.execute("""
            SELECT DISTINCT id_simulation, 
                   (SELECT COUNT(*) FROM simulations WHERE id_simulation = ?) as process_count,
                   (SELECT MAX(time_ends) FROM simulations WHERE id_simulation = ?) as total_time
            FROM simulations 
            WHERE id_simulation = ?
        """, (id_simulation, id_simulation, id_simulation))
        
        sim_info = cur.fetchone()
        if not sim_info:
            return jsonify({"error": "Simulación no encontrada"}), 404
        
        # Obtener detalles de los procesos
        cur.execute("""
            SELECT id, cpu_time, process_birth, priority, 
                   MIN(time_starts) as start_time, 
                   MAX(time_ends) as end_time
            FROM simulations 
            WHERE id_simulation = ?
            GROUP BY id
            ORDER BY id
        """, (id_simulation,))
        
        processes = [dict(row) for row in cur.fetchall()]
        con.close()

        return jsonify({
            "simulation_id": sim_info['id_simulation'],
            "process_count": sim_info['process_count'],
            "total_time": sim_info['total_time'],
            "processes": processes
        })
        
    except Exception as e:
        print(e)
        return jsonify({"error": str(e)}), 500

@controller.post('')
def info_post():
    try:
        # Esta ruta podría usarse para guardar nuevas simulaciones
        # pero actualmente se maneja desde app.py
        return jsonify({"message": "Use /simulate endpoint to create new simulations"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    controller.run(debug=True)