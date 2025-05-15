import sqlite3
import os

def creador():
    con = sqlite3.connect("os_simulation.db")
    cur = con.cursor()

    # Eliminar tabla si existe (para desarrollo)
    cur.execute("DROP TABLE IF EXISTS simulations")

    # Crear tabla de simulaciones
    cur.execute("""
        CREATE TABLE simulations(
            id INTEGER,
            id_simulation INTEGER,
            cpu_time INTEGER,
            process_birth INTEGER,
            time_starts INTEGER,
            time_ends INTEGER,
            priority INTEGER,
            PRIMARY KEY (id, id_simulation)
        );
    """)

    # Crear tabla de algoritmos (para referencia)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS algorithms(
            id INTEGER PRIMARY KEY,
            name TEXT,
            description TEXT
        );
    """)

    # Insertar algoritmos conocidos
    cur.execute("INSERT OR IGNORE INTO algorithms VALUES (1, 'RR', 'Round Robin')")
    cur.execute("INSERT OR IGNORE INTO algorithms VALUES (2, 'STRF', 'Shortest Remaining Time First')")

    con.commit()
    con.close()

if __name__ == '__main__':
    if os.path.exists('os_simulation.db'):
        print('ADVERTENCIA: La base de datos ya existe y será recreada')
        os.remove('os_simulation.db')
    
    creador()
    print('Base de datos creada exitosamente')