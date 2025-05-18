# Importa Flask y otras funciones necesarias
from flask import Flask, render_template, request, jsonify
# Importa las funciones de simulación desde tu archivo functions.py dentro de la carpeta functions
# La importación debe ser desde functions.functions
from functions.functions import simulador_RR, simulador_STRF
# Importa el blueprint del controlador de base de datos
from model.controller_db import controller
import sqlite3 # Necesitas sqlite3 aquí para la función save_to_database

app = Flask(__name__)
# Registra el blueprint del controlador de base de datos con el prefijo /api
app.register_blueprint(controller, url_prefix = "/api")

# Ruta principal que renderiza el formulario de simulación
@app.route("/")
def index():
    return render_template('index.html')

# Ruta para mostrar estadísticas o historial
@app.route("/stadistics")
def stats():
    # Asegúrate de tener una plantilla stats.html en la carpeta templates
    # TODO: Implementar la lógica para obtener datos del historial de la BD y pasarlos a la plantilla
    return render_template('stats.html')

# Ruta para manejar las solicitudes de simulación (POST)
@app.route("/simulate", methods=['POST'])
def simulate():
    try:
        # Obtiene los datos JSON enviados por el frontend
        data = request.get_json()
        # Ya no esperamos el campo 'algorithm' aquí
        # algorithm = data.get('algorithm') # Eliminamos esta línea
        processes = data.get('processes')
        quantum = data.get('quantum') # Obtiene el valor del quantum

        # Valida que se hayan recibido los datos necesarios (ahora solo processes y quantum)
        if not processes or quantum is None: # Verifica que processes no esté vacío y quantum no sea None
            return jsonify({"error": "Datos incompletos (faltan procesos o quantum)"}), 400 # Bad Request

        # Asigna IDs a los procesos y valida los datos de entrada
        valid_processes = []
        for i, p in enumerate(processes):
            # Verifica que los campos obligatorios no sean None y sean convertibles a int
            cpu_time = p.get('cpu_time')
            birth_time = p.get('process_birth')
            priority = p.get('priority', 0) # Usa 0 como valor por defecto si priority es None

            if cpu_time is not None and birth_time is not None:
                 try:
                     valid_processes.append({
                         # Usar 'id_process' para consistencia con la tabla de la base de datos
                         'id_process': i+1,
                         'cpu_time': int(cpu_time),
                         'process_birth': int(birth_time),
                         'priority': int(priority) # Asegura que la prioridad también sea int
                     })
                 except ValueError:
                     # Manejar caso donde cpu_time, process_birth o priority no son números válidos
                     return jsonify({"error": f"Valores de proceso inválidos para el proceso #{i+1}"}), 400


        # Verifica si hay procesos válidos después de la validación
        if not valid_processes:
            return jsonify({"error": "No hay procesos válidos después de la validación"}), 400 # Bad Request

        # Ejecutar simulaciones para ambos algoritmos
        # Validar el valor del quantum antes de pasarlo a las funciones de simulación
        try:
             quantum_int = int(quantum)
             if quantum_int < 1 or quantum_int > 4:
                 return jsonify({"error": "El valor de quantum debe estar entre 1 y 4"}), 400
        except ValueError:
             return jsonify({"error": "El valor de quantum no es un número entero válido"}), 400


        # Run both simulations
        # Asegúrate de que tus funciones simulador_RR y simulador_STRF acepten los argumentos correctos
        # simulador_RR debe aceptar la lista de procesos (con 'id_process') y el quantum
        # simulador_STRF debe aceptar solo la lista de procesos (con 'id_process')
        rr_simulation_result = simulador_RR(valid_processes, quantum_int)
        strf_simulation_result = simulador_STRF(valid_processes)

        # --- Lógica de combinación de pasos y generación de explicación ---
        # Esta lógica combina los resultados de ambos simuladores en una secuencia de pasos
        # para la visualización paso a paso.

        # Determinar el tiempo máximo de simulación entre ambos algoritmos
        max_end_time = max(rr_simulation_result.get('end_time', 0), strf_simulation_result.get('end_time', 0))
        simulation_steps = []

        # Iterar a través del tiempo para crear los pasos
        for time in range(max_end_time + 1):
            # Obtener el estado de RR en 'time' a partir de rr_simulation_result
            # La función get_state_at_time necesita ser implementada para extraer
            # el estado relevante (proceso en ejecución, etc.) del resultado del simulador.
            # Con la estructura de datos actual (solo timeline), solo podemos saber qué proceso
            # estaba ejecutando al inicio de este instante de tiempo.
            rr_data_at_time = get_state_at_time(rr_simulation_result, time, 'RR')
            # Obtener el estado de STRF en 'time' a partir de strf_simulation_result
            strf_data_at_time = get_state_at_time(strf_simulation_result, time, 'STRF')

            # Generar una explicación detallada para este paso de tiempo
            explanation_for_step = generate_explanation(rr_data_at_time, strf_data_at_time, time)

            step_data = {
                "currentTime": time,
                "explanation": explanation_for_step,
                "rr_data": rr_data_at_time, # Debe contener 'timeline' hasta el tiempo actual y 'process' en ejecución
                "strf_data": strf_data_at_time # Debe contener 'timeline' hasta el tiempo actual y 'process' en ejecución
            }

            # Añadir estadísticas finales al último paso
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
        # --- Fin de la lógica de combinación de pasos ---

        # Guardar los resultados de la simulación en la base de datos
        # La función save_to_database necesita ser adaptada para manejar los resultados de ambos algoritmos
        save_to_database(valid_processes, {'RR': rr_simulation_result, 'STRF': strf_simulation_result})


        # Devuelve los pasos de la simulación combinada como respuesta JSON al frontend
        # La estructura de 'simulation_steps' es un array de objetos,
        # cada uno con 'currentTime', 'explanation', 'rr_data', 'strf_data',
        # y el último paso tendrá 'final_summary'.
        return jsonify({"steps": simulation_steps}) # Enviar como un objeto con clave 'steps'


    except Exception as e:
        # Captura cualquier otra excepción y devuelve un error 500
        print(f"Error en la ruta /simulate: {e}") # Imprime el error en la consola del servidor
        # Re-lanza la excepción para ver el traceback completo en la consola
        # raise e
        return jsonify({"error": f"Error interno del servidor: {e}"}), 500 # Internal Server Error

