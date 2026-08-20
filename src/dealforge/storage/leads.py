import sqlite3
import json
from dealforge.models import Lead

class SQLiteLeadStore:
    def __init__(self, db_path: str = "dealforge.db"):
        self.db_path = db_path
        self._init_db()

    def _init_db(self):
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS leads (
                    id TEXT PRIMARY KEY,
                    user_id TEXT,
                    doc_id TEXT,
                    email TEXT,
                    name TEXT,
                    consent BOOLEAN
                )
            """)
            conn.commit()

    async def save(self, lead: Lead) -> None:
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT OR REPLACE INTO leads (id, user_id, doc_id, email, name, consent)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (lead.id, lead.user_id, lead.doc_id, lead.email, lead.name, lead.consent))
            conn.commit()

    async def get(self, id: str) -> Lead | None:
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id, user_id, doc_id, email, name, consent FROM leads WHERE id = ?", (id,))
            row = cursor.fetchone()
            if row:
                return Lead(
                    id=row[0],
                    user_id=row[1],
                    doc_id=row[2],
                    email=row[3],
                    name=row[4],
                    consent=bool(row[5])
                )
            return None
