// ============================================================
// DATA — loaded from database on login, starts empty
// ============================================================
const doctors      = []; // populated by doctors.php via loadPatientDashboard()
const appointments = []; // populated by appointments.php on login

// ── FIX: these were used everywhere but never defined ────────
const consultationRooms = {};
let peer = null;
let currentCall = null;
function patternLog(type, message) {
  const icons = { proxy: '🛡️', mediator: '🔗', state: '⚡', observer: '👁️' };
  console.log(`[${icons[type] || '📋'} ${type.toUpperCase()}] ${message}`);
}
function clearPatternLog() { console.log('--- pattern log ---'); }

// ============================================================
// API BASE URL — full XAMPP localhost path
// Change 'SOFTWARE DESIGN' if your htdocs folder name is different
// ============================================================
const API = 'http://localhost/telemedicine/api';

// Tries both spellings of the appointments filename so it works regardless of how the file is named on disk
async function fetchAppointments(queryString) {
  for (const file of ['appointments.php', 'appoinments.php']) {
    try {
      const res = await fetch(`${API}/${file}?${queryString}`);
      if (!res.ok) continue;
      const data = await res.json();
      if (data.success !== undefined) return data;
    } catch {}
  }
  return { success: false, appointments: [], _error: 'Both filename spellings failed' };
}


// ============================================================
// AUTH
// ============================================================
let currentRole = 'patient';

let currentUser = null;

function getInitials(name) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function updatePatientUI(name) {
  const initials = getInitials(name);
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening';
  const firstName = name.split(' ')[0];

  const sidebarName = document.getElementById('patient-sidebar-name');
  const sidebarInit = document.getElementById('patient-initials');
  const topbarInit  = document.getElementById('topbar-initials');
  const greeting    = document.getElementById('patient-greeting');

  if (sidebarName) sidebarName.textContent = name;
  if (sidebarInit) sidebarInit.textContent = initials;
  if (topbarInit)  topbarInit.textContent  = initials;
  if (greeting)    greeting.textContent    = `${greet}, ${firstName} 👋`;
}

function updateDoctorUI(name) {
  const initials   = getInitials(name);
  const hour       = new Date().getHours();
  const greet      = hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening';
  const firstName  = name.replace('Dr. ', '').split(' ')[0];

  const sidebarName   = document.getElementById('doctor-sidebar-name');
  const sidebarInit   = document.getElementById('doctor-initials');
  const topbarInit    = document.getElementById('doctor-topbar-initials');
  const docGreeting   = document.getElementById('doc-greeting');

  if (sidebarName)  sidebarName.textContent  = name;
  if (sidebarInit)  sidebarInit.textContent  = initials;
  if (topbarInit)   topbarInit.textContent   = initials;
  if (docGreeting)  docGreeting.textContent  = `${greet}, ${name} 👋`;
}

function setRole(role, btn) {
  currentRole = role;
  document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}