# --- Funciones auxiliares ---
# Estas funciones procesan los resultados de los simuladores para la visualización paso a paso.

def get_state_at_time(simulation_result, time, algorithm_type):
    """
    Obtiene el estado relevante de una simulación en un instante de tiempo dado.
    Basado en la estructura de salida actual de tus simuladores (solo timeline).
    """
    # Filtrar el timeline hasta el tiempo actual 'time'
    # El timeline es una lista de (instante_inicio, id_proceso)
    timeline_up_to_time = [item for item in simulation_result.get('timeline', []) if item[0] <= time]

    current_process_id = None
    # Para saber qué proceso está ejecutando *en* el instante 'time',
    # buscamos la última entrada en el timeline cuyo instante de inicio es menor o igual a 'time'.
    # Sin embargo, esto solo nos dice qué proceso *empezó* a ejecutar en o antes de 'time'.
    # Para saber si *sigue* ejecutando *en* 'time', necesitaríamos más información del simulador.
    # Con la estructura actual, asumimos que el último ID en el timeline_up_to_time
    # es el que está ejecutando en el instante 'time', si hay alguna entrada.
    # Esto es una simplificación.
    if timeline_up_to_time:
         # Buscar la última entrada en el timeline que corresponde al tiempo 'time'
         # o la última entrada antes de 'time' si no hay nada en 'time'
         last_event_at_or_before_time = None
         for event_time, process_id in reversed(timeline_up_to_time):
             # En el timeline actual, cada entrada (t, pid) significa que pid empezó a ejecutar en el tiempo t.
             # Para saber quién está ejecutando *en* el tiempo 'time', necesitamos saber quién
             # *empezó* antes o en 'time' y *no ha terminado o sido desalojado* antes de 'time'.
             # Esto es difícil de determinar solo con el timeline actual.

             # Simplificación: Consideramos el proceso que está en la última entrada del timeline
             # hasta el tiempo actual como el proceso en ejecución en este instante.
             # Esto NO es preciso para algoritmos preemptivos como RR o STRF.
             # Una implementación correcta requeriría que el simulador devuelva el estado
             # de la CPU (ociosa o pid) para cada instante de tiempo.

             # Intentemos una mejor aproximación: el proceso que inició en el último instante <= time
             # y que no ha terminado antes de 'time'. Esto aún requiere información de terminación.

             # Volviendo a la simplificación anterior, pero reconociendo su limitación:
             current_process_id = timeline_up_to_time[-1][1]
             break # Tomamos el último proceso registrado hasta este tiempo


    # El tiempo restante NO puede ser determinado con la estructura de datos actual (solo timeline).
    # Para mostrar el tiempo restante, las funciones simulador_RR y simulador_STRF
    # necesitarían devolver una estructura de datos diferente, por ejemplo, una lista
    # de estados para cada unidad de tiempo: [(time, {process_id: state, ...}), ...]
    remaining_time = 'N/A' # No podemos obtener esto de la estructura actual

    return {
        'timeline': timeline_up_to_time, # Devolvemos el timeline hasta el tiempo actual
        'process': current_process_id, # ID del proceso en ejecución en este tiempo (o None) - Simplificado
        'remaining_time': remaining_time # Tiempo restante del proceso en ejecución (si estuviera disponible)
        # Puedes añadir aquí otras propiedades relevantes del estado del proceso (ej: estado 'ready', 'blocked')
        # si tus simuladores las proporcionan en su salida.
    }

