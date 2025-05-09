import sqlite3
import os

def creador():
    con = sqlite3.connect("os_simulation.db")

    cur = con.cursor()

    cur.execute("""
            CREATE TABLE simulations(
                id INTEGER ,
                id_simulation INTEGER,
                cpu_time INTEGER,
                process_birth INTEGER,
                time_starts TEXT,
                time_ends INTEGER,
                priority INTEGER,
                PRIMARY KEY (id, id_simulation)
            );
        """
        )

    con.close()

if __name__ == '__main__':
    try:
        if os.path.exists('os_simulation.db'):
            raise Exception()
        creador()
    except Exception as e:
        print('LA BASE DE DATOS YA SE ENCUENTRA CREADA')