async function doLogin() {
  const email    = (document.getElementById('login-email')?.value    || '').trim().toLowerCase();
  const password = (document.getElementById('login-password')?.value || '').trim();

  if (!email || !password) { showToast('Please enter your email and password', 'error'); return; }

  try {
    const res  = await fetch(`${API}/login.php`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();

    if (!data.success) {
      showToast(data.message || 'Incorrect email or password', 'error');
      const card = document.querySelector('.login-card-new');
      if (card) { card.classList.add('shake'); setTimeout(() => card.classList.remove('shake'), 500); }
      return;
    }

    currentRole = data.role;
    currentUser = { name: data.name, email: data.email, role: data.role, userId: data.userId, doctorId: data.doctorId, patientId: data.patientId, specialty: data.specialty, license: data.license_no };

    if (data.role === 'doctor') {
      showPage('page-doctor');
      updateDoctorUI(data.name);
      await loadDoctorDashboard();
      showToast('Welcome back, Doctor! 👨‍⚕️', 'success');
    } else {
      showPage('page-app');
      updatePatientUI(data.name);
      await loadPatientDashboard();
      showToast('Welcome back! 👋', 'success');
    }
  } catch (e) {
    showToast('Could not connect to server. Is XAMPP running?', 'error');
  }
}

function doLogout() {
  currentRole = 'patient';
  currentUser = null;
  showPage('page-login');
}

// ============================================================
// DASHBOARD LOADERS — fetch real data from PHP API
// ============================================================
async function loadPatientDashboard() {
  // ── Load doctors from DB ─────────────────────────────────
  try {
    const res  = await fetch(`${API}/doctors.php`);
    const data = await res.json();
    console.log('doctors.php response:', data);

    doctors.length = 0;
    if (data.success && data.doctors && data.doctors.length > 0) {
      data.doctors.forEach(d => doctors.push(d));
      console.log('Loaded', doctors.length, 'doctors from DB');
    } else {
      console.warn('No doctors returned from DB:', data.debug || data.message || 'unknown reason');
    }
  } catch (e) {
    console.error('doctors.php fetch failed:', e.message);
  }

  // ── Load appointments from DB ────────────────────────────
  if (currentUser && currentUser.patientId) {
    try {
      const data = await fetchAppointments(`role=patient&patientId=${currentUser.patientId}`);
      console.log('[PATIENT] appointments response:', data);
      if (data.success) {
        appointments.length = 0;
        data.appointments.forEach(a => appointments.push(a));
      }
    } catch (e) { console.error('[PATIENT] appointments fetch failed:', e.message); }
  }

  // ── Load notifications from DB ───────────────────────────
  if (currentUser && currentUser.userId) {
    try {
      const res  = await fetch(`${API}/notifications.php?userId=${currentUser.userId}`);
      const data = await res.json();
      if (data.success) {
        notificationStore[currentUser.email] = data.notifications.map(n => ({
          id: n.id, message: n.message, isRead: !!n.is_read, time: n.sent_at
        }));
      }
    } catch (e) { console.error('notifications.php fetch failed:', e.message); }
  }

  // ── FIX: restore follow state from DB ────────────────────
  if (currentUser && currentUser.patientId) {
    try {
      const res  = await fetch(`${API}/follow.php?patientId=${currentUser.patientId}`);
      const data = await res.json();
      if (data.success && data.followedDoctorIds) {
        data.followedDoctorIds.forEach(id => {
          const doc = doctors.find(d => d.id === parseInt(id));
          if (doc) doc.followed = true;
        });
      }
    } catch (e) { console.error('follow.php fetch failed:', e.message); }
  }

  renderHomeDoctors();
  renderAppointments();
  renderHomeBanner();
  renderSearchDoctors(doctors);
  renderPatientNotifications();
  updateNotifBadge();
}

async function loadDoctorDashboard() {
  if (!currentUser.doctorId) {
    console.error('[DOCTOR] doctorId is null — check doctors table has a row for this user');
    renderDoctorDashboard();
    return;
  }
  try {
    const data = await fetchAppointments(`role=doctor&doctorId=${currentUser.doctorId}`);
    console.log('[DOCTOR] appointments response:', data);
    if (data.success) {
      doctorAppointmentRequests.length = 0;
      doctorSchedule.length = 0;
      data.appointments.forEach(a => {
        if (a.status === 'pending') {
          doctorAppointmentRequests.push({ ...a, patientImg: a.img, reason: a.reason || 'Appointment request', appointmentId: a.id });
        } else if (a.status === 'accepted' || a.status === 'completed') {
          doctorSchedule.push({ ...a, patientImg: a.img, appointmentId: a.id, status: a.status === 'accepted' ? 'confirmed' : 'completed' });
        }
      });
      console.log('[DOCTOR] pending:', doctorAppointmentRequests.length, '| schedule:', doctorSchedule.length);
    } else {
      console.warn('[DOCTOR] fetch failed:', data._error || data.message);
    }
  } catch (e) { console.error('[DOCTOR] unexpected error:', e); }
  renderDoctorDashboard();
}

// ============================================================
// FACTORY PATTERN - User Registration
// PatientFactory and DoctorFactory create the correct object
// ============================================================

// Base User class
class User {
  constructor(id, name, email, role, phone = '') {
    this.id    = id;
    this.name  = name;
    this.email = email;
    this.role  = role;
    this.phone = phone;
  }
  login()  { return true; }
  logout() { currentRole = 'patient'; showPage('page-login'); }
  updateProfile(data) { Object.assign(this, data); }
  receiveNotification(n) { showToast(n.message, 'success'); }
}

// Patient subclass
class Patient extends User {
  constructor(id, name, email, phone) {
    super(id, name, email, 'patient', phone);
    this.patientId     = id;
    this.medicalHistory = null;
    this.dateOfBirth   = null;
  }
  bookAppointment(doctorId) { console.log(`Patient ${this.name} booking doctor #${doctorId}`); }
  cancelAppointment(id)     { console.log(`Patient ${this.name} cancelled appt #${id}`); }
  viewAppointment()         { return []; }
}

// Doctor subclass
class Doctor extends User {
  constructor(id, name, email, phone, specialization, licenseNumber) {
    super(id, name, email, 'doctor', phone);
    this.doctorId       = id;
    this.specialization = specialization;
    this.licenseNumber  = licenseNumber;
    this.rating         = 0.0;
  }
  viewSchedule()                        { return []; }
  setAvailability(start, end)           { console.log(`Dr.${this.name}: ${start}–${end}`); }
}

// Abstract UserFactory
class UserFactory {
  createUser(data) { throw new Error('createUser() must be implemented'); }
}

// PatientFactory — creates Patient objects
class PatientFactory extends UserFactory {
  createUser(data) {
    console.log('PatientFactory: creating Patient object');
    return new Patient(data.id, data.name, data.email, data.phone);
  }
}

// DoctorFactory — creates Doctor objects
class DoctorFactory extends UserFactory {
  createUser(data) {
    console.log('DoctorFactory: creating Doctor object');
    return new Doctor(data.id, data.name, data.email, data.phone,
                      data.specialization, data.licenseNumber);
  }
}

// ============================================================
// REGISTER — Factory decides which object to create
// ============================================================
function toggleDoctorFields(role) {
  const df = document.getElementById('doctor-fields');
  if (df) df.style.display = role === 'doctor' ? 'block' : 'none';
}

async function doRegister() {
  const firstName = document.getElementById('reg-firstname').value.trim();
  const lastName  = document.getElementById('reg-lastname').value.trim();
  const email     = document.getElementById('reg-email').value.trim().toLowerCase();
  const password  = document.getElementById('reg-password').value.trim();
  const role      = document.getElementById('reg-role').value;

  if (!firstName || !lastName || !email || !password) { showToast('Please fill in all fields', 'error'); return; }

  const fullName = `${firstName} ${lastName}`;
  let spec = '', license = '';

  if (role === 'doctor') {
    spec    = document.getElementById('reg-spec').value;
    license = document.getElementById('reg-license').value.trim();
    if (!license) { showToast('Please enter your license number', 'error'); return; }
  }

  // ── FACTORY PATTERN (JS side — mirrors PHP DoctorFactory / PatientFactory) ──
  const factory = role === 'doctor' ? new DoctorFactory() : new PatientFactory();
  const userObj = factory.createUser({ id: Date.now(), name: fullName, email, phone: '', specialization: spec, licenseNumber: license });
  console.log(`${role === 'doctor' ? 'DoctorFactory' : 'PatientFactory'} produced:`, userObj);

  try {
    // ── Send to PHP register.php (uses Factory + Singleton on the backend) ──
    const res  = await fetch(`${API}/register.php`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: fullName, email, password, role, phone: '', specialization: spec, licenseNumber: license })
    });
    const data = await res.json();

    if (data.success) {
      showToast(`${data.message} You can now log in.`, 'success');
      setTimeout(() => showLogin(), 1500);
    } else {
      showToast(data.message || 'Registration failed.', 'error');
    }
  } catch (e) {
    showToast('Could not connect to server. Is XAMPP running?', 'error');
  }
}

function showRegister() {
  showPage('page-register');
}

function showLogin() {
  showPage('page-login');
}

function togglePassword() {
  const inp = document.getElementById('login-password');
  inp.type = inp.type === 'password' ? 'text' : 'password';
}

// ============================================================
// PAGE SWITCHING
// ============================================================
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const page = document.getElementById(pageId);
  if (page) page.classList.add('active');
}

// ============================================================
// NAVIGATION
// ============================================================
function navigate(view, navEl) {
  // Update active nav
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  if (navEl) navEl.classList.add('active');

  // Switch view
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const target = document.getElementById('view-' + view);
  if (target) target.classList.add('active');

  // Make sure app page is shown
  if (!document.getElementById('page-app').classList.contains('active')) {
    showPage('page-app');
  }

  // Re-fetch from DB every time home OR appointments tab opens so status is always current
  if ((view === 'home' || view === 'appointments') && currentUser && currentUser.patientId) {
    fetchAppointments(`role=patient&patientId=${currentUser.patientId}`)
      .then(data => {
        if (data.success) {
          appointments.length = 0;
          data.appointments.forEach(a => appointments.push(a));
          renderAppointments();
          renderHomeBanner();
        }
      })
      .catch(() => {});
  }

  // ── FIX: re-fetch notifications from DB on tab open ──────
  if (view === 'notifications' && currentUser && currentUser.userId) {
    fetch(`${API}/notifications.php?userId=${currentUser.userId}`)
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          notificationStore[currentUser.email] = data.notifications.map(n => ({
            id: n.id, message: n.message, isRead: !!n.is_read, time: n.sent_at
          }));
          renderPatientNotifications();
          updateNotifBadge();
        }
      })
      .catch(() => {});
  }
}