def generate_explanation(rr_data, strf_data, time):
    """
    Genera una explicación detallada para un paso de tiempo dado.
    Basada en los estados de ambos algoritmos en ese tiempo (obtenidos de get_state_at_time).
    """
    explanation = f"Tiempo {time} unidades:\n"

    rr_process = rr_data.get('process')
    strf_process = strf_data.get('process')
    # remaining_time_rr = rr_data.get('remaining_time', 'N/A') # No disponible con estructura actual
    # remaining_time_strf = strf_data.get('remaining_time', 'N/A') # No disponible con estructura actual

    explanation += "  - Round Robin: "
    if rr_process is not None:
        # Si pudieras obtener el estado (running, ready, etc.) y tiempo restante, la explicación sería mejor.
        # Ejemplo conceptual si tuvieras más datos:
        # if rr_data.get('state') == 'running':
        #     explanation += f"Proceso {rr_process} ejecutando (restante: {remaining_time_rr})."
        # elif rr_data.get('state') == 'ready':
        #     explanation += f"Proceso {rr_process} está en la cola de listos."
        # else: # Asumiendo que si hay process, está ejecutando con la estructura actual simplificada
        explanation += f"Proceso {rr_process} ejecutando." # Simplificado

    else:
        explanation += "CPU inactiva o esperando procesos."

    explanation += "\n  - STRF: "
    if strf_process is not None:
         # Si pudieras obtener el estado (running, ready, etc.) y tiempo restante, la explicación sería mejor.
         # Ejemplo conceptual si tuvieras más datos:
         # if strf_data.get('state') == 'running':
         #     explanation += f"Proceso {strf_process} ejecutando (restante: {remaining_time_strf})."
         # elif strf_data.get('state') == 'ready':
         #     explanation += f"Proceso {strf_process} está en la cola de listos."
         # else: # Asumiendo que si hay process, está ejecutando con la estructura actual simplificada
         explanation += f"Proceso {strf_process} ejecutando." # Simplificado
    else:
        explanation += "CPU inactiva o esperando procesos."

    # TODO: Añadir lógica para describir eventos clave si tus simuladores los reportan:
    # - Llegada de nuevos procesos
    # - Cambio de proceso en ejecución (preemption, terminación, bloqueo)
    # - Proceso terminado
    # Esto requeriría que tus simuladores reporten estos eventos en su salida.

    return explanation.strip() # Eliminar espacios al inicio y final

