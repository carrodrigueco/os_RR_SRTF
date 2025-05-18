import requests

# Test data
test_data = {
    "quantum": 3,
    "processes": [
        {"id_process": 1, "cpu_time": 5, "process_birth": 0},
        {"id_process": 2, "cpu_time": 3, "process_birth": 2},
        {"id_process": 3, "cpu_time": 4, "process_birth": 1}
    ]
}

# Make POST request
try:
    response = requests.post("http://localhost:5000/api", json=test_data)

    print("Status Code:", response.status_code)
    print("Response JSON:")
    print(response.json())  # 👈 This shows the detailed results (timelines, end_time, etc.)

except requests.exceptions.RequestException as e:
    print("Error connecting to API:", e)
