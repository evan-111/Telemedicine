<?php
// ============================================================
// API: register.php
// Uses FACTORY PATTERN to create Patient or Doctor
// Uses SINGLETON for DB connection
// ============================================================
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../models/User.php';
require_once __DIR__ . '/../models/Patient.php';
require_once __DIR__ . '/../models/Doctor.php';

require_once __DIR__ . '/../patterns/UserFactory.php';

$data = json_decode(file_get_contents('php://input'), true);

$name     = trim($data['name']     ?? '');
$email    = trim($data['email']    ?? '');
$password = trim($data['password'] ?? '');
$role     = trim($data['role']     ?? 'patient');
$phone    = trim($data['phone']    ?? '');
$spec     = trim($data['specialization'] ?? '');
$license  = trim($data['licenseNumber']  ?? '');

if (!$name || !$email || !$password) {
    echo json_encode(['success' => false, 'message' => 'Missing required fields.']);
    exit;
}

$db = Database::getInstance();

$existing = $db->executeQuery("SELECT id FROM users WHERE email = ?", [$email]);
if (!empty($existing)) {
    echo json_encode(['success' => false, 'message' => 'Email already registered.']);
    exit;
}

try {
    // ── FACTORY PATTERN: create correct User subclass and save to DB ─
    $factory = $role === 'doctor' ? new DoctorFactory() : new PatientFactory();
    $user = $factory->createUser([
        'userId' => 0, 'name' => $name, 'email' => $email,
        'password' => $password, 'phoneNumber' => $phone,
        'specialization' => $spec, 'licenseNumber' => $license,
    ]);
    $newUserId = $user->save();

    echo json_encode([
        'success' => true,
        'message' => ucfirst($role) . ' registered successfully!',
        'role'    => $role,
        'name'    => $name,
    ]);

} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Registration failed: ' . $e->getMessage()]);
}
