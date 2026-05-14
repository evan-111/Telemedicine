<?php
// ============================================================
// API: doctors.php
// FIX: reads real status from doctors.status column
//      instead of hardcoding 'Available' for every doctor
// ============================================================
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');
header('Access-Control-Allow-Headers: Content-Type');

error_reporting(E_ALL);
ini_set('display_errors', 0);

try {
    require_once __DIR__ . '/../config/database.php';

    $db = Database::getInstance();

    // FIX: include doctors.status in the SELECT
    $doctors = $db->executeQuery(
        "SELECT d.id, d.specialty, d.license_no, d.status,
                u.full_name, u.email, u.phone
         FROM doctors d
         INNER JOIN users u ON u.id = d.user_id
         ORDER BY u.full_name ASC"
    );

    if (empty($doctors)) {
        echo json_encode(['success' => true, 'doctors' => [], 'debug' => 'No doctors found']);
        exit;
    }

    $specKeyMap = [
        'General Practitioner' => 'general',
        'Cardiologist'         => 'cardiologist',
        'Dermatologist'        => 'dermatologist',
        'Paediatrician'        => 'paediatrician',
        'Neurologist'          => 'neurologist',
    ];

    $result = [];
    foreach ($doctors as $d) {
        $spec      = $d['specialty'] ?? 'General Practitioner';
        // Read real status — defaults to 'Available' if column doesn't exist yet
        $docStatus = $d['status'] ?? 'Available';
        $isBusy    = ($docStatus === 'Busy');

        $result[] = [
            'id'        => (int)$d['id'],
            'name'      => 'Dr. ' . $d['full_name'],
            'spec'      => $spec,
            'specKey'   => $specKeyMap[$spec] ?? 'general',
            'rating'    => 5.0,
            'reviews'   => 0,
            'available' => !$isBusy,
            'status'    => $docStatus,
            'languages' => 'English',
            'img'       => 'https://i.pravatar.cc/80?img=' . ($d['id'] % 70 + 1),
            'followed'  => false,
            'followers' => [],
        ];
    }

    echo json_encode(['success' => true, 'doctors' => $result]);

} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => $e->getMessage(), 'doctors' => []]);
}