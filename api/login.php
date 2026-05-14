<?php
// ============================================================
// API: login.php
// Uses SINGLETON for DB connection
// ============================================================
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . '/../config/database.php';

$data     = json_decode(file_get_contents('php://input'), true);
$email    = trim($data['email']    ?? '');
$password = trim($data['password'] ?? '');

if (!$email || !$password) {
    echo json_encode(['success' => false, 'message' => 'Missing email or password.']);
    exit;
}

// ── SINGLETON: single DB instance ───────────────────────────
$db = Database::getInstance();

$users = $db->executeQuery(
    "SELECT u.id, u.email, u.password, u.role, u.full_name, u.phone,
            d.id AS doctor_id, d.specialty, d.license_no,
            p.id AS patient_id
     FROM users u
     LEFT JOIN doctors d ON d.user_id = u.id
     LEFT JOIN patients p ON p.user_id = u.id
     WHERE u.email = ?",
    [$email]
);

if (empty($users)) {
    echo json_encode(['success' => false, 'message' => 'Incorrect email or password.']);
    exit;
}

$user = $users[0];

if ($user['password'] !== $password) {
    echo json_encode(['success' => false, 'message' => 'Incorrect email or password.']);
    exit;
}

echo json_encode([
    'success'    => true,
    'role'       => $user['role'],
    'name'       => $user['full_name'],
    'email'      => $user['email'],
    'userId'     => $user['id'],
    'doctorId'   => $user['doctor_id'],
    'patientId'  => $user['patient_id'],
    'specialty'  => $user['specialty'],
    'license_no' => $user['license_no'] ?? '',
]);