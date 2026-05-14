<?php
// ============================================================
// API: status.php
// STATE + OBSERVER PATTERN — doctor toggles Available / Busy
// FIX: writes to doctors.status column directly so it works
//      even when no availability slots have been added yet
// ============================================================
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . '/../config/database.php';

$data       = json_decode(file_get_contents('php://input'), true);
$doctorId   = $data['doctorId']   ?? null;
$doctorName = $data['doctorName'] ?? 'Doctor';
$status     = $data['status']     ?? 'Available';

if (!$doctorId) {
    echo json_encode(['success' => false, 'message' => 'Missing doctorId.']);
    exit;
}

try {
    $db = Database::getInstance();

    // ── STATE PATTERN: save status on doctors table ──────────
    // FIX: old code updated availability rows which may not exist
    //      → silent no-op → patient always saw Available
    $db->save(
        "UPDATE doctors SET status = ? WHERE id = ?",
        [$status, (int)$doctorId]
    );

    // Verify the update worked
    $check = $db->executeQuery("SELECT status FROM doctors WHERE id = ?", [(int)$doctorId]);
    if (empty($check)) {
        echo json_encode(['success' => false, 'message' => "Doctor id={$doctorId} not found."]);
        exit;
    }
    if ($check[0]['status'] !== $status) {
        echo json_encode([
            'success' => false,
            'message' => "status column missing on doctors table — run add_doctor_status_column.sql in phpMyAdmin",
        ]);
        exit;
    }

    // Also keep availability rows in sync if they exist
    $isBooked = ($status === 'Busy') ? 1 : 0;
    $db->save("UPDATE availability SET is_booked = ? WHERE doctor_id = ?", [$isBooked, (int)$doctorId]);

    // ── OBSERVER: notify followers ────────────────────────────
    try {
        $followers = $db->executeQuery(
            "SELECT p.user_id FROM follows f
             JOIN patients p ON p.id = f.patient_id
             WHERE f.doctor_id = ?",
            [(int)$doctorId]
        );
    } catch (Exception $e) {
        echo json_encode(['success' => true, 'message' => "Status set to {$status}. (follows table missing)", 'notifiedCount' => 0]);
        exit;
    }

    if (empty($followers)) {
        echo json_encode(['success' => true, 'message' => "Status set to {$status}. No followers to notify.", 'doctorStatus' => $status, 'notifiedCount' => 0]);
        exit;
    }

    $message = ($status === 'Available')
        ? "Dr. {$doctorName} is now Available for appointments. Book now!"
        : "Dr. {$doctorName} is currently Busy and not accepting new appointments.";

    $cols           = $db->executeQuery("DESCRIBE notifications");
    $apptIdNullable = true;
    foreach ($cols as $col) {
        if ($col['Field'] === 'appointment_id' && $col['Null'] === 'NO') {
            $apptIdNullable = false;
            break;
        }
    }

    $notifiedCount = 0;
    foreach ($followers as $follower) {
        try {
            if ($apptIdNullable) {
                $db->save("INSERT INTO notifications (user_id, type, message) VALUES (?, 'reminder', ?)", [$follower['user_id'], $message]);
            } else {
                $db->save("INSERT INTO notifications (user_id, appointment_id, type, message) VALUES (?, 0, 'reminder', ?)", [$follower['user_id'], $message]);
            }
            $notifiedCount++;
        } catch (Exception $ignored) {}
    }

    echo json_encode([
        'success'       => true,
        'message'       => "Status set to {$status}. {$notifiedCount} follower(s) notified.",
        'doctorStatus'  => $status,
        'notifiedCount' => $notifiedCount,
    ]);

} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}