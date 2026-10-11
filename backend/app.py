import os
import sqlite3
from datetime import date
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)

frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:5173")
CORS(app, resources={r"/api/*": {"origins": [
    "http://localhost:5173",
    frontend_url
]}})

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.environ.get("DB_PATH", os.path.join(BASE_DIR, "healthease.db"))


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    with get_db() as db:
        db.executescript("""
        CREATE TABLE IF NOT EXISTS patients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            age INTEGER NOT NULL,
            gender TEXT NOT NULL,
            phone TEXT NOT NULL,
            condition TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS doctors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            specialization TEXT NOT NULL,
            phone TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS appointments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_id INTEGER NOT NULL,
            doctor_id INTEGER NOT NULL,
            appointment_date TEXT NOT NULL,
            reason TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'Scheduled',
            FOREIGN KEY(patient_id) REFERENCES patients(id),
            FOREIGN KEY(doctor_id) REFERENCES doctors(id)
        );
        """)

        if db.execute("SELECT COUNT(*) FROM doctors").fetchone()[0] == 0:
            db.executemany("""
                INSERT INTO doctors (name, specialization, phone)
                VALUES (?, ?, ?)
            """, [
                ("Dr. Ananya Rao", "Cardiology", "9876501001"),
                ("Dr. Rahul Sharma", "General Medicine", "9876501002"),
                ("Dr. Priya Reddy", "Pediatrics", "9876501003"),
                ("Dr. Kiran Kumar", "Dermatology", "9876501004")
            ])


init_db()


@app.get("/")
def home():
    return jsonify({
        "message": "Welcome to HealthEase API",
        "status": "running"
    })


@app.get("/api/dashboard")
def dashboard():
    with get_db() as db:
        patients = db.execute("SELECT COUNT(*) FROM patients").fetchone()[0]
        doctors = db.execute("SELECT COUNT(*) FROM doctors").fetchone()[0]
        appointments = db.execute("SELECT COUNT(*) FROM appointments").fetchone()[0]
        today = db.execute(
            "SELECT COUNT(*) FROM appointments WHERE appointment_date = ?",
            (date.today().isoformat(),)
        ).fetchone()[0]

        recent = db.execute("""
            SELECT a.id, p.name AS patient_name, d.name AS doctor_name,
                   a.appointment_date, a.reason, a.status
            FROM appointments a
            JOIN patients p ON p.id = a.patient_id
            JOIN doctors d ON d.id = a.doctor_id
            ORDER BY a.id DESC LIMIT 5
        """).fetchall()

    return jsonify({
        "patients": patients,
        "doctors": doctors,
        "appointments": appointments,
        "today": today,
        "recent": [dict(row) for row in recent]
    })


@app.get("/api/patients")
def get_patients():
    search = request.args.get("search", "").strip()
    with get_db() as db:
        rows = db.execute("""
            SELECT * FROM patients
            WHERE name LIKE ? OR phone LIKE ?
            ORDER BY id DESC
        """, (f"%{search}%", f"%{search}%")).fetchall()
    return jsonify([dict(row) for row in rows])


@app.post("/api/patients")
def add_patient():
    data = request.get_json(silent=True) or {}
    name = str(data.get("name", "")).strip()
    gender = str(data.get("gender", "")).strip()
    condition = str(data.get("condition", "")).strip()
    phone = str(data.get("phone", "")).strip()

    try:
        age = int(data.get("age", 0))
    except (TypeError, ValueError):
        return jsonify({"error": "Enter a valid age"}), 400

    if not all([name, gender, condition, phone]):
        return jsonify({"error": "All fields are required"}), 400
    if not 0 <= age <= 120:
        return jsonify({"error": "Age must be between 0 and 120"}), 400

    with get_db() as db:
        cursor = db.execute("""
            INSERT INTO patients (name, age, gender, phone, condition)
            VALUES (?, ?, ?, ?, ?)
        """, (name, age, gender, phone, condition))

    return jsonify({
        "message": "Patient registered successfully",
        "id": cursor.lastrowid
    }), 201


@app.delete("/api/patients/<int:patient_id>")
def delete_patient(patient_id):
    with get_db() as db:
        linked = db.execute(
            "SELECT COUNT(*) FROM appointments WHERE patient_id = ?",
            (patient_id,)
        ).fetchone()[0]

        if linked:
            return jsonify({
                "error": "This patient has appointments. Cancel those first."
            }), 409

        cursor = db.execute("DELETE FROM patients WHERE id = ?", (patient_id,))
        if cursor.rowcount == 0:
            return jsonify({"error": "Patient not found"}), 404

    return jsonify({"message": "Patient deleted"})


@app.get("/api/doctors")
def get_doctors():
    with get_db() as db:
        rows = db.execute("SELECT * FROM doctors ORDER BY name").fetchall()
    return jsonify([dict(row) for row in rows])


@app.get("/api/appointments")
def get_appointments():
    with get_db() as db:
        rows = db.execute("""
            SELECT a.id, a.patient_id, a.doctor_id,
                   p.name AS patient_name, d.name AS doctor_name,
                   d.specialization, a.appointment_date,
                   a.reason, a.status
            FROM appointments a
            JOIN patients p ON p.id = a.patient_id
            JOIN doctors d ON d.id = a.doctor_id
            ORDER BY a.appointment_date DESC, a.id DESC
        """).fetchall()
    return jsonify([dict(row) for row in rows])


@app.post("/api/appointments")
def add_appointment():
    data = request.get_json(silent=True) or {}

    try:
        patient_id = int(data.get("patient_id", 0))
        doctor_id = int(data.get("doctor_id", 0))
    except (TypeError, ValueError):
        return jsonify({"error": "Select a patient and doctor"}), 400

    appointment_date = str(data.get("appointment_date", "")).strip()
    reason = str(data.get("reason", "")).strip()

    if not appointment_date or not reason:
        return jsonify({"error": "All fields are required"}), 400

    try:
        date.fromisoformat(appointment_date)
    except ValueError:
        return jsonify({"error": "Invalid appointment date"}), 400

    with get_db() as db:
        patient = db.execute(
            "SELECT id FROM patients WHERE id = ?", (patient_id,)
        ).fetchone()
        doctor = db.execute(
            "SELECT id FROM doctors WHERE id = ?", (doctor_id,)
        ).fetchone()

        if not patient or not doctor:
            return jsonify({"error": "Patient or doctor not found"}), 400

        cursor = db.execute("""
            INSERT INTO appointments
            (patient_id, doctor_id, appointment_date, reason)
            VALUES (?, ?, ?, ?)
        """, (patient_id, doctor_id, appointment_date, reason))

    return jsonify({
        "message": "Appointment booked successfully",
        "id": cursor.lastrowid
    }), 201


@app.patch("/api/appointments/<int:appointment_id>")
def update_appointment(appointment_id):
    data = request.get_json(silent=True) or {}
    status = data.get("status")

    if status not in ["Scheduled", "Completed", "Cancelled"]:
        return jsonify({"error": "Invalid appointment status"}), 400

    with get_db() as db:
        cursor = db.execute(
            "UPDATE appointments SET status = ? WHERE id = ?",
            (status, appointment_id)
        )
        if cursor.rowcount == 0:
            return jsonify({"error": "Appointment not found"}), 404

    return jsonify({"message": "Appointment updated"})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)