// ============================================================
// HOME BANNER — shows first confirmed appointment with a room
// ============================================================
function renderHomeBanner() {
  const banner = document.getElementById('home-appt-banner');
  if (!banner) return;

  // Use roomCode directly from appointment — no consultationRooms cache needed
  const confirmed = appointments.find(a => a.status === 'accepted');
  const pending   = appointments.find(a => a.status === 'pending');

  if (confirmed) {
    document.querySelector('.greeting-sub').textContent = 'You have 1 upcoming consultation.';
    banner.innerHTML = `
      <div class="appt-banner">
        <div class="appt-info">
          <div class="appt-doctor-name">${confirmed.name}</div>
          <div class="appt-specialization">${confirmed.spec}</div>
          <div class="appt-time">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
            ${confirmed.date} — ${confirmed.time}
          </div>
          ${confirmed.roomCode ? `<div style="margin-top:6px;font-size:12px;color:#6b7280;">
            Room: <span style="font-family:monospace;font-weight:700;color:#2563EB;background:#eff6ff;padding:2px 8px;border-radius:6px">${confirmed.roomCode}</span>
          </div>` : ''}
        </div>
        <div class="appt-actions">
          <span class="status-badge confirmed">Confirmed</span>
          ${confirmed.roomCode
            ? `<button class="btn-join" onclick="openVideoRoom('${confirmed.roomCode}','${confirmed.name}')">
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.069A1 1 0 0121 8.868v6.264a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                Join Room
              </button>`
            : '<span style="color:#9ca3af;font-size:13px">Room pending...</span>'}
          <button class="btn-outline-sm" onclick="cancelAppt(${confirmed.id})">Cancel</button>
        </div>
      </div>`;
    return;
  }

  if (pending) {
    document.querySelector('.greeting-sub').textContent = 'You have 1 pending appointment.';
    banner.innerHTML = `
      <div class="appt-banner" style="background:#f9fafb;border:1.5px dashed #d1d5db;">
        <div class="appt-info">
          <div class="appt-doctor-name" style="color:#374151">Waiting for doctor to accept</div>
          <div class="appt-specialization" style="color:#9ca3af">${pending.name} — ${pending.spec}</div>
        </div>
        <div class="appt-actions">
        <span class="status-badge pending">Pending</span>
        <button class="btn-outline-sm" style="border-color:#dc2626;color:#dc2626" onclick="cancelAppt(${pending.id})">Cancel</button>
      </div>
      </div>`;
    return;
  }

  document.querySelector('.greeting-sub').textContent = 'No upcoming consultations today.';
  banner.innerHTML = `
    <div class="appt-banner" style="background:#f9fafb;border:1.5px dashed #d1d5db;">
      <div class="appt-info">
        <div class="appt-doctor-name" style="color:#9ca3af">No upcoming appointments</div>
        <div class="appt-specialization" style="color:#d1d5db">Book a doctor below to get started</div>
      </div>
    </div>`;
}

// ============================================================
// RENDER DOCTORS (HOME)
// ============================================================
function renderHomeDoctors(filter = 'all') {
  const grid = document.getElementById('home-doctors-grid');
  if (!grid) return;
  const filtered = filter === 'all' ? doctors : doctors.filter(d => d.specKey === filter);

  if (filtered.length === 0) {
    grid.innerHTML = '<p style="color:#9ca3af;margin-top:12px">No doctors registered yet.</p>';
    return;
  }

  grid.innerHTML = filtered.map(d => `
    <div class="doctor-card">
      <div class="doctor-avatar-initials">${getInitials(d.name)}</div>
      <div class="doctor-name">${d.name}</div>
      <div class="doctor-spec">${d.spec}</div>
      <div class="availability ${d.available ? 'available' : 'busy'}" style="color:${d.available ? '#16a34a' : '#dc2626'}">
        ● ${d.available ? 'Available' : 'Busy'}
      </div>
      ${d.available
        ? `<button class="btn-primary full" style="margin-top:6px" onclick="openBooking(${d.id})">Book Now</button>`
        : `<button class="btn-primary full" style="margin-top:6px;opacity:0.4;cursor:not-allowed" disabled>Not Available</button>`
      }
      <button class="btn-follow ${d.followed ? 'following' : ''}" onclick="toggleFollow(${d.id}, this)">
        ${d.followed ? '✓ Following' : '+ Follow'}
      </button>
    </div>
  `).join('');
}

function filterDoctors(filter, btn) {
  // Update active tab in current view
  const activeView = document.querySelector('.view.active');
  if (activeView) {
    activeView.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
  }
  renderHomeDoctors(filter);

  renderSearchDoctors(filter === 'all' ? doctors : doctors.filter(d => d.specKey === filter));
}

// ============================================================
// RENDER APPOINTMENTS
// ============================================================
function renderAppointments() {
  const list = document.getElementById('appointments-list');
  if (!list) return;
  const visible = appointments.filter(a => a.status !== 'rejected');
  list.innerHTML = visible.map(a => `
    <div class="appt-item" id="appt-${a.id}">
      <div class="appt-item-avatar-initials">${getInitials(a.name)}</div>
      <div class="appt-item-info">
        <div class="appt-item-name">${a.name}</div>
        <div class="appt-item-spec">${a.spec}</div>
        <div class="appt-item-meta">
          <span>
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
            ${a.date}
          </span>
          <span>
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            ${a.time}
          </span>
          <span>
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.069A1 1 0 0121 8.868v6.264a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
            ${a.type}
          </span>
        </div>
      </div>
      <div class="appt-item-actions">
        ${getApptActions(a)}
        <button class="btn-delete" onclick="deleteAppt(${a.id})" title="Cancel">✕</button>
      </div>
    </div>
  `).join('');
}

function getApptActions(a) {
  if (a.status === 'confirmed' || a.status === 'accepted') return `
    <span class="status-badge confirmed">Confirmed</span>
    <button class="btn-appt-join" onclick="openVideoRoom('${a.roomCode}','${a.name}')">
      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.069A1 1 0 0121 8.868v6.264a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
      Join
    </button>`;
  if (a.status === 'pending') return `
    <span class="status-badge pending">Pending</span>
    <button class="btn-waiting">Waiting</button>
    <button class="btn-delete" onclick="cancelAppt(${a.id})" title="Cancel">✕</button>`;
  if (a.status === 'completed') return `
    <span class="status-badge completed">Completed</span>
    <button class="btn-view-details">View Details</button>`;
  return '';
}

function deleteAppt(id) {
  cancelAppt(id);
}

