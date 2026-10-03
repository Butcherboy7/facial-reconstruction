import sqlite3, json, pathlib, time
P = pathlib.Path(__file__).parent / "data" / "app.db"
SQL = """
CREATE TABLE IF NOT EXISTS cases(id TEXT PRIMARY KEY, name TEXT, date TEXT, location TEXT, investigator TEXT,
  incident_type TEXT, description TEXT, notes TEXT, profile TEXT DEFAULT '{}', final_image TEXT, status TEXT DEFAULT 'open', created REAL);
CREATE TABLE IF NOT EXISTS versions(id INTEGER PRIMARY KEY AUTOINCREMENT, case_id TEXT, n INTEGER, profile TEXT, prompt TEXT,
  mode TEXT, candidates TEXT, selected INTEGER, created REAL);
CREATE TABLE IF NOT EXISTS assets(id INTEGER PRIMARY KEY AUTOINCREMENT, case_id TEXT, kind TEXT, label TEXT, path TEXT, meta TEXT, created REAL);
CREATE TABLE IF NOT EXISTS refs(id TEXT PRIMARY KEY, path TEXT, embedding BLOB, note TEXT);
CREATE TABLE IF NOT EXISTS searches(id INTEGER PRIMARY KEY AUTOINCREMENT, case_id TEXT, query_path TEXT, mode TEXT, results TEXT, stages TEXT, created REAL);
"""


def conn():
    c = sqlite3.connect(P); c.row_factory = sqlite3.Row; return c


def init():
    with conn() as c: c.executescript(SQL)


def q(sql, args=(), one=False):
    with conn() as c:
        r = c.execute(sql, args)
        rows = [dict(x) for x in r.fetchall()] if r.description else []
        c.commit()
        return (rows[0] if rows else None) if one else rows


def ins(sql, args=()):
    with conn() as c:
        cur = c.execute(sql, args); c.commit(); return cur.lastrowid
