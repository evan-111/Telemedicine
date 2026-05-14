<?php
// ============================================================
// PROXY + MEDIATOR PATTERN - Appointment System
// Proxy = gatekeeper (auth + validation)
// Mediator = centralizes business logic + DB operations
// ============================================================

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../models/User.php';

// ============================================================
// MEDIATOR – coordinates DB operations for appointments
// ============================================================
class ManagementMediator {

    public function saveToDatabase(array $data): array {
        $this->validate($data);
        $db       = Database::getInstance();
        $slotId   = $data['slotId'] ?? null;
        $notesJson = json_encode([
            'date' => $data['date'] ?? null,
            'time' => $data['time'] ?? null,
            'patient_notes' => $data['patientNotes'] ?? '',
        ]);

        if ($slotId !== null) {
            $db->save(
                "INSERT INTO appointments (doctor_id, patient_id, slot_id, status, notes) VALUES (?, ?, ?, 'pending', ?)",
                [$data['doctorId'], $data['patientId'], $slotId, $notesJson]
            );
        } else {
            $db->save(
                "INSERT INTO appointments (doctor_id, patient_id, status, notes) VALUES (?, ?, 'pending', ?)",
                [$data['doctorId'], $data['patientId'], $notesJson]
            );
        }

        $appts = $db->executeQuery(
            "SELECT id FROM appointments WHERE patient_id = ? AND doctor_id = ? ORDER BY id DESC LIMIT 1",
            [$data['patientId'], $data['doctorId']]
        );
        return ['appointmentId' => $appts[0]['id'] ?? null];
    }

    public function accept(int $appointmentId, int $doctorId): array {
        $db = Database::getInstance();

        $roomCode  = 'ROOM-' . strtoupper(bin2hex(random_bytes(2))) . '-' . strtoupper(bin2hex(random_bytes(2)));
        $expiresAt = date('Y-m-d H:i:s', strtotime('+2 hours'));
        $db->save("INSERT INTO rooms (room_code, status, expires_at) VALUES (?, 'active', ?)", [$roomCode, $expiresAt]);
        $rooms  = $db->executeQuery("SELECT id FROM rooms WHERE room_code = ?", [$roomCode]);
        $roomId = $rooms[0]['id'];

        $db->save("UPDATE appointments SET status = 'accepted', room_id = ? WHERE id = ?", [$roomId, $appointmentId]);
        $db->save("UPDATE availability SET is_booked = 1 WHERE doctor_id = ?", [$doctorId]);

        return ['roomCode' => $roomCode, 'roomId' => $roomId];
    }

    public function reject(int $appointmentId, int $doctorId): void {
        $db = Database::getInstance();
        $db->save("UPDATE appointments SET status = 'rejected' WHERE id = ?", [$appointmentId]);
        $db->save("UPDATE availability SET is_booked = 0 WHERE doctor_id = ?", [$doctorId]);
    }

    private function validate(array $data): void {
        if (empty($data['doctorId']) || empty($data['patientId'])) {
            throw new InvalidArgumentException("Missing required appointment fields.");
        }
    }
}

// ============================================================
// PROXY – intercepts requests, checks access before passing
//         to the ManagementMediator
// ============================================================
class AppointmentSystemProxy {
    private ?User $currentUser;
    private ManagementMediator $mediator;

    public function __construct(?User $currentUser) {
        $this->currentUser = $currentUser;
        $this->mediator    = new ManagementMediator();
    }

    public function book(array $appointmentData): array {
        if (!$this->checkAccess()) {
            throw new Exception("Access denied: User not logged in.");
        }
        if (!$this->isValid($appointmentData)) {
            throw new Exception("Validation failed: Invalid appointment data.");
        }
        return $this->mediator->saveToDatabase($appointmentData);
    }

    public function accept(int $appointmentId, int $doctorId): array {
        if (!$this->checkAccess()) {
            throw new Exception("Access denied: User not logged in.");
        }
        return $this->mediator->accept($appointmentId, $doctorId);
    }

    public function reject(int $appointmentId, int $doctorId): void {
        if (!$this->checkAccess()) {
            throw new Exception("Access denied: User not logged in.");
        }
        $this->mediator->reject($appointmentId, $doctorId);
    }

    public function checkAccess(): bool {
        return $this->currentUser !== null;
    }

    private function isValid(array $data): bool {
        return isset($data['doctorId'], $data['patientId']);
    }
}
