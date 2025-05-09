import sqlite3
import os
from flask import Flask, make_response, jsonify


app = Flask(__name__)

@app.get('/api/<int:id_simulation>')
def info_get(id_simulation):
    path = 'os_simulation.db'
    try:
        if not os.path.exist(path):
            raise Exception("Database doesnt found, please run db.py")
        id_simulation = int(id_simulation)
        con = sqlite3.connect(path)
        cursor = con.cursor()

        cursor.execute(f"""
            SELECT * FROM simulations WHERE id_simulation = {id_simulation} ORDER BY id
                """)

        values = cursor.fetchall()
        json = []
        for i in range(len(values)):
            key = values[i][0]
            val = tuple(values[i][1:])
            json.append({key:values})
        con.close()
    except Exception as e:
        print(e)

    return jsonify(json)

@app.post('/api')
def info_post():
    return "<h1>API POST</h1>"

