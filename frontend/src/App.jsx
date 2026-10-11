import { useCallback, useEffect, useState } from "react";
import {
  Activity, CalendarDays, CheckCircle2, Clock3, LayoutDashboard,
  Menu, Plus, Search, Stethoscope, Trash2, Users, X
} from "lucide-react";
import "./index.css";

const API = (import.meta.env.VITE_API_URL || "http://127.0.0.1:5000").replace(/\/$/, "");

async function api(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

const today = new Date().toISOString().slice(0, 10);

export default function App() {
  const [page, setPage] = useState("Dashboard");
  const [dashboard, setDashboard] = useState({});
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [patientForm, setPatientForm] = useState({
    name: "", age: "", gender: "Female", phone: "", condition: ""
  });
  const [appointmentForm, setAppointmentForm] = useState({
    patient_id: "", doctor_id: "", appointment_date: today, reason: ""
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [d, p, doc, a] = await Promise.all([
        api("/api/dashboard"),
        api("/api/patients"),
        api("/api/doctors"),
        api("/api/appointments")
      ]);
      setDashboard(d);
      setPatients(p);
      setDoctors(doc);
      setAppointments(a);
      setError("");
    } catch (e) {
      setError(`${e.message}. Check that the Flask backend is running.`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const go = (name) => {
    setPage(name);
    setMenuOpen(false);
    setNotice("");
    setError("");
  };

  const flash = (message) => {
    setNotice(message);
    setError("");
    window.setTimeout(() => setNotice(""), 3500);
  };

  const changePatient = (e) =>
    setPatientForm({ ...patientForm, [e.target.name]: e.target.value });

  const changeAppointment = (e) =>
    setAppointmentForm({ ...appointmentForm, [e.target.name]: e.target.value });

  async function submitPatient(e) {
    e.preventDefault();
    try {
      const result = await api("/api/patients", {
        method: "POST",
        body: JSON.stringify({ ...patientForm, age: Number(patientForm.age) })
      });
      setPatientForm({ name: "", age: "", gender: "Female", phone: "", condition: "" });
      flash(result.message);
      await refresh();
    } catch (e) { setError(e.message); }
  }

  async function removePatient(id) {
    if (!window.confirm("Delete this patient?")) return;
    try {
      const result = await api(`/api/patients/${id}`, { method: "DELETE" });
      flash(result.message);
      await refresh();
    } catch (e) { setError(e.message); }
  }

  async function submitAppointment(e) {
    e.preventDefault();
    try {
      const result = await api("/api/appointments", {
        method: "POST",
        body: JSON.stringify({
          ...appointmentForm,
          patient_id: Number(appointmentForm.patient_id),
          doctor_id: Number(appointmentForm.doctor_id)
        })
      });
      setAppointmentForm({ patient_id: "", doctor_id: "", appointment_date: today, reason: "" });
      flash(result.message);
      await refresh();
    } catch (e) { setError(e.message); }
  }

  async function updateStatus(id, status) {
    try {
      const result = await api(`/api/appointments/${id}`, {
        method: "PATCH", body: JSON.stringify({ status })
      });
      flash(result.message);
      await refresh();
    } catch (e) { setError(e.message); }
  }

  const nav = [
    { name: "Dashboard", icon: LayoutDashboard },
    { name: "Patients", icon: Users },
    { name: "Doctors", icon: Stethoscope },
    { name: "Appointments", icon: CalendarDays }
  ];

  const filteredPatients = patients.filter(p =>
    `${p.name} ${p.phone} ${p.condition}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-icon"><Activity size={25} /></div>
          <div><h1>HealthEase</h1><span>Hospital Management</span></div>
          <button className="mobile-close" onClick={() => setMenuOpen(false)} aria-label="Close menu"><X /></button>
        </div>

        <p className="nav-label">MAIN MENU</p>
        <nav>
          {nav.map(({ name, icon: Icon }) => (
            <button key={name} className={`nav-item ${page === name ? "active" : ""}`} onClick={() => go(name)}>
              <Icon size={19} /><span>{name}</span>
              {name === "Appointments" && <span className="nav-count">{appointments.length}</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="help-card">
            <div className="help-icon"><Activity size={20} /></div>
            <strong>HealthEase Care</strong>
            <p>Organize patient care in one place.</p>
          </div>
          <div className="profile">
            <div className="avatar">HE</div>
            <div><strong>Administrator</strong><span>Hospital staff</span></div>
          </div>
        </div>
      </aside>

      {menuOpen && <button className="mobile-overlay" onClick={() => setMenuOpen(false)} aria-label="Close navigation" />}

      <main className="main-area">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMenuOpen(true)} aria-label="Open menu"><Menu /></button>
          <div className="breadcrumb">Workspace <span>/</span> <strong>{page}</strong></div>
          <div className="topbar-right"><span className="online-dot" /> System online <div className="top-avatar">HE</div></div>
        </header>

        <div className="content">
          <div className="page-heading">
            <div><p className="eyebrow">HOSPITAL WORKSPACE</p><h2>{page === "Dashboard" ? "Good day, Administrator" : page}</h2>
              <p className="subheading">{{
                Dashboard: "Here is your hospital overview for today.",
                Patients: "Register, search and manage patient records.",
                Doctors: "Meet your hospital's medical team.",
                Appointments: "Schedule visits and manage appointment status."
              }[page]}</p>
            </div>
            <div className="date-chip"><CalendarDays size={17} /> {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</div>
          </div>

          {notice && <div className="alert success"><CheckCircle2 size={18} />{notice}<button onClick={() => setNotice("")}><X size={16} /></button></div>}
          {error && <div className="alert danger">{error}<button onClick={() => setError("")}><X size={16} /></button></div>}

          {page === "Dashboard" && <>
            <section className="welcome-banner">
              <div className="welcome-art"><Activity size={74} strokeWidth={1.2} /></div>
              <div className="banner-copy"><span className="banner-tag">YOUR CARE, CONNECTED</span><h3>Better organization.<br />Better patient care.</h3><p>All your hospital essentials, in one simple workspace.</p></div>
              <div className="banner-actions"><button className="button button-white" onClick={() => go("Patients")}><Plus size={17} /> Register patient</button><button className="button button-outline" onClick={() => go("Appointments")}><CalendarDays size={17} /> Book appointment</button></div>
            </section>

            <section className="stats-grid">
              <Stat icon={Users} label="Total Patients" value={dashboard.patients ?? "—"} tone="blue" hint="Registered records" />
              <Stat icon={Stethoscope} label="Available Doctors" value={dashboard.doctors ?? "—"} tone="green" hint="Medical professionals" />
              <Stat icon={CalendarDays} label="Appointments" value={dashboard.appointments ?? "—"} tone="purple" hint="All scheduled visits" />
              <Stat icon={Clock3} label="Today's Visits" value={dashboard.today ?? "—"} tone="orange" hint="Appointments today" />
            </section>

            <section className="panel">
              <div className="panel-heading"><div><h3>Recent appointments</h3><p>Latest scheduled patient visits</p></div><button className="text-button" onClick={() => go("Appointments")}>View all <span>→</span></button></div>
              <AppointmentTable items={dashboard.recent || []} onStatus={updateStatus} />
              {!dashboard.recent?.length && !loading && <EmptyState title="No appointments yet" text="Book your first appointment to see it here." />}
            </section>
          </>}

          {page === "Patients" && <div className="two-column">
            <section className="panel form-panel">
              <div className="panel-heading"><div><h3>Register patient</h3><p>Add a new patient record</p></div><span className="panel-icon"><Plus /></span></div>
              <form onSubmit={submitPatient} className="data-form">
                <Field label="Patient full name"><input name="name" value={patientForm.name} onChange={changePatient} placeholder="Enter full name" required maxLength={100} /></Field>
                <div className="form-row">
                  <Field label="Age"><input name="age" type="number" min="0" max="120" value={patientForm.age} onChange={changePatient} placeholder="Age" required /></Field>
                  <Field label="Gender"><select name="gender" value={patientForm.gender} onChange={changePatient}><option>Female</option><option>Male</option><option>Other</option><option>Prefer not to say</option></select></Field>
                </div>
                <Field label="Phone number"><input name="phone" type="tel" value={patientForm.phone} onChange={changePatient} placeholder="Contact number" required maxLength={20} /></Field>
                <Field label="Condition / reason"><input name="condition" value={patientForm.condition} onChange={changePatient} placeholder="e.g. General check-up" required maxLength={200} /></Field>
                <button className="button button-primary button-full" type="submit"><Plus size={18} /> Register patient</button>
              </form>
            </section>

            <section className="panel">
              <div className="panel-heading"><div><h3>Patient directory</h3><p>{patients.length} registered patient(s)</p></div></div>
              <div className="search-box"><Search size={18} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, phone or condition..." /></div>
              <div className="patient-list">
                {filteredPatients.map(p => <div className="patient-row" key={p.id}>
                  <div className="patient-avatar">{p.name.split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase()}</div>
                  <div className="patient-info"><strong>{p.name}</strong><span>{p.age} yrs · {p.gender} · {p.phone}</span><small>{p.condition}</small></div>
                  <button className="icon-button delete-button" onClick={() => removePatient(p.id)} title="Delete patient" aria-label={`Delete ${p.name}`}><Trash2 size={17} /></button>
                </div>)}
                {!filteredPatients.length && <EmptyState title="No patients found" text="Register a patient or try another search." />}
              </div>
            </section>
          </div>}

          {page === "Doctors" && <section className="panel">
            <div className="panel-heading"><div><h3>Medical team</h3><p>{doctors.length} doctors available</p></div><span className="panel-icon"><Stethoscope /></span></div>
            <div className="doctor-grid">{doctors.map(d => <div className="doctor-card" key={d.id}>
              <div className="doctor-avatar"><Stethoscope size={26} /></div><span className="doctor-status"><span /> Available</span><h4>{d.name}</h4><p>{d.specialization}</p><div className="doctor-contact">{d.phone}</div>
              <button className="button button-soft button-full" onClick={() => { setAppointmentForm(f => ({ ...f, doctor_id: String(d.id) })); go("Appointments"); }}>Book appointment <span>→</span></button>
            </div>)}</div>
          </section>}

          {page === "Appointments" && <div className="two-column appointment-layout">
            <section className="panel form-panel">
              <div className="panel-heading"><div><h3>Book appointment</h3><p>Schedule a patient visit</p></div><span className="panel-icon"><CalendarDays /></span></div>
              <form onSubmit={submitAppointment} className="data-form">
                <Field label="Select patient"><select required value={appointmentForm.patient_id} name="patient_id" onChange={changeAppointment}><option value="">Choose a patient</option>{patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
                <Field label="Select doctor"><select required value={appointmentForm.doctor_id} name="doctor_id" onChange={changeAppointment}><option value="">Choose a doctor</option>{doctors.map(d => <option key={d.id} value={d.id}>{d.name} — {d.specialization}</option>)}</select></Field>
                <Field label="Appointment date"><input type="date" name="appointment_date" min={today} value={appointmentForm.appointment_date} onChange={changeAppointment} required /></Field>
                <Field label="Reason for visit"><textarea name="reason" rows="3" value={appointmentForm.reason} onChange={changeAppointment} placeholder="Describe the reason for visit..." required maxLength={500} /></Field>
                <button className="button button-primary button-full" type="submit"><CalendarDays size={18} /> Confirm appointment</button>
                {!patients.length && <p className="form-note">Register a patient before booking an appointment.</p>}
              </form>
            </section>
            <section className="panel">
              <div className="panel-heading"><div><h3>Appointment schedule</h3><p>{appointments.length} total visit(s)</p></div></div>
              <AppointmentTable items={appointments} onStatus={updateStatus} />
              {!appointments.length && <EmptyState title="Your schedule is clear" text="New appointments will appear here." />}
            </section>
          </div>}

          {loading && <p className="loading-note">Loading hospital records…</p>}
          <footer className="footer"><span>© {new Date().getFullYear()} HealthEase</span><span><span className="online-dot" /> Hospital management workspace</span></footer>
        </div>
      </main>
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone, hint }) {
  return <div className="stat-card"><div className={`stat-icon ${tone}`}><Icon size={21} /></div><p>{label}</p><strong>{value}</strong><span>{hint}</span></div>;
}

function Field({ label, children }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}

function EmptyState({ title, text }) {
  return <div className="empty-state"><div className="empty-icon"><CalendarDays size={23} /></div><strong>{title}</strong><p>{text}</p></div>;
}

function AppointmentTable({ items, onStatus }) {
  if (!items.length) return null;
  return <div className="table-wrap"><table><thead><tr><th>Patient / Doctor</th><th>Date</th><th>Reason</th><th>Status</th></tr></thead>
    <tbody>{items.map(a => <tr key={a.id}>
      <td><strong>{a.patient_name}</strong><small className="table-sub">{a.doctor_name}</small></td>
      <td>{a.appointment_date}</td><td className="reason-cell">{a.reason}</td>
      <td><select className={`status-select status-${a.status.toLowerCase()}`} value={a.status} onChange={e => onStatus(a.id, e.target.value)} aria-label={`Status for appointment ${a.id}`}><option>Scheduled</option><option>Completed</option><option>Cancelled</option></select></td>
    </tr>)}</tbody>
  </table></div>;
}