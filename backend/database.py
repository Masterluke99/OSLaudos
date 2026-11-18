
from pathlib import Path
import sqlite3

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "dados" / "acquatec.db"

def connect():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys = ON")
    con.execute("PRAGMA journal_mode = WAL")
    return con

def initialize_database():
    with connect() as con:
        con.execute("""
            CREATE TABLE IF NOT EXISTS clientes (
                id TEXT PRIMARY KEY,
                cliente TEXT NOT NULL,
                cnpj TEXT NOT NULL DEFAULT '',
                endereco TEXT NOT NULL DEFAULT '',
                responsavel_tecnico TEXT NOT NULL DEFAULT '',
                criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                atualizado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """)
        con.execute("""
            CREATE TABLE IF NOT EXISTS medicoes (
                id TEXT PRIMARY KEY,
                cliente_id TEXT NOT NULL,
                data_coleta TEXT NOT NULL DEFAULT '',
                cloro_livre TEXT NOT NULL DEFAULT '',
                ph TEXT NOT NULL DEFAULT '',
                alcalinidade TEXT NOT NULL DEFAULT '',
                dureza_total TEXT NOT NULL DEFAULT '',
                temperatura TEXT NOT NULL DEFAULT '',
                aspecto_visual TEXT NOT NULL DEFAULT '',
                avaliacao_tecnica TEXT NOT NULL DEFAULT '',
                local_coleta TEXT NOT NULL DEFAULT '',
                dados_json TEXT NOT NULL DEFAULT '{}',
                criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
            )
        """)
        con.execute("""
            CREATE TABLE IF NOT EXISTS importacoes_medicoes (
                id TEXT PRIMARY KEY,
                nome_arquivo TEXT NOT NULL DEFAULT '',
                periodo_referencia TEXT NOT NULL DEFAULT '',
                quantidade INTEGER NOT NULL DEFAULT 0,
                importado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """)

        measurement_columns = {
            row["name"]: row["name"]
            for row in con.execute("PRAGMA table_info(medicoes)").fetchall()
        }
        for column, definition in {
            "lote_id": "TEXT NOT NULL DEFAULT ''",
            "periodo_referencia": "TEXT NOT NULL DEFAULT ''",
            "ano": "INTEGER",
            "mes": "INTEGER",
        }.items():
            if column not in measurement_columns:
                con.execute(f"ALTER TABLE medicoes ADD COLUMN {column} {definition}")

        con.execute("CREATE INDEX IF NOT EXISTS idx_medicoes_periodo ON medicoes(periodo_referencia)")
        con.execute("CREATE INDEX IF NOT EXISTS idx_medicoes_cliente_periodo ON medicoes(cliente_id, periodo_referencia)")
