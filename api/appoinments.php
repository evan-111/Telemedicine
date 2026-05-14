<?php
// ============================================================
// API: appointments.php
// Loads appointments from DB for a patient or doctor
// ============================================================
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . '/../config/database.php';

$role      = $_GET['role']      ?? 'patient';
$patientId = $_GET['patientId'] ?? null;
$doctorId  = $_GET['doctorId']  ?? null;

$db = Database::getInstance();

if ($role === 'patient' && $patientId) {
    $rows = $db->executeQuery(
        "SELECT a.id, a.status, a.created_at, a.notes,
                u.full_name AS doctor_name, d.specialty, d.id AS doctor_id,
                r.room_code, av.start_time, av.end_time
         FROM appointments a
         JOIN doctors d ON d.id = a.doctor_id
         JOIN users u ON u.id = d.user_id
         LEFT JOIN rooms r ON r.id = a.room_id
         LEFT JOIN availability av ON av.id = a.slot_id
         WHERE a.patient_id = ?
         ORDER BY a.created_at DESC",
        [$patientId]
    );

    $result = [];
    foreach ($rows as $r) {
        if ($r['start_time']) {
            $dateStr = date('l, d F Y', strtotime($r['start_time']));
            $timeStr = date('h:i A',    strtotime($r['start_time']));
        } else {
            $notes   = json_decode($r['notes'] ?? '{}', true);
            $dateRaw = $notes['date'] ?? null;
            $timeStr = $notes['time'] ?? 'TBC';
            $dateStr = $dateRaw ? date('l, d F Y', strtotime($dateRaw)) : 'TBC';
        }
        $result[] = [
            'id'       => $r['id'],
            'doctorId' => $r['doctor_id'],
            'name'     => 'Dr. ' . $r['doctor_name'],
            'spec'     => $r['specialty'],
            'date'     => $dateStr,
            'time'     => $timeStr,
            'type'     => 'Video Consultation',
            'status'   => $r['status'],
            'roomCode' => $r['room_code'],
            'img'      => 'https://i.pravatar.cc/48?img=' . ($r['doctor_id'] % 70 + 1),
        ];
    }
    echo json_encode(['success' => true, 'appointments' => $result]);

} elseif ($role === 'doctor' && $doctorId) {
    $rows = $db->executeQuery(
        "SELECT a.id, a.status, a.created_at, a.notes,
                u.full_name AS patient_name, p.id AS patient_id,
                r.room_code, av.start_time, av.end_time
         FROM appointments a
         JOIN patients p ON p.id = a.patient_id
         JOIN users u ON u.id = p.user_id
         LEFT JOIN rooms r ON r.id = a.room_id
         LEFT JOIN availability av ON av.id = a.slot_id
         WHERE a.doctor_id = ?
         ORDER BY a.created_at DESC",
        [$doctorId]
    );

    $result = [];
    foreach ($rows as $r) {
        $parsedNotes = json_decode($r['notes'] ?? '{}', true);
        $patientNotes = $parsedNotes['patient_notes'] ?? '';
        if ($r['start_time']) {
            $dateStr = date('l, d F Y', strtotime($r['start_time']));
            $timeStr = date('h:i A',    strtotime($r['start_time']));
        } else {
            $dateRaw = $parsedNotes['date'] ?? null;
            $timeStr = $parsedNotes['time'] ?? 'TBC';
            $dateStr = $dateRaw ? date('l, d F Y', strtotime($dateRaw)) : 'TBC';
        }
        $result[] = [
            'id'          => $r['id'],
            'patientName' => $r['patient_name'],
            'patientId'   => $r['patient_id'],
            'date'        => $dateStr,
            'time'        => $timeStr,
            'notes'       => $patientNotes,
            'type'        => 'Video Consultation',
            'status'      => $r['status'],
            'roomCode'    => $r['room_code'],
            'reason'      => 'Appointment request',
            'created_at'  => $r['created_at'],
            'img'         => 'https://i.pravatar.cc/48?img=' . ($r['patient_id'] % 70 + 1),
        ];
    }
    echo json_encode(['success' => true, 'appointments' => $result]);

} else {
    echo json_encode(['success' => false, 'message' => 'Missing parameters.']);
}
