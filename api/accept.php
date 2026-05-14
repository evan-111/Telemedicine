<?php
// ============================================================
// API: accept.php
// Doctor accepts or rejects an appointment
// Uses PROXY + MEDIATOR + STATE + OBSERVER patterns
// ============================================================
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../models/User.php';
require_once __DIR__ . '/../models/Doctor.php';
require_once __DIR__ . '/../models/Patient.php';
require_once __DIR__ . '/../patterns/AppoinmentSystemProxy.php';
require_once __DIR__ . '/../patterns/AppoinmentSlotState.php';
require_once __DIR__ . '/../patterns/Notification.php';

$data          = json_decode(file_get_contents('php://input'), true);
$appointmentId = $data['appointmentId'] ?? null;
$doctorUserId  = $data['doctorUserId']  ?? null;
$action        = $data['action']        ?? 'accepted';

if (!$appointmentId || !$doctorUserId) {
    echo json_encode(['success' => false, 'message' => 'Missing required fields.']);
    exit;
}

try {
    $db = Database::getInstance();

    $doctorUsers = $db->executeQuery("SELECT * FROM users WHERE id = ?", [$doctorUserId]);
    if (empty($doctorUsers)) {
        echo json_encode(['success' => false, 'message' => 'Doctor not found.']);
        exit;
    }
    $du = $doctorUsers[0];

    $doctor = new Doctor($du['id'], $du['full_name'], $du['email'], '', $du['phone'] ?? '', $du['specialty'] ?? '', '');
    $proxy  = new AppointmentSystemProxy($doctor);

    $appts = $db->executeQuery(
        "SELECT a.*, d.id AS doc_id FROM appointments a JOIN doctors d ON d.id = a.doctor_id WHERE a.id = ?",
        [$appointmentId]
    );
    if (empty($appts)) {
        echo json_encode(['success' => false, 'message' => 'Appointment not found.']);
        exit;
    }
    $appt = $appts[0];

    if (!in_array($appt['status'], ['pending', 'accepted'])) {
        echo json_encode(['success' => false, 'message' => "Appointment is already '{$appt['status']}' — cannot change again."]);
        exit;
    }

    if ($action === 'accepted') {

        // STATE: mark doctor Busy
        $av = new DoctorAvailability($appt['doc_id'], true);
        $av->book();

        // PROXY → MEDIATOR: create room + update appointment
        $result = $proxy->accept($appointmentId, $appt['doc_id']);
        $roomCode = $result['roomCode'];

        // OBSERVER: notify patient
        $patientUsers = $db->executeQuery(
            "SELECT u.id, u.full_name FROM users u JOIN patients p ON p.user_id = u.id WHERE p.id = ?",
            [$appt['patient_id']]
        );
        if (!empty($patientUsers)) {
            $pu      = $patientUsers[0];
            $message = "Your appointment with Dr. {$du['full_name']} has been accepted! Room code: {$roomCode}.";
            $notif   = new Notification(uniqid(), $message);
            $message = $notif->message;
            $db->save(
                "INSERT INTO notifications (user_id, appointment_id, type, message) VALUES (?, ?, 'appointment_accepted', ?)",
                [$pu['id'], $appointmentId, $message]
            );
        }

        echo json_encode(['success' => true, 'message' => 'Appointment accepted and room created!', 'roomCode' => $roomCode, 'roomId' => $result['roomId']]);

    } else {

        // STATE: slot back to Available
        $av = new DoctorAvailability($appt['doc_id'], false);
        $av->cancel();

        // PROXY → MEDIATOR: reject appointment
        $proxy->reject($appointmentId, $appt['doc_id']);

        // OBSERVER: notify patient
        $patientUsers = $db->executeQuery(
            "SELECT u.id FROM users u JOIN patients p ON p.user_id = u.id WHERE p.id = ?",
            [$appt['patient_id']]
        );
        if (!empty($patientUsers)) {
            $db->save(
                "INSERT INTO notifications (user_id, appointment_id, type, message) VALUES (?, ?, 'appointment_rejected', ?)",
                [$patientUsers[0]['id'], $appointmentId, "Your appointment with Dr. {$du['full_name']} was not accepted."]
            );
        }

        echo json_encode(['success' => true, 'message' => 'Appointment rejected.']);
    }

} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