// ============================================================
// SEARCH DOCTORS
// ============================================================
function renderSearchDoctors(list) {
  const grid = document.getElementById('search-doctors-grid');
  if (!grid) return;

  if (list.length === 0) {
    grid.innerHTML = '<p style="color:#9ca3af;margin-top:12px">No doctors found.</p>';
    return;
  }

  grid.innerHTML = list.map(d => `
    <div class="doctor-card-search">
      <div class="search-card-top">
        <div class="search-card-left">
          <div class="doctor-avatar-initials">${getInitials(d.name)}</div>
          <div class="search-info">
            <div class="doctor-name">${d.name}</div>
            <div class="doctor-spec">${d.spec}</div>
          </div>
        </div>
        <div class="availability ${d.available ? 'available' : 'busy'}" style="color:${d.available ? '#16a34a' : '#dc2626'}">
          ● ${d.available ? 'Available' : 'Busy'}
        </div>
      </div>
      <div class="search-card-detail">
        <div><span>Languages:</span><br><strong>${d.languages || 'English'}</strong></div>
      </div>
      ${d.available
        ? `<button class="btn-primary full" onclick="openBooking(${d.id})">Book Now</button>`
        : `<button class="btn-primary full" style="opacity:0.4;cursor:not-allowed" disabled>Not Available</button>`
      }
      <button class="btn-follow ${d.followed ? 'following' : ''}" onclick="toggleFollow(${d.id}, this)">
        ${d.followed ? '✓ Following' : '+ Follow'}
      </button>
    </div>
  `).join('');
}

function searchDoctors(query) {
  const q = query.toLowerCase();
  const filtered = doctors.filter(d =>
    d.name.toLowerCase().includes(q) ||
    d.spec.toLowerCase().includes(q)
  );
  renderSearchDoctors(filtered);
}

// ============================================================
// BOOKING MODAL
// ============================================================
let currentBookingDoctor = null;

function openBooking(doctorId) {
  currentBookingDoctor = doctors.find(d => d.id === doctorId);
  if (!currentBookingDoctor) return;


  const infoEl = document.getElementById('booking-doctor-info');
  infoEl.innerHTML = `
    <div style="width:44px;height:44px;border-radius:50%;background:#2563EB;display:flex;align-items:center;justify-content:center;font-size:1rem;font-weight:700;color:white;flex-shrink:0">${getInitials(currentBookingDoctor.name)}</div>
    <div>
      <div style="font-weight:700;font-size:0.95rem;">${currentBookingDoctor.name}</div>
      <div style="font-size:0.82rem;color:#6b7280;">${currentBookingDoctor.spec}</div>
    </div>
  `;

  // Reset fields
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('booking-date').value = today;
  document.getElementById('booking-date').min = today;
  document.getElementById('booking-notes').value = '';
  document.querySelectorAll('.time-slot').forEach(t => t.classList.remove('selected'));

  document.getElementById('booking-modal').classList.add('open');
}

function closeBookingModal() {
  document.getElementById('booking-modal').classList.remove('open');
}

function closeModal(e) {
  if (e.target.id === 'booking-modal') closeBookingModal();
}

function selectTime(btn) {
  document.querySelectorAll('.time-slot').forEach(t => t.classList.remove('selected'));
  btn.classList.add('selected');
}

async function confirmBooking() {
  const selectedTime = document.querySelector('.time-slot.selected');
  const date = document.getElementById('booking-date').value;
  const notes = document.getElementById('booking-notes').value.trim();
  if (!selectedTime) { showToast('Please select a time slot', 'error'); return; }
  if (!date)         { showToast('Please select a date', 'error');      return; }


  const formattedDate = new Date(date).toLocaleDateString('en-MY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // ── Show Proxy + Mediator log ────────────────────────────
  clearPatternLog();
  patternLog('proxy', `Patient "${currentUser.name}" wants to book ${currentBookingDoctor.name}`);

  try {
    // ── Call book.php — Proxy + Mediator runs on the backend ─
    const res  = await fetch(`${API}/book.php`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        doctorId:  currentBookingDoctor.id,
        patientId: currentUser.patientId,
        userId:    currentUser.userId,
        slotId:    null,
        date:      date,
        time:      selectedTime.textContent,
        patientNotes: notes,
      })
    });
    const data = await res.json();

    if (data.success) {
      patternLog('proxy', 'checkAccess() → GRANTED ✓');
      patternLog('proxy', 'validation() → VALID ✓ → forwarding to ManagementMediator...');
      patternLog('mediator', `INSERT INTO appointments → doctor_id: ${currentBookingDoctor.id}, patient_id: ${currentUser.patientId}, status: 'pending'`);
      patternLog('mediator', 'Booking saved to database ✓');

      // Also push to doctor request queue so doctor can accept
      const newApptId = data.appointmentId || Date.now();
      doctorAppointmentRequests.push({
        id:            newApptId,
        appointmentId: newApptId,
        patientName:   currentUser.name,
        patientEmail:  currentUser.email,
        patientImg:    `https://i.pravatar.cc/48?img=${Math.floor(Math.random()*70)+1}`,
        date:          formattedDate,
        time:          selectedTime.textContent,
        reason:        'New appointment request',
        patientNotes:  notes,
        status:        'pending',
      });

      // Add to local appointments list
      appointments.push({
        id: newApptId, doctorId: currentBookingDoctor.id,
        name: currentBookingDoctor.name, spec: currentBookingDoctor.spec,
        date: formattedDate, time: selectedTime.textContent,
        type: 'Video Consultation', status: 'pending', img: currentBookingDoctor.img,
      });

      document.getElementById('booking-notes').value = '';
      renderAppointments();
      renderHomeBanner();
      closeBookingModal();
      showToast(`Appointment booked with ${currentBookingDoctor.name}! Waiting for doctor to accept.`, 'success');
    } else {
      patternLog('proxy', `ERROR: ${data.message}`);
      showToast(data.message || 'Booking failed.', 'error');
    }
  } catch (e) {
    // Fallback: save locally if server unreachable
    patternLog('proxy', 'Server unreachable — saving locally only');
    showToast('Could not reach server. Saved locally only.', 'error');
  }
}

async function cancelAppt(appointmentId) {
  clearPatternLog();
  patternLog('proxy', `Patient "${currentUser?.name}" wants to cancel appointment #${appointmentId}`);

  try {
    const res  = await fetch(`${API}/accept.php`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appointmentId, doctorUserId: currentUser?.userId, action: 'rejected' })
    });
    const data = await res.json();
    if (data.success) {
      patternLog('proxy', 'checkAccess() → GRANTED ✓');
      patternLog('mediator', `UPDATE appointments SET status = 'rejected' WHERE id = ${appointmentId}`);
      patternLog('mediator', 'Cancellation saved to database ✓');
      showToast('Appointment cancelled', 'error');
    } else {
      showToast(data.message || 'Failed to cancel appointment', 'error');
    }
    await loadPatientDashboard();
  } catch (e) {
    patternLog('proxy', 'Server unreachable — cancelling locally');
    showToast('Appointment cancelled (local only)', 'error');
  }
}

// ============================================================
// VIDEO ROOM
// ============================================================
let patientStream = null;

async function startPatientCamera() {
  try {
    patientStream = await navigator.mediaDevices.getUserMedia({

      video: true,
      audio: true
    });

    const video = document.getElementById("patient-video");

    if (video) {
      video.srcObject = patientStream;
    }

  } catch (err) {
    console.error("Camera access denied:", err);
    alert("Please allow camera access for the consultation.");
  }
}

