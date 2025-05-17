def simulador_RR(processes:list, quantum:int)->dict:
    """
    """
    steps = []
    current_time = 0
    pending_processes = [p.copy() for p in processes]
    completed_processes = []
    
    while pending_processes:
        for process in pending_processes[:]:
            if process['process_birth'] <= current_time:
                execution_time = min(quantum, process['cpu_time'])
                
                step = {
                    "currentTime": current_time,
                    "explanation": f"Proceso {process['id']} ejecutando (RR) por {execution_time} unidades",
                    "processes": []
                }
                
                # Actualizar todos los procesos para este paso
                for p in processes:
                    state = "ready"
                    position = current_time
                    
                    if p['id'] == process['id']:
                        state = "running"
                        position = current_time + execution_time/2
                        p['cpu_time'] -= execution_time
                        if p['cpu_time'] <= 0:
                            state = "finished"
                            pending_processes.remove(process)
                            completed_processes.append(process)
                    
                    step['processes'].append({
                        "id": p['id'],
                        "state": state,
                        "positionTime": position,
                        "remaining_time": p['cpu_time'] if p['id'] == process['id'] else None
                    })
                
                steps.append(step)
                current_time += execution_time
    
    # Paso final mostrando todos completados
    if completed_processes:
        final_step = {
            "currentTime": current_time,
            "explanation": "Todos los procesos han terminado",
            "processes": [{
                "id": p['id'],
                "state": "finished",
                "positionTime": current_time
            } for p in completed_processes]
        }
        steps.append(final_step)
    
    return steps

def simulador_STRF(processes:list)->dict:
    """
        
    """
    steps = []
    current_time = 0
    pending_processes = [p.copy() for p in processes]
    completed_processes = []
    
    while pending_processes:
        runnable = [p for p in pending_processes if p['process_birth'] <= current_time]
        
        if not runnable:
            current_time += 1
            continue
            
        # Seleccionar proceso con menor tiempo restante
        process = min(runnable, key=lambda p: p['cpu_time'])
        execution_time = 1
        process['cpu_time'] -= execution_time
        
        step = {
            "currentTime": current_time,
            "explanation": f"Proceso {process['id']} (STRF) ejecutando por 1 unidad",
            "processes": []
        }
        
        for p in processes:
            state = "ready"
            position = current_time
            
            if p['id'] == process['id']:
                state = "running"
                position = current_time + 0.5
                if p['cpu_time'] <= 0:
                    state = "finished"
                    pending_processes.remove(process)
                    completed_processes.append(process)
            
            step['processes'].append({
                "id": p['id'],
                "state": state,
                "positionTime": position,
                "remaining_time": p['cpu_time'] if p['id'] == process['id'] else None
            })
        
        steps.append(step)
        current_time += execution_time
    
    # Paso final
    if completed_processes:
        final_step = {
            "currentTime": current_time,
            "explanation": "Todos los procesos han terminado (STRF)",
            "processes": [{
                "id": p['id'],
                "state": "finished",
                "positionTime": current_time
            } for p in completed_processes]
        }
        steps.append(final_step)
    
    return steps

if __name__ == '__main__':
    # Datos de prueba
    test_processes = [
        {'id': 1, 'cpu_time': 5, 'process_birth': 0, 'priority': 1},
        {'id': 2, 'cpu_time': 3, 'process_birth': 1, 'priority': 2}
    ]
    print("Prueba RR:", simulador_RR(test_processes))
    print("Prueba STRF:", simulador_STRF(test_processes))