def generate_comparison_result(rr_result, strf_result):
    """
    Genera un texto de comparación basado en los resultados finales.
    """
    rr_avg = rr_result.get('average_time', float('inf')) # Usar infinito si no hay promedio
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

    # Puedes añadir comparación por tiempo total si es relevante
    # if rr_result.get('end_time', float('inf')) < strf_result.get('end_time', float('inf')):
    #     comparison += " Round Robin terminó antes."
    # elif strf_result.get('end_time', float('inf')) < rr_result.get('end_time', float('inf')):
    #     comparison += " STRF terminó antes."

    return comparison


# Función para guardar los resultados de la simulación en la base de datos
# Esta función necesita ser adaptada para manejar los resultados de ambos algoritmos
def save_to_database(processes, simulation_results):
    # --- IMPRESIONES DE DEPURACIÓN dentro de save_to_database ---
    # print("--- Dentro de save_to_database ---")
    # print("Received processes:", processes)
    # print("Received simulation_results:", simulation_results)
    # print("---------------------------------")
    # --- FIN IMPRESIONES DE DEPURACIÓN ---
    try:
        # Asegúrate de que la ruta a la base de datos es correcta
        # La base de datos os_simulation.db está dentro de la carpeta model
        con = sqlite3.connect("model/os_simulation.db")
        cur = con.cursor()

        # Obtener el último ID de simulación para asignar uno nuevo
        cur.execute("SELECT MAX(id_simulation) FROM simulations")
        last_id = cur.fetchone()[0] or 0 # Si no hay simulaciones, el último ID es 0
        new_id = last_id + 1

        # Insertar los datos de los procesos para esta simulación
        # Asumiendo que tienes una tabla 'processes' para almacenar los procesos iniciales
        # CREATE TABLE processes (id_process INTEGER, id_simulation INTEGER, time_arrive INTEGER, time_cpu INTEGER, PRIMARY KEY (id_process, id_simulation));
        for process in processes: # Iterando sobre la lista valid_processes (que debería tener 'id_process')
            cur.execute("""
                INSERT INTO processes (id_process, id_simulation, time_arrive, time_cpu)
                VALUES (?, ?, ?, ?)
            """, (
                process['id_process'], # Accediendo a 'id_process'.
                new_id,
                process['process_birth'],
                process['cpu_time']
            ))

        # Insertar los datos resumidos de la simulación para cada algoritmo
        # Asumiendo que tienes una tabla 'simulations' para los resultados generales
        # CREATE TABLE simulations (id_simulation INTEGER PRIMARY KEY, type_algorithm INTEGER, quamtum_time INTEGER, time_ends INTEGER, prom_time REAL);
        # type_algorithm: 1 para RR, 2 para STRF
        for algo_type, algo_data in simulation_results.items(): # Iterando sobre {'RR': rr_sim_result, 'STRF': strf_sim_result}
            algo_type_id = 1 if algo_type == 'RR' else 2 # 1 para RR, 2 para STRF
            # Asegúrate de que algo_data contiene 'end_time' y 'average_time'
            # Asegúrate de que 'quantum' solo se accede para RR
            quantum_value = algo_data.get('quantum', None) if algo_type == 'RR' else None

            cur.execute("""
                INSERT INTO simulations (id_simulation, type_algorithm, quamtum_time, time_ends, prom_time)
                VALUES (?, ?, ?, ?, ?)
            """, (
                new_id,
                algo_type_id,
                quantum_value,
                algo_data.get('end_time', 0), # Accede a 'end_time' de los resultados del simulador
                algo_data.get('average_time', 0.0) # Accede a 'average_time' de los resultados del simulador
            ))

        con.commit() # Confirma la transacción
        con.close() # Cierra la conexión a la base de datos
    except sqlite3.Error as er:
        print(f"Error de base de datos al guardar: {er}")
        # raise er # Re-lanza la excepción para que sea capturada por el try exterior en simulate
    except Exception as e:
        print(f"Error inesperado al guardar en BD: {e}")
        # raise e # Re-lanza la excepción


# --- Código para iniciar el servidor de desarrollo ---
if __name__ == '__main__':
    # app.run() inicia el servidor web de desarrollo
    # debug=True permite recarga automática y muestra errores detallados
    # host='0.0.0.0' permite acceder desde otras máquinas en la red (opcional)
    app.run(debug=True)