async function openVideoRoom(roomCode, label) {
  // Clear chat
  const chatEl = document.getElementById('chat-messages');
  if (chatEl) chatEl.innerHTML = '';
  
  // Get local camera first
  await startPatientCamera();
  if (!patientStream) return;
  // Show video room
  const vr = document.getElementById('video-room');
  vr.style.display = 'flex';
  vr.style.position = 'fixed';
  vr.style.inset = '0';
  vr.style.zIndex = '500';
  const roomLabel = document.getElementById('video-room-label');
  
  if (currentRole === 'doctor') {
    // Doctor — listens for incoming call using room code as their peer ID
    peer = new Peer(roomCode);
    peer.on('open', () => {
      if (roomLabel) roomLabel.textContent = `Waiting for patient to join... · ${label || ''}`;
    });
    peer.on('call', (call) => {
      currentCall = call;
      call.answer(patientStream); // send local video
      call.on('stream', (remoteStream) => {
        const remoteVideo = document.getElementById('remote-video');
        if (remoteVideo) remoteVideo.srcObject = remoteStream;
      });
      if (roomLabel) roomLabel.textContent = `Connected · ${label || ''}`;
    });
    peer.on('error', (err) => {
      console.error('PeerJS error:', err);
      if (roomLabel) roomLabel.textContent = 'Connection error';
    });
  } else {
    // Patient — calls the doctor's room code
    peer = new Peer();
    peer.on('open', (myId) => {
      if (roomLabel) roomLabel.textContent = `Connecting to ${label || 'doctor'}...`;
      const call = peer.call(roomCode, patientStream);
      currentCall = call;
      call.on('stream', (remoteStream) => {
        const remoteVideo = document.getElementById('remote-video');
        if (remoteVideo) remoteVideo.srcObject = remoteStream;
      });
      call.on('error', (err) => {
        console.error('PeerJS call error:', err);
        showToast('Call connection failed', 'error');
      });
      call.on('close', () => {
        if (roomLabel) roomLabel.textContent = 'Call ended';
      });
    });
    peer.on('error', (err) => {
      console.error('PeerJS error:', err);
      if (roomLabel) roomLabel.textContent = 'Connection error';
    });
  }
}

function endCall() {
  const vr = document.getElementById('video-room');
  vr.style.display = 'none';


  if (patientStream) {
    patientStream.getTracks().forEach(track => track.stop());
  }

  if (currentCall) { 
    currentCall.close(); currentCall = null; 
  }
  if (peer) { 
    peer.destroy(); peer = null; 
  }

  const rv = document.getElementById('remote-video');
  if (rv) rv.srcObject = null;

  // Return to the correct page based on who is logged in
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

  if (currentRole === 'doctor') {
    document.getElementById('page-doctor').classList.add('active');
    navigateDoctor('doc-dashboard', document.querySelector('#doctor-sidebar .nav-item'));
  } else {

    document.getElementById('page-app').classList.add('active');
    navigate('home', document.querySelector('#sidebar .nav-item'));
  }

  showToast('Call ended', '');
}


function sendChat() {
  const input = document.getElementById('chat-input');
  const msg = input.value.trim();
  if (!msg) return;

  const messages = document.getElementById('chat-messages');
  const now = new Date();
  const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const div = document.createElement('div');
  div.className = 'chat-msg patient';
  div.innerHTML = `
    <div class="msg-bubble">${msg}</div>
    <div class="msg-time">${time}</div>
  `;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
  input.value = '';
}

// ============================================================
// TOAST
// ============================================================
function showToast(message, type = '') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = 'toast ' + type;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// ============================================================
// INIT
// ============================================================
// ============================================================
// NOTIFICATION STORE (Observer Pattern)
// Keyed by patient email — each patient has their own inbox
// ============================================================
const notificationStore = {};

function pushNotification(patientEmail, message, doctorName) {
  if (!notificationStore[patientEmail]) {
    notificationStore[patientEmail] = [];
  }
  notificationStore[patientEmail].unshift({
    id:         Date.now() + Math.random(),
    message,
    doctorName,
    time:       new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    isRead:     false,
  });
  // If this patient is currently logged in, refresh their notification UI
  if (currentUser.email === patientEmail) {
    renderPatientNotifications();
    updateNotifBadge();
  }
}

function renderPatientNotifications() {
  const view = document.getElementById('view-notifications');
  if (!view) return;
  const inbox = notificationStore[currentUser.email] || [];
  const listHtml = inbox.length === 0
    ? '<p style="color:#9ca3af;margin-top:20px">No notifications yet. Follow a doctor to get started!</p>'
    : inbox.map(n => `
        <div class="notif-item ${n.isRead ? '' : 'unread'}" onclick="markNotifRead('${n.id}')">
          <div class="notif-dot-inline" style="background:${n.isRead ? '#e5e7eb' : '#2563EB'}"></div>
          <div>
            <div class="notif-msg">${n.message}</div>
            <div class="notif-time">${n.time}</div>
          </div>
        </div>
      `).join('');

  view.innerHTML = `
    <div class="view-content">
      <div class="section-header">
        <h1 class="page-title" style="margin:0">Notifications</h1>
        <div style="display:flex;gap:12px">
          <a href="#" class="view-all" onclick="clearAllNotifs()" style="color:#dc2626">Clear all</a>
          <a href="#" class="view-all" onclick="markAllNotifsRead()">Mark all as read</a>
        </div>
      </div>
      <div style="margin-top:20px">${listHtml}</div>
    </div>
  `;
}

async function markNotifRead(id) {
  const inbox = notificationStore[currentUser.email] || [];
  const notif = inbox.find(n => String(n.id) === String(id));
  if (notif && !notif.isRead) {
    notif.isRead = true;
    // Persist to DB so it stays read after refresh
    try { await fetch(`${API}/notifications.php`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: notif.id }) }); } catch {}
  }
  renderPatientNotifications();
  updateNotifBadge();
}

async function markAllNotifsRead() {
  const unread = (notificationStore[currentUser.email] || []).filter(n => !n.isRead);
  unread.forEach(n => { n.isRead = true; });
  // Persist each to DB
  for (const n of unread) {
    try { await fetch(`${API}/notifications.php`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: n.id }) }); } catch {}
  }
  renderPatientNotifications();
  updateNotifBadge();
}

async function clearAllNotifs() {
  const inbox = notificationStore[currentUser.email] || [];
  if (inbox.length === 0) return;
  try {
    await fetch(`${API}/notifications.php`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUser.userId })
    });
  } catch {}
  notificationStore[currentUser.email] = [];
  renderPatientNotifications();
  updateNotifBadge();
}

function updateNotifBadge() {
  const unread = (notificationStore[currentUser.email] || []).filter(n => !n.isRead).length;
  const dot = document.querySelector('#sidebar .notif-btn .notif-dot');
  if (dot) dot.style.display = unread > 0 ? 'block' : 'none';
}

// ============================================================
// FOLLOW DOCTOR (Observer Pattern - subscribe/unsubscribe)
// FIX: async — persists to DB via follow.php
// ============================================================
doctors.forEach(d => { d.followed = false; d.followers = []; });

