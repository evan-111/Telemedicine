<?php
// ============================================================
// API: book.php  (PROXY + MEDIATOR PATTERN)
//
// PROXY    = AppointmentSystemProxy — checks access + validates
// MEDIATOR = ManagementMediator    — handles the DB INSERT
// ============================================================
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../models/User.php';
require_once __DIR__ . '/../models/Patient.php';
require_once __DIR__ . '/../patterns/AppoinmentSystemProxy.php';

$input         = json_decode(file_get_contents('php://input'), true);
$patientId     = $input['patientId'] ?? null;
$doctorId      = $input['doctorId']  ?? null;
$userId        = $input['userId']    ?? null;

if (!$patientId || !$doctorId || !$userId) {
    echo json_encode(['success' => false, 'message' => 'Missing required fields.']);
    exit;
}

try {
    $db    = Database::getInstance();
    $users = $db->executeQuery("SELECT * FROM users WHERE id = ?", [$userId]);
    if (empty($users)) {
        echo json_encode(['success' => false, 'message' => 'User not found.']);
        exit;
    }

    $u       = $users[0];
    $patient = new Patient($u['id'], $u['full_name'], $u['email'], '', $u['phone'] ?? '');

    // ── PROXY: delegates to mediator after access check ──
    $proxy = new AppointmentSystemProxy($patient);
    $result = $proxy->book($input);
    $newApptId = $result['appointmentId'];

    // ── OBSERVER (via raw SQL — see Observer pattern file) ─
    $doctor = $db->executeQuery(
        "SELECT u.id FROM users u JOIN doctors d ON d.user_id = u.id WHERE d.id = ?",
        [$doctorId]
    );
    if (!empty($doctor)) {
        $notifCols = $db->executeQuery("DESCRIBE notifications");
        $apptNullable = true;
        foreach ($notifCols as $col) {
            if ($col['Field'] === 'appointment_id' && $col['Null'] === 'NO') {
                $apptNullable = false; break;
            }
        }
        if ($apptNullable) {
            $db->save(
                "INSERT INTO notifications (user_id, type, message) VALUES (?, 'appointment_request', ?)",
                [$doctor[0]['id'], "{$u['full_name']} has requested an appointment."]
            );
        } else {
            $db->save(
                "INSERT INTO notifications (user_id, appointment_id, type, message) VALUES (?, ?, 'appointment_request', ?)",
                [$doctor[0]['id'], $newApptId ?? 0, "{$u['full_name']} has requested an appointment."]
            );
        }
    }

    echo json_encode([
        'success'       => true,
        'message'       => 'Appointment booked successfully!',
        'appointmentId' => $newApptId,
    ]);

} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
