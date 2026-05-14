<?php
// ============================================================
// API: availability.php
// STATE PATTERN — doctor sets available time slots
// OBSERVER PATTERN — notifies followers from the `follows` table
// ============================================================
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../patterns/AppoinmentSlotState.php';
require_once __DIR__ . '/../patterns/Notification.php';

$data     = json_decode(file_get_contents('php://input'), true);
$doctorId = $data['doctorId']   ?? null;
$start    = $data['startTime']  ?? null;
$end      = $data['endTime']    ?? null;
$userId   = $data['userId']     ?? null;

if (!$doctorId || !$start || !$end) {
    echo json_encode(['success' => false, 'message' => 'Missing required fields.']);
    exit;
}

try {
    $db = Database::getInstance();

    // Save the availability slot
    $db->save(
        "INSERT INTO availability (doctor_id, start_time, end_time, is_booked) VALUES (?, ?, ?, 0)",
        [$doctorId, $start, $end]
    );

    // ── STATE PATTERN: mark doctor as Available ──────────────
    $availability = new DoctorAvailability($doctorId, true);
    $status       = $availability->getStatus();

    // ── OBSERVER PATTERN: notify followers via DoctorSubject ─
    $doctorInfo = $db->executeQuery(
        "SELECT u.full_name FROM users u JOIN doctors d ON d.user_id = u.id WHERE d.id = ?",
        [$doctorId]
    );
    $doctorName = $doctorInfo[0]['full_name'] ?? 'Doctor';

    // ── OBSERVER: DoctorSubject notifies all followers ───────
    $subject = new DoctorSubject($doctorId, $doctorName);
    $subject->setAvailability(
        date('D d M Y, h:i A', strtotime($start)),
        date('h:i A', strtotime($end))
    );

    echo json_encode([
        'success'       => true,
        'message'       => 'Availability saved! State: ' . $status . '. Patients notified via Observer.',
        'doctorStatus'  => $status,
    ]);

} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}