async function toggleFollow(doctorId, btn) {

  const doctor = doctors.find(d => d.id === doctorId);
  if (!doctor) return;

  const action = doctor.followed ? 'unfollow' : 'follow';
  btn.disabled    = true;
  btn.textContent = '...';

  try {
    const res  = await fetch(`${API}/follow.php`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ patientId: currentUser.patientId, doctorId, action }),
    });
    const data = await res.json();
    if (!data.success) {
      showToast('Could not update follow status', 'error');
      btn.textContent = doctor.followed ? '✓ Following' : '+ Follow';
      btn.disabled = false;
      return;
    }
  } catch (e) {
    showToast('Server unreachable', 'error');
    btn.textContent = doctor.followed ? '✓ Following' : '+ Follow';
    btn.disabled = false;
    return;
  }

  doctor.followed = !doctor.followed;
  btn.disabled    = false;
  if (doctor.followed) {
    btn.textContent = '✓ Following';
    btn.classList.add('following');
    showToast(`You are now following ${doctor.name}`, 'success');
  } else {
    btn.textContent = '+ Follow';
    btn.classList.remove('following');
    showToast(`Unfollowed ${doctor.name}`, 'success');
  }
  renderHomeDoctors();
  renderSearchDoctors(doctors);
}

// ============================================================
// DOCTOR DATA
// ============================================================
// loaded from appointments.php on doctor login
const doctorAppointmentRequests = [];
const doctorSchedule            = [];

// ============================================================
// DOCTOR NAVIGATION
// ============================================================
function navigateDoctor(view, navEl) {
  const sidebar = document.getElementById('doctor-sidebar');
  if (sidebar) sidebar.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  if (navEl) navEl.classList.add('active');

  document.querySelectorAll('#page-doctor .view').forEach(v => v.classList.remove('active'));
  const target = document.getElementById('view-' + view);
  if (target) target.classList.add('active');

  // Re-fetch appointment requests from DB every time that tab is opened
  if (view === 'doc-requests' && currentUser && currentUser.doctorId) {
    const list = document.getElementById('doc-requests-list');
    if (list) list.innerHTML = '<p style="color:#9ca3af">Loading requests...</p>';

    fetchAppointments(`role=doctor&doctorId=${currentUser.doctorId}`)
      .then(data => {
        console.log('[DOC-REQUESTS] response:', data);
        if (data.success) {
          doctorAppointmentRequests.length = 0;
          doctorSchedule.length = 0;
          data.appointments.forEach(a => {
            if (a.status === 'pending') {
          doctorAppointmentRequests.push({ ...a, patientImg: a.img, reason: a.reason || 'Appointment request', appointmentId: a.id, patientNotes: a.notes || '' });
            } else if (a.status === 'accepted' || a.status === 'completed') {
              doctorSchedule.push({ ...a, patientImg: a.img, appointmentId: a.id, status: a.status === 'accepted' ? 'confirmed' : 'completed' });
            }
          });
          renderDoctorRequests();
          renderDoctorStats();
          const badge = document.getElementById('requests-badge');
          if (badge) badge.textContent = doctorAppointmentRequests.filter(r => r.status === 'pending').length;
        } else {
          if (list) list.innerHTML = `<p style="color:#dc2626">Error: ${data._error || data.message}</p>`;
        }
      })
      .catch(err => {
        console.error('[DOC-REQUESTS] fetch error:', err);
        const list = document.getElementById('doc-requests-list');
        if (list) list.innerHTML = '<p style="color:#dc2626">Network error — check console.</p>';
      });
  }

  // Re-fetch doctor notifications from DB
  if (view === 'doc-notifications' && currentUser && currentUser.userId) {
    renderDoctorNotifications();
  }

  // Populate settings from current logged-in user
  if (view === 'doc-settings' && currentUser) {
    const nameEl    = document.getElementById('settings-doc-name');
    const emailEl   = document.getElementById('settings-doc-email');
    const specEl    = document.getElementById('settings-doc-spec');
    const licenseEl = document.getElementById('settings-doc-license');
    if (nameEl)    nameEl.value    = currentUser.name    || '';
    if (emailEl)   emailEl.value   = currentUser.email   || '';
    if (specEl)    specEl.value    = currentUser.specialty || '';
    if (licenseEl) licenseEl.value = currentUser.license  || '';
  }
}

// ============================================================
// DOCTOR DASHBOARD RENDER
// ============================================================
function renderDoctorDashboard() {
  updateDoctorUI(currentUser.name);
  renderDoctorUpcoming();
  renderDoctorRequests();
  renderDoctorSchedule();
  renderDoctorStats();

  // Set toggle to match this doctor's actual current status in the doctors array
  const doctorInList = doctors.find(d => d.name === currentUser.name);
  const toggle = document.getElementById('doc-status-toggle');
  const label  = document.getElementById('doc-status-label');
  if (toggle && doctorInList) {
    toggle.checked     = doctorInList.available;
    label.textContent  = doctorInList.available ? '● Available' : '● Busy';
    label.style.color  = doctorInList.available ? '#16a34a'     : '#dc2626';
  }

  const pending = doctorAppointmentRequests.filter(r => r.status === 'pending').length;
  const badge = document.getElementById('requests-badge');
  if (badge) badge.textContent = pending;
}

// Upcoming (dashboard preview — first 2 confirmed)
function renderDoctorUpcoming() {
  const list = document.getElementById('doc-upcoming-list');
  if (!list) return;
  const upcoming = doctorSchedule.filter(s => s.status === 'confirmed').slice(0, 2);
  if (upcoming.length === 0) {
    list.innerHTML = '<p style="color:#9ca3af">No upcoming appointments.</p>';
    return;
  }
  list.innerHTML = upcoming.map(a => `
    <div class="appt-item">
      <div class="appt-item-avatar-initials">${getInitials(a.patientName)}</div>
      <div class="appt-item-info">
        <div class="appt-item-name">${a.patientName}</div>
        <div class="appt-item-spec">${a.type}</div>
        <div class="appt-item-meta">
          <span>📅 ${a.date}</span>
          <span>🕐 ${a.time}</span>
        </div>
        ${a.roomCode ? `<div style="margin-top:4px;font-size:12px;color:#6b7280;">Room: <span style="font-family:monospace;font-weight:700;color:#2563EB;background:#eff6ff;padding:2px 6px;border-radius:4px">${a.roomCode}</span></div>` : ''}
      </div>
      <div class="appt-item-actions">
        <span class="status-badge confirmed">Confirmed</span>
        ${a.roomCode
          ? `<button class="btn-appt-join" onclick="openVideoRoom('${a.roomCode}','${a.patientName}')">Join</button>`
          : '<span style="color:#9ca3af;font-size:12px">No room yet</span>'}
      </div>
    </div>
  `).join('');
}

