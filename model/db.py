import sqlite3
import os

def creador():
    con = sqlite3.connect("model/os_simulation.db")
    cur = con.cursor()

    # Eliminar tabla si existe (para desarrollo)
    cur.execute("DROP TABLE IF EXISTS simulations")
    cur.execute("DROP TABLE IF EXISTS processes")


    # Crear tabla de simulaciones
    cur.execute("""
        CREATE TABLE simulations(
            id_simulation INTEGER NOT NULL,
            type_algorithm INTEGER NOT NULL,
            quamtum_time INTEGER,
            time_ends INTEGER NOT NULL,
            prom_time INTEGER NOT NULL,
            PRIMARY KEY (id_simulation, type_algorithm)
        );
                """)

    # Crear tabla de algoritmos (para referencia)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS processes(
            id_process INTEGER NOT NULL,
            id_simulation INTEGER NOT NULL,
            time_arrive INTEGER NOT NULL,
            time_cpu INTEGER NOT NULL,
            PRIMARY KEY (id_process, id_simulation),
            FOREIGN KEY (id_simulation) REFERENCES simulations(id_simulation)
        );
                """)

    # Insertar algoritmos conocidos
    #cur.execute("INSERT OR IGNORE INTO algorithms VALUES (1, 'RR', 'Round Robin')")
    #cur.execute("INSERT OR IGNORE INTO algorithms VALUES (2, 'STRF', 'Shortest Remaining Time First')")

    con.commit()
    con.close()

if __name__ == '__main__':
    if os.path.exists('model/os_simulation.db'):
        print('ADVERTENCIA: La base de datos ya existe y será recreada')
        os.remove('model/os_simulation.db')
    
    creador()
    print('Base de datos creada exitosamente')