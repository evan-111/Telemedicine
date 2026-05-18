# Smart Doctor Booking — Telemedicine System with webrtc
Telemedicine is a school project i have for my software design class where we need to use design pattern to code a health system or a school system , i chose the health system . The primary goal of telemedicine is to demonstrate the design pattern used to build the web system. It is design to centralised all the feature of a online doctor booking system for video consultation with doctors. Currently it has the features , but the functionality is a bit off as it still has some bug and issues , but this project was just for me to learn design patterns and how to integrate webrtc with my homelab i build with proxmox. 

The system is a full-stack telemedicine booking system with WebRTC video consultation, built with PHP + MySQL + vanilla JS. The architecture demonstrates five GoF design patterns (Singleton, Factory, State, Proxy + Mediator, Observer) working together in a real-world application.

Originally built as a school project for a software design class to demonstrate design patterns. After the semester, the project was extended with real WebRTC video calls and deployed on a homelab running Proxmox with an Ubuntu VM.

## WebRTC Video Consultation

**How it works:**

The video call uses [PeerJS](https://peerjs.com/) — a WebRTC wrapper library that provides a free cloud signaling server. No backend PHP changes were needed; all WebRTC logic lives in the frontend.

```
┌─────────────────────┐         PeerJS Cloud (signaling)        ┌─────────────────────┐
│   Doctor Browser    │ ←──────────────────────────────────────→ │  Patient Browser    │
│  Peer ID = RoomCode │                                          │  Peer ID = random   │
└─────────┬───────────┘                                          └─────────┬───────────┘
          │                       WebRTC P2P Media                        │
          └─────────────────────────────────────────────────────────────────┘
```

**Flow:**

1. Doctor accepts an appointment → PHP creates a room code (`ROOM-XXXX`) stored in the `rooms` table
2. Doctor clicks **Join** → `new Peer(roomCode)` — listens for incoming calls on that ID
3. Patient clicks **Join Room** → `new Peer()` — gets a random ID, then calls `peer.call(roomCode, localStream)`
4. Doctor receives `peer.on('call')` → answers with their local stream via `call.answer(patientStream)`
5. Both sides bind the remote stream to `<video id="remote-video">` and see each other

**Key frontend code locations:**

| File | Function | Purpose |
|------|----------|---------|
| `frontend/index.html:517` | `<video id="remote-video">` | Displays the remote peer's video |
| `frontend/index.html:522` | `<video id="patient-video">` | Local camera preview |
| `frontend/index.html:571` | `<script src="peerjs">` | PeerJS CDN library |
| `frontend/app.js:9-10` | `let peer, currentCall` | PeerJS state variables |
| `frontend/app.js:801` | `openVideoRoom()` | Creates Peer + initiates/answers call |
| `frontend/app.js:862` | `endCall()` | Closes call + destroys peer + stops camera |

**Why PeerJS over raw WebRTC:**
- No custom signaling server needed — PeerJS provides a free cloud server
- No manual ICE/STUN/TURN configuration
- Tiny library (~18KB gzipped), zero dependencies
- Works through NAT/firewalls using PeerJS's built-in STUN servers

---

## Server Setup (Homelab)

The application runs on an Ubuntu VM inside Proxmox, using Apache2 + MySQL + PHP.

### Base Installation

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install LAMP stack
sudo apt install apache2 php php-mysql mysql-server -y
sudo apt install php-curl php-gd php-mbstring php-xml php-zip -y

# Enable and start services
sudo systemctl enable apache2 mysql
sudo systemctl start apache2 mysql
```

### Deploy the Application

```bash
cd /var/www/html
sudo git clone https://github.com/your-username/your-repo-name.git telemedicine
sudo chown -R www-data:www-data /var/www/html/telemedicine
sudo chmod -R 755 /var/www/html/telemedicine
```

### Database Setup

```bash
sudo mysql
```

Inside the MySQL prompt:
```sql
CREATE USER 'telemed'@'localhost' IDENTIFIED BY 'YourPassword';
GRANT ALL ON telemedicine.* TO 'telemed'@'localhost';
FLUSH PRIVILEGES;
CREATE DATABASE telemedicine CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
EXIT;
```

Import the schema:
```bash
mysql -u telemed -p'YourPassword' telemedicine < /var/www/html/telemedicine/schema.sql
```

### Configure Database Connection

Edit `/var/www/html/telemedicine/config/database.php`:

```php
private string $host     = 'localhost';
private string $dbname   = 'telemedicine';
private string $username = 'telemed';
private string $password = 'YourPassword';
```

### HTTPS Setup (Required for WebRTC Camera Access)

Browsers block camera access on insecure HTTP. Set up a self-signed SSL certificate:

```bash
# Generate self-signed certificate
sudo mkdir -p /etc/apache2/ssl
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/apache2/ssl/homelab.key \
  -out /etc/apache2/ssl/homelab.crt \
  -subj "/CN=YOUR_SERVER_IP"

# Enable SSL module
sudo a2enmod ssl

# Create SSL virtual host
sudo tee /etc/apache2/sites-available/telemedicine-ssl.conf << 'EOF'
<IfModule mod_ssl.c>
    <VirtualHost _default_:443>
        ServerAdmin webmaster@localhost
        DocumentRoot /var/www/html

        ErrorLog ${APACHE_LOG_DIR}/error.log
        CustomLog ${APACHE_LOG_DIR}/access.log combined

        SSLEngine on
        SSLCertificateFile /etc/apache2/ssl/homelab.crt
        SSLCertificateKeyFile /etc/apache2/ssl/homelab.key

        <Directory /var/www/html>
            Options Indexes FollowSymLinks
            AllowOverride All
            Require all granted
        </Directory>
    </VirtualHost>
</IfModule>
EOF

# Create HTTP virtual host (for redirect or alternate access)
sudo tee /etc/apache2/sites-available/telemedicine.conf << 'EOF'
<VirtualHost *:80>
    ServerName YOUR_SERVER_IP
    DocumentRoot /var/www/html
    <Directory /var/www/html>
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>
</VirtualHost>
EOF

# Enable sites and restart
sudo a2dissite 000-default.conf
sudo a2ensite telemedicine.conf telemedicine-ssl.conf
sudo systemctl restart apache2
```

Access the site at `https://YOUR_SERVER_IP/telemedicine/frontend/` and accept the self-signed certificate warning.

**Alternative:** If HTTPS is not possible, enable insecure camera access in Firefox/Zen Browser by navigating to `about:config` and setting `media.getusermedia.insecure.enabled = true`.

---

## Testing with Two Laptops

```
┌─────────────────────────────────────────────────────────────┐
│                      Homelab (Proxmox VM)                    │
│  Apache2 :80/:443  │  MySQL  │  PHP 8.2                     │
│  /var/www/html/telemedicine                                 │
└──────────┬──────────────────────────────────────┬────────────┘
           │ LAN (192.168.x.x)                    │
           ├──────────────────────────────────────┤
           │                                      │
    ┌──────▼──────┐                       ┌──────▼──────┐
    │  Laptop A   │                       │  Laptop B   │
    │  (Doctor)   │                       │  (Patient)  │
    │  Chrome     │                       │  Chrome     │
    │  Login →    │                       │  Login →    │
    │  Accept     │◄─────WebRTC P2P──────►│  Book →     │
    │  Join Room  │                       │  Join Room  │
    └─────────────┘                       └─────────────┘
```

**Test sequence:**
1. **Laptop A (Doctor):** Open `https://HOMELAB-IP/telemedicine/frontend/` → Login → Go to Appointment Requests
2. **Laptop B (Patient):** Same URL → Login → Search → Book the doctor
3. **Laptop A:** Click **Accept** → See room code → Click **Join**
4. **Laptop B:** See status change → Click **Join Room**
5. Both see each other's video

Both laptops need internet access for PeerJS signaling. The video/audio streams peer-to-peer.



---

## Design Patterns

### 1. Singleton — Database Connection
**File:** `config/database.php`

The `Database` class ensures only **one** PDO connection exists system-wide. Every API endpoint and pattern file calls `Database::getInstance()` instead of creating a new connection.

```
Database::getInstance() → always returns the same PDO instance
```

### 2. Factory — User Registration
**Files:** `patterns/UserFactory.php`, `api/register.php`

An abstract `UserFactory` with two concrete subclasses — `PatientFactory` and `DoctorFactory` — each responsible for creating the correct `User` object. The registration API picks the right factory based on the role:

```
register.php → role === 'doctor' ? new DoctorFactory() : new PatientFactory()
                    → createUser(data) returns Doctor or Patient
                    → user->save() persists to users + doctors/patients tables
```

This mirrors on the frontend JS side (`app.js:274-293`) where `PatientFactory`/`DoctorFactory` construct the matching client-side objects.

### 3. State — Doctor Availability
**Files:** `patterns/AppoinmentSlotState.php`, `api/status.php`, `api/availability.php`

`DoctorAvailability` is a context object that delegates behaviour to its current `State` (`AvailableState` | `BusyState`). This avoids if/else chains when booking, cancelling, or toggling status:

```
DoctorAvailability
  ├── book()   → AvailableState handles ✓, then transitions to BusyState
  ├── cancel() → BusyState handles ✓, then transitions to AvailableState
  └── getStatus() → delegates to state->getLabel()
```

When a doctor toggles their status switch or sets new availability, the state changes and is synced to the `doctors.status` and `availability.is_booked` columns.

### 4. Proxy + Mediator — Appointment Booking
**Files:** `patterns/AppoinmentSystemProxy.php`, `api/book.php`, `api/accept.php`

The **Proxy** (`AppointmentSystemProxy`) acts as a gatekeeper — it checks authentication (`checkAccess()`) and validates input before forwarding requests to the **Mediator** (`ManagementMediator`), which centralises all database operations:

```
Client → AppointmentSystemProxy (auth + validation gate)
           → ManagementMediator (INSERT/UPDATE on appointments, rooms, availability)
```

This separation means:
- The proxy can reject unauthenticated requests early
- The mediator handles all DB logic in one place
- Adding new features (e.g., email notifications) only changes the mediator

### 5. Observer — Follow / Notifications
**Files:** `patterns/Notification.php`, `api/follow.php`, `api/notifications.php`

`DoctorSubject` (the subject) maintains a list of subscribed `Observer`s (patients who followed). When a doctor sets availability or changes status, all followers receive a notification:

```
DoctorSubject → Notify (middleman) → Observer::receiveNotification()
                                    → INSERT INTO notifications table
```

Patients follow/unfollow via `follow.php`, which inserts/deletes rows in the `follows` table. When the doctor creates a slot or toggles status, a `DoctorSubject` queries the `follows` table and pushes a notification to every follower's inbox.

## Data Flow

```
Login → login.php (Singleton)
  → Patient dashboard: loads doctors + appointments + notifications
  → Doctor dashboard:  loads requests + schedule + notifications

Booking flow (Patient):
  openBooking() → modal → confirmBooking()
    → POST book.php → Proxy checks access → Mediator INSERTs appointment
    → Observer: notification sent to doctor's notifications table

Accept flow (Doctor):
  respondRequest() → POST accept.php
    → Proxy checks access → Mediator accepts/creates room
    → State: doctor → BusyState
    → Observer: patient notified

Status toggle (Doctor):
  toggleDoctorStatus() → POST status.php
    → State: doctors.status updated
    → Observer: followers notified

WebRTC Video flow:
  Doctor/Patient click Join → openVideoRoom(roomCode)
    → getUsermedia (local camera)
    → Doctor: new Peer(roomCode) — listens for call
    → Patient: new Peer() — peer.call(roomCode, localStream)
    → Both: call.on('stream') → display remote video
```

## API Endpoints

| Endpoint | Method | Patterns | Description |
|----------|--------|----------|-------------|
| `api/login.php` | POST | Singleton | Authenticate user |
| `api/register.php` | POST | Factory, Singleton | Register patient or doctor |
| `api/book.php` | POST | Proxy, Mediator, Observer | Book appointment |
| `api/accept.php` | POST | Proxy, Mediator, State, Observer | Accept/reject appointment |
| `api/doctors.php` | GET | Singleton | List all doctors |
| `api/appointments.php` | GET | Singleton | Get appointments (patient/doctor) |
| `api/status.php` | POST | State, Observer | Toggle doctor availability |
| `api/availability.php` | POST | State, Observer | Set time slot + notify followers |
| `api/follow.php` | GET/POST | Observer | Follow/unfollow doctor |
| `api/notifications.php` | GET/POST/DELETE | Observer | Manage notifications |
| `api/debug_booking.php` | GET | — | Debug endpoint |

## Stack

- **Backend:** PHP 8.2, MySQL (MariaDB), PDO
- **Frontend:** Vanilla JS, HTML5, CSS3
- **Video:** WebRTC via PeerJS
- **Signaling:** PeerJS cloud server
- **Server:** Apache2 on Ubuntu
- **Virtualization:** Proxmox (Ubuntu VM)