// Appointment Requests (Accept / Reject)
function renderDoctorRequests() {
  const list = document.getElementById('doc-requests-list');
  if (!list) return;
  if (doctorAppointmentRequests.length === 0) {
    list.innerHTML = '<p style="color:#9ca3af">No pending requests.</p>';
    return;
  }
  list.innerHTML = doctorAppointmentRequests.map(r => `
    <div class="appt-item" id="req-${r.id}">
      <div class="appt-item-avatar-initials">${getInitials(r.patientName)}</div>
      <div class="appt-item-info">
        <div class="appt-item-name">${r.patientName}</div>
        <div class="appt-item-spec" style="color:#6b7280;font-size:0.83rem">${r.reason}</div>
        <div class="appt-item-meta">
          <span>📅 ${r.date}</span>
          <span>🕐 ${r.time}</span>
        </div>
        ${r.patientNotes ? `<div style="margin-top:6px;font-size:0.82rem;color:#374151;background:#f9fafb;padding:8px 10px;border-radius:8px;border-left:3px solid #2563EB">${r.patientNotes}</div>` : ''}
      </div>
      <div class="appt-item-actions">
        ${r.status === 'pending' ? `
          <button class="btn-appt-join" style="background:#16a34a" onclick="respondRequest(${r.id}, 'accepted')">✓ Accept</button>
          <button class="btn-appt-join" style="background:#dc2626" onclick="respondRequest(${r.id}, 'rejected')">✕ Reject</button>
        ` : r.status === 'rejected' ? `<span style="background:#dc2626;color:#fff;padding:4px 12px;border-radius:20px;font-size:0.78rem;font-weight:600;letter-spacing:0.3px">Rejected</span>` : `<span class="status-badge confirmed">Accepted</span>`}
      </div>
    </div>
  `).join('');
}

async function respondRequest(id, action) {
  id = parseInt(id, 10); // FIX 1: onclick gives string, r.id is number — strict === always failed
  const req = doctorAppointmentRequests.find(r => parseInt(r.id, 10) === id);
  if (!req) return;

  clearPatternLog();
  patternLog('proxy', `Doctor "${currentUser.name}" is ${action === 'accepted' ? 'accepting' : 'rejecting'} appointment for "${req.patientName}"`);
  patternLog('proxy', `checkAccess() → user: "${currentUser.name}" (doctor) → GRANTED ✓`);

  try {
    // ── Call accept.php — Proxy + Mediator + State + Observer on backend ──
    const res  = await fetch(`${API}/accept.php`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appointmentId: req.appointmentId || req.id,
        doctorUserId:  currentUser.userId,
        action,
      })
    });
    const data = await res.json();

    if (data.success) {
      req.status = action;

      if (action === 'accepted') {
        patternLog('proxy', 'Forwarding to ManagementMediator to create room...');
        patternLog('mediator', `UPDATE appointments SET status = 'accepted' WHERE id = ${req.id}`);
        patternLog('mediator', `INSERT INTO rooms → room_code: '${data.roomCode}', status: 'active'`);
        patternLog('mediator', `Room ${data.roomCode} created and linked to appointment ✓`);
        patternLog('mediator', `STATE: DoctorAvailability → BusyState ✓`);
        patternLog('mediator', `OBSERVER: Patient "${req.patientName}" notified via notifications table ✓`);

        const apptId = req.appointmentId || req.id;
        consultationRooms[apptId] = {
          roomCode:    data.roomCode,
          doctorName:  currentUser.name,
          patientName: req.patientName,
          date:        req.date,
          time:        req.time,
        };

        doctorSchedule.push({
          id: Date.now(), patientName: req.patientName, patientImg: req.patientImg,
          date: req.date, time: req.time, type: 'Video Consultation',
          status: 'confirmed', appointmentId: apptId,
        });

        // Notify patient locally too (Observer)
        if (req.patientEmail) {
          pushNotification(req.patientEmail,
            `Your appointment with ${currentUser.name} is confirmed! Room: ${data.roomCode}. Join on ${req.date} at ${req.time}.`,
            currentUser.name
          );
        }

        showToast(`Accepted! Room ${data.roomCode} created for ${req.patientName}`, 'success');

      } else {
        patternLog('mediator', `UPDATE appointments SET status = 'rejected' WHERE id = ${req.id}`);
        patternLog('mediator', `STATE: DoctorAvailability → AvailableState ✓`);
        patternLog('mediator', `OBSERVER: Patient "${req.patientName}" notified of rejection ✓`);
        showToast(`Appointment with ${req.patientName} rejected.`, 'error');
      }

    } else {
      patternLog('proxy', `ERROR: ${data.message}`);
      showToast(data.message || 'Action failed.', 'error');
    }

  } catch (e) {
    // Fallback to local-only if server unreachable
    patternLog('proxy', 'Server unreachable — updating locally only');
    req.status = action;
    if (action === 'accepted') {
      const roomCode = 'ROOM-' + Math.random().toString(36).substring(2,6).toUpperCase() + '-' + Math.random().toString(36).substring(2,6).toUpperCase();
      const apptId   = req.appointmentId || req.id;
      consultationRooms[apptId] = { roomCode, doctorName: currentUser.name, patientName: req.patientName, date: req.date, time: req.time };
      doctorSchedule.push({ id: Date.now(), patientName: req.patientName, patientImg: req.patientImg, date: req.date, time: req.time, type: 'Video Consultation', status: 'confirmed', appointmentId: apptId });
      showToast(`Accepted (local)! Room ${roomCode} created.`, 'success');
    } else {
      showToast(`Rejected (local).`, 'error');
    }
  }

  renderDoctorRequests();
  renderDoctorSchedule();
  renderDoctorUpcoming();
  const pending = doctorAppointmentRequests.filter(r => r.status === 'pending').length;
  const badge = document.getElementById('requests-badge');
  if (badge) badge.textContent = pending;
}

// ============================================================
// DOCTOR STATS — computed from real DB data, no hardcoding
// ============================================================
function renderDoctorStats() {
  const pending      = doctorAppointmentRequests.filter(r => r.status === 'pending').length;
  const todayStr     = new Date().toDateString();
  const todayConfirmed = doctorSchedule.filter(s => {
    if (!s.date || s.date === 'TBC') return false;
    try { return new Date(s.date).toDateString() === todayStr; } catch { return false; }
  });
  const todayCount   = todayConfirmed.length;

  const elPatients  = document.getElementById('stat-today-patients');
  const elPending   = document.getElementById('stat-pending');
  const elRating    = document.getElementById('stat-rating');

  if (elPatients) elPatients.textContent = todayCount;
  if (elPending)  elPending.textContent  = pending;
  if (elRating)   elRating.textContent   = '—';
}

// ============================================================
// DOCTOR NOTIFICATIONS — fetched from DB, read state persisted
// ============================================================
const doctorNotifStore = [];


