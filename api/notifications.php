<?php
// ============================================================
// API: notifications.php
// OBSERVER PATTERN — loads notifications for a user
// ============================================================
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . '/../config/database.php';

$db     = Database::getInstance();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $userId = $_GET['userId'] ?? null;
    if (!$userId) { echo json_encode(['success' => false, 'message' => 'Missing userId.']); exit; }

    $notifs = $db->executeQuery(
        "SELECT id, message, is_read, sent_at, type FROM notifications WHERE user_id = ? ORDER BY sent_at DESC",
        [$userId]
    );
    echo json_encode(['success' => true, 'notifications' => $notifs]);

} elseif ($method === 'POST') {
    // Mark notification as read
    $data = json_decode(file_get_contents('php://input'), true);
    $id   = $data['id'] ?? null;
    if ($id) {
        $db->save("UPDATE notifications SET is_read = 1 WHERE id = ?", [$id]);
    }
    echo json_encode(['success' => true]);

} elseif ($method === 'DELETE') {
    $data   = json_decode(file_get_contents('php://input'), true);
    $userId = $data['userId'] ?? null;
    $id     = $data['id'] ?? null;
    if ($id) {
        $db->save("DELETE FROM notifications WHERE id = ?", [$id]);
    } elseif ($userId) {
        $db->save("DELETE FROM notifications WHERE user_id = ?", [$userId]);
    }
    echo json_encode(['success' => true]);
}