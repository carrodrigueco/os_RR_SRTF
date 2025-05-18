def simulador_RR(processes: list, quantum: int) -> dict:
    timeline = []
    current_time = 0
    queue = [p.copy() for p in sorted(processes, key=lambda p: p['process_birth'])]
    ready_queue = []
    finished = []
    process_arrival = {p['id_process']: p['process_birth'] for p in queue}
    remaining_time = {p['id_process']: p['cpu_time'] for p in queue}
    turnaround_times = {}
    remaining_times_history = {}

    while queue or ready_queue:
        ready_queue += [p for p in queue if p['process_birth'] <= current_time]
        queue = [p for p in queue if p['process_birth'] > current_time]

        if not ready_queue:
            current_time += 1
            continue

        process = ready_queue.pop(0)
        pid = process['id_process']
        exec_time = min(quantum, remaining_time[pid])
        
        remaining_times_history[current_time] = remaining_time.copy()
        
        for _ in range(exec_time):
            timeline.append((current_time, pid))
            current_time += 1

        remaining_time[pid] -= exec_time
        if remaining_time[pid] <= 0:
            turnaround_times[pid] = current_time - process_arrival[pid]
            finished.append(pid)
        else:
            ready_queue.append(process)

    average_time = sum(turnaround_times.values()) / len(turnaround_times)

    return {
        "timeline": timeline,
        "end_time": current_time,
        "average_time": round(average_time, 2),
        "remaining_times_history": remaining_times_history
    }

def simulador_STRF(processes: list) -> dict:
    timeline = []
    current_time = 0
    queue = [p.copy() for p in sorted(processes, key=lambda p: p['process_birth'])]
    remaining_time = {p['id_process']: p['cpu_time'] for p in queue}
    process_arrival = {p['id_process']: p['process_birth'] for p in queue}
    finished = set()
    turnaround_times = {}
    remaining_times_history = {}

    while len(finished) < len(queue):
        available = [p for p in queue if p['process_birth'] <= current_time and p['id_process'] not in finished]
        if not available:
            current_time += 1
            continue

        remaining_times_history[current_time] = remaining_time.copy()
        
        process = min(available, key=lambda p: remaining_time[p['id_process']])
        pid = process['id_process']
        timeline.append((current_time, pid))
        remaining_time[pid] -= 1

        if remaining_time[pid] <= 0:
            turnaround_times[pid] = current_time + 1 - process_arrival[pid]
            finished.add(pid)

        current_time += 1

    average_time = sum(turnaround_times.values()) / len(turnaround_times)

    return {
        "timeline": timeline,
        "end_time": current_time,
        "average_time": round(average_time, 2),
        "remaining_times_history": remaining_times_history
    }