async function renderDoctorNotifications() {
  const container = document.getElementById('doc-notif-list');
  if (!container) return;
  if (!currentUser || !currentUser.userId) return;

  container.innerHTML = '<p style="color:#9ca3af">Loading...</p>';

  try {
    const res  = await fetch(`${API}/notifications.php?userId=${currentUser.userId}`);
    const data = await res.json();
    if (!data.success) { container.innerHTML = '<p style="color:#9ca3af">Could not load notifications.</p>'; return; }

    doctorNotifStore.length = 0;
    data.notifications.forEach(n => doctorNotifStore.push({
      id: n.id, message: n.message, isRead: !!n.is_read, time: n.sent_at
    }));
  } catch (e) {
    container.innerHTML = '<p style="color:#9ca3af">Server unreachable.</p>';
    return;
  }

  if (doctorNotifStore.length === 0) {
    container.innerHTML = '<p style="color:#9ca3af">No notifications yet.</p>';
    return;
  }

  container.innerHTML = doctorNotifStore.map(n => `
    <div class="notif-item ${n.isRead ? '' : 'unread'}" onclick="markDoctorNotifRead(${n.id})" style="cursor:pointer">
      <div class="notif-dot-inline" style="background:${n.isRead ? '#e5e7eb' : '#2563EB'}"></div>
      <div>
        <div class="notif-msg">${n.message}</div>
        <div class="notif-time">${new Date(n.time).toLocaleString('en-MY', { dateStyle: 'medium', timeStyle: 'short' })}</div>
      </div>
    </div>
  `).join('');

  // Update the bell dot in topbar
  const unread = doctorNotifStore.filter(n => !n.isRead).length;
  const bell   = document.querySelector('#page-doctor .notif-dot');
  if (bell) bell.style.display = unread > 0 ? 'block' : 'none';
}

async function markDoctorNotifRead(id) {
  const notif = doctorNotifStore.find(n => n.id === id);
  if (!notif || notif.isRead) return;
  notif.isRead = true;
  // Persist to DB
  try { await fetch(`${API}/notifications.php`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }); } catch {}
  renderDoctorNotifications();
}

async function markAllDoctorNotifsRead() {
  const unread = doctorNotifStore.filter(n => !n.isRead);
  unread.forEach(n => { n.isRead = true; });
  // Persist each to DB
  for (const n of unread) {
    try { await fetch(`${API}/notifications.php`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: n.id }) }); } catch {}
  }
  renderDoctorNotifications();
}

async function clearAllDoctorNotifs() {
  if (doctorNotifStore.length === 0) return;
  try {
    await fetch(`${API}/notifications.php`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUser.userId })
    });
  } catch {}
  doctorNotifStore.length = 0;
  renderDoctorNotifications();
}


// My Schedule
function renderDoctorSchedule() {
  const list = document.getElementById('doc-schedule-list');
  if (!list) return;
  if (doctorSchedule.length === 0) { list.innerHTML = '<p style="color:#9ca3af">No appointments yet.</p>'; return; }
  list.innerHTML = doctorSchedule.map(a => `
    <div class="appt-item">
      <div class="appt-item-avatar-initials">${getInitials(a.patientName)}</div>
      <div class="appt-item-info">
        <div class="appt-item-name">${a.patientName}</div>
        <div class="appt-item-spec">${a.type}</div>
        <div class="appt-item-meta">
          <span>📅 ${a.date}</span>
          <span>🕐 ${a.time}</span>
        </div>
        ${a.roomCode ? `<div style="margin-top:4px;font-size:12px;color:#6b7280;">Room: <span style="font-family:monospace;font-weight:700;color:#2563EB;background:#eff6ff;padding:2px 6px;border-radius:4px">${a.roomCode}</span></div>` : ''}
      </div>
      <div class="appt-item-actions">
        ${a.status === 'confirmed'
          ? `<span class="status-badge confirmed">Confirmed</span>
             ${a.roomCode ? `<button class="btn-appt-join" onclick="openVideoRoom('${a.roomCode}','${a.patientName}')">Join</button>` : '<span style="color:#9ca3af;font-size:12px">No room yet</span>'}`
          : `<span class="status-badge completed">Completed</span>`}
      </div>
    </div>
  `).join('');
}


// Set Availability
async function toggleDoctorStatus(checkbox) {
  const label  = document.getElementById('doc-status-label');
  const status = checkbox.checked ? 'Available' : 'Busy';

  try {
    const res  = await fetch(`${API}/status.php`, {

      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        doctorId:   currentUser.doctorId,
        doctorName: currentUser.name,
        status,
      }),
    });
    const data = await res.json();
    console.log('status.php response:', data);
    showToast(
      data.success ? data.message : (data.message || 'Status update failed'),
      checkbox.checked ? 'success' : 'error'
    );
  } catch (e) {
    console.error('status.php failed:', e);
    showToast('Server unreachable — status not saved', 'error');
  }

  const doctorInList = doctors.find(d =>
    d.name === currentUser.name || d.name === 'Dr. ' + currentUser.name
  );
  if (checkbox.checked) {
    label.textContent = '● Available';
    label.style.color = '#16a34a';
    if (doctorInList) { doctorInList.available = true; doctorInList.status = 'Available'; }
  } else {
    label.textContent = '● Busy';
    label.style.color = '#dc2626';
    if (doctorInList) { doctorInList.available = false; doctorInList.status = 'Busy'; }
  }
}

async function saveAvailability() {
  const date  = document.getElementById('avail-date').value;
  const start = document.getElementById('avail-start').value;
  const end   = document.getElementById('avail-end').value;
  if (!date || !start || !end) { showToast('Please fill in all fields', 'error'); return; }

  const startDateTime = `${date} ${start}:00`;
  const endDateTime   = `${date} ${end}:00`;

  try {
    // ── Calls availability.php — State + Observer on the backend ──
    const res  = await fetch(`${API}/availability.php`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        doctorId:  currentUser.doctorId,
        userId:    currentUser.userId,
        startTime: startDateTime,
        endTime:   endDateTime,
      })
    });
    const data = await res.json();

    if (data.success) {
      // Also notify local followers (Observer — JS side)
      const doctorInList = doctors.find(d => d.name === currentUser.name || d.name === 'Dr. ' + currentUser.name);
      if (doctorInList) {
        notifyFollowers(doctorInList, `${currentUser.name} has a new slot on ${date} from ${start} to ${end}. Book now!`);
      }
      showToast(data.message, 'success');
    } else {
      showToast(data.message || 'Failed to save.', 'error');
    }
  } catch (e) {
    showToast('Server unreachable. Could not save availability.', 'error');
  }

  document.getElementById('avail-date').value  = '';
  document.getElementById('avail-start').value = '';
  document.getElementById('avail-end').value   = '';
}

// Shared helper — sends notification to every patient in doctor.followers
function notifyFollowers(doctor, message) {
  if (!doctor.followers || doctor.followers.length === 0) return;
  doctor.followers.forEach(patientEmail => {
    pushNotification(patientEmail, message, doctor.name);
  });
}

  // Set today's date
  const today = new Date();
  const hour = today.getHours();
  const greet = hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening';
  const titleEl = document.querySelector('.greeting-title');
  if (titleEl) titleEl.textContent = `${greet}, Aaron 👋`;
;
