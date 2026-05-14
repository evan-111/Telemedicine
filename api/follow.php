<?php
// ============================================================
// API: follow.php
// OBSERVER PATTERN — patient subscribes/unsubscribes to doctor
// Persists follow relationships to the `follows` table
// GET  ?patientId=X  → returns all doctorIds followed by patient
// POST {patientId, doctorId, action:'follow'|'unfollow'}
// ============================================================
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . '/../config/database.php';

$db     = Database::getInstance();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    // ── Load all doctor IDs this patient follows ─────────────
    $patientId = $_GET['patientId'] ?? null;
    if (!$patientId) {
        echo json_encode(['success' => false, 'message' => 'Missing patientId.']);
        exit;
    }

    $rows      = $db->executeQuery(
        "SELECT doctor_id FROM follows WHERE patient_id = ?",
        [$patientId]
    );
    $doctorIds = array_column($rows, 'doctor_id');
    echo json_encode(['success' => true, 'followedDoctorIds' => $doctorIds]);

} elseif ($method === 'POST') {
    $data      = json_decode(file_get_contents('php://input'), true);
    $patientId = $data['patientId'] ?? null;
    $doctorId  = $data['doctorId']  ?? null;
    $action    = $data['action']    ?? 'follow'; // 'follow' or 'unfollow'

    if (!$patientId || !$doctorId) {
        echo json_encode(['success' => false, 'message' => 'Missing required fields.']);
        exit;
    }

    try {
        if ($action === 'follow') {
            // INSERT IGNORE avoids duplicate-key errors
            $db->save(
                "INSERT IGNORE INTO follows (patient_id, doctor_id) VALUES (?, ?)",
                [$patientId, $doctorId]
            );
            echo json_encode(['success' => true, 'message' => 'Followed successfully.', 'following' => true]);
        } else {
            $db->save(
                "DELETE FROM follows WHERE patient_id = ? AND doctor_id = ?",
                [$patientId, $doctorId]
            );
            echo json_encode(['success' => true, 'message' => 'Unfollowed successfully.', 'following' => false]);
        }
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
} else {
    echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
}