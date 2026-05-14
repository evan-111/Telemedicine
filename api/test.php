<?php
// ============================================================
// DEBUG FILE - visit http://localhost/Software_Design/api/test.php
// This will show you exactly what is in your database
// DELETE this file after debugging
// ============================================================
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . '/../config/database.php';

$db = Database::getInstance();

$users   = $db->executeQuery("SELECT id, email, role, full_name FROM users");
$doctors = $db->executeQuery("SELECT d.id, d.user_id, d.specialty, u.full_name FROM doctors d JOIN users u ON u.id = d.user_id");
$patients = $db->executeQuery("SELECT p.id, p.user_id, u.full_name FROM patients p JOIN users u ON u.id = p.user_id");

echo json_encode([
    'users'    => $users,
    'doctors'  => $doctors,
    'patients' => $patients,
], JSON_PRETTY_PRINT);