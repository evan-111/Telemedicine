# Smart Doctor Booking — Telemedicine System
Telemedicine is a school project i have for my software design class where we need to use design pattern to code a health system or a school system , i chose the health system . The primary goal of telemedicine is to demonstrate the design pattern used to build the web system. It is design to centralised all the feature of a online doctor booking system for video consultation with doctors . 

After the my semester have ended and i have gotten my software design class grade , i decided to come back to this project to add more "realistic" feature , previosuly my lecturer only want to see the workings of the design pattern therefore i did not integrate a real webcam system in the code, but now coming back here this is what i want to do with webrtc with my second laptop and my homelab running promxox with ubuntu vm to simulate it.

The design pattern used are:
1. factory pattern
2. observer pattern
3. state pattern
4. mediator and proxy pattern


configuration that i used to set up my ubuntu server in my homelab for this project

1. sudo apt update && apt upgrade -y
2. apt install apache2 php php-mysql mysql-server -y
3. apt install php-curl php-gd php-mbstring php-xml php-zip -y
4. systemctl enable apache2 mysql and systemctl start apache2 mysql
5. git clone https://github.com/your-username/your-repo-name.git .
6. sudo chown -R www-data:www-data /var/www/html
7. sudo chmod -R 755 /var/www/html
8. sudo mysql -u root
9. ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'YourNewPassword123';
10. FLUSH PRIVILEGES;
11. CREATE DATABASE <NAME>;
12. make sure database is connected(below is the the code i use to make sure, make sure is in .php file)

Here is the database connection script used for this project:

```php
<?php
$servername = "localhost";
$username = "root";
$password = "***"; // Use the password you set earlier
$dbname = "consultation_room";

// Create connection
$conn = new mysqli($servername, $username, $password, $dbname);

// Check connection
if ($conn->connect_error) {
    echo "❌ Connection failed: " . $conn->connect_error;
} else {
    echo "✅ Database connected successfully!";
    
    // Check if your tables exist
    $result = $conn->query("SHOW TABLES");
    echo "<br>Tables found: " . $result->num_rows;
}
?>
```



A full-stack telemedicine booking system with video consultation, built with PHP + MySQL + vanilla JS. The architecture demonstrates five GoF design patterns working together.

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
- **Video:** WebRTC (`getUserMedia`)
- **Server:** Apache2 on Ubuntu

