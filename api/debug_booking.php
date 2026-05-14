<?php
// ============================================================
// debug_booking.php
// Visit: http://localhost/Software_Design/api/debug_booking.php
// Traces every step of the booking chain to find exact failure
// ============================================================
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$report = [];

// ── STEP 1: Can we load database.php? ───────────────────────
try {
    require_once __DIR__ . '/../config/database.php';
    $report['step1_database_php'] = '✅ Loaded';
} catch (Throwable $e) {
    $report['step1_database_php'] = '❌ ' . $e->getMessage();
    echo json_encode($report, JSON_PRETTY_PRINT); exit;
}

// ── STEP 2: DB connection works? ────────────────────────────
try {
    $db = Database::getInstance();
    $db->executeQuery("SELECT 1");
    $report['step2_db_connection'] = '✅ Connected';
} catch (Throwable $e) {
    $report['step2_db_connection'] = '❌ ' . $e->getMessage();
    echo json_encode($report, JSON_PRETTY_PRINT); exit;
}

// ── STEP 3: Does AppointmentSystemProxy.php exist? ──────────
$correctName = __DIR__ . '/../patterns/AppointmentSystemProxy.php';
$typoName    = __DIR__ . '/../patterns/AppoinmentSystemProxy.php';

if (file_exists($correctName)) {
    $report['step3_proxy_file'] = '✅ AppointmentSystemProxy.php (correct spelling)';
    $proxyFile = $correctName;
} elseif (file_exists($typoName)) {
    $report['step3_proxy_file'] = '⚠️  AppoinmentSystemProxy.php (typo name — book.php requires wrong spelling, this is your bug!)';
    $proxyFile = $typoName;
} else {
    $report['step3_proxy_file'] = '❌ Neither AppointmentSystemProxy.php nor AppoinmentSystemProxy.php found in patterns/';
    echo json_encode($report, JSON_PRETTY_PRINT); exit;
}

// ── STEP 4: Can we load the proxy file? ─────────────────────
try {
    require_once __DIR__ . '/../models/User.php';
    require_once __DIR__ . '/../models/Patient.php';
    require_once $proxyFile;
    $report['step4_proxy_load'] = '✅ Loaded';
} catch (Throwable $e) {
    $report['step4_proxy_load'] = '❌ ' . $e->getMessage();
    echo json_encode($report, JSON_PRETTY_PRINT); exit;
}

// ── STEP 5: Does appointments table exist? ──────────────────
try {
    $cols = $db->executeQuery("DESCRIBE appointments");
    $report['step5_appointments_table'] = '✅ Exists';
    $report['step5_appointments_columns'] = array_map(fn($c) => [
        'field'   => $c['Field'],
        'type'    => $c['Type'],
        'null'    => $c['Null'],
        'default' => $c['Default'],
    ], $cols);
} catch (Throwable $e) {
    $report['step5_appointments_table'] = '❌ ' . $e->getMessage();
    echo json_encode($report, JSON_PRETTY_PRINT); exit;
}

// ── STEP 6: Is slot_id nullable? ────────────────────────────
foreach ($cols as $col) {
    if ($col['Field'] === 'slot_id') {
        $nullable = ($col['Null'] === 'YES');
        $report['step6_slot_id'] = $nullable
            ? '✅ slot_id is nullable — NULL inserts are fine'
            : '❌ slot_id is NOT NULL — inserting NULL will crash (this may be your bug!)';
    }
}
if (!isset($report['step6_slot_id'])) {
    $report['step6_slot_id'] = '⚠️  No slot_id column found in appointments';
}

// ── STEP 7: Check existing patients and doctors ─────────────
$patients = $db->executeQuery("SELECT id, user_id FROM patients LIMIT 3");
$doctors  = $db->executeQuery("SELECT id, user_id, status FROM doctors LIMIT 3");
$report['step7_sample_patients'] = $patients ?: '(none)';
$report['step7_sample_doctors']  = $doctors  ?: '(none)';

// ── STEP 8: Try a real INSERT (then roll back via DELETE) ────
if (!empty($patients) && !empty($doctors)) {
    $testPatientId = $patients[0]['id'];
    $testDoctorId  = $doctors[0]['id'];
    try {
        // Try insert WITHOUT slot_id
        $db->save(
            "INSERT INTO appointments (doctor_id, patient_id, status) VALUES (?, ?, 'pending')",
            [$testDoctorId, $testPatientId]
        );
        // Clean up
        $db->save(
            "DELETE FROM appointments WHERE doctor_id = ? AND patient_id = ? AND status = 'pending' ORDER BY id DESC LIMIT 1",
            [$testDoctorId, $testPatientId]
        );
        $report['step8_test_insert'] = '✅ INSERT without slot_id succeeded';
    } catch (Throwable $e) {
        $report['step8_test_insert'] = '❌ INSERT failed: ' . $e->getMessage();
    }
}

echo json_encode($report, JSON_PRETTY_PRINT);