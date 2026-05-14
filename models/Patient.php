<?php
// ============================================================
// PATIENT MODEL
// ============================================================

require_once __DIR__ . '/User.php';
require_once __DIR__ . '/../patterns/Notification.php';

class Patient extends User implements Observer {
    public string $patientId;
    public ?string $dateOfBirth;
    public ?string $medicalHistory;

    protected function getRole(): string { return 'patient'; }

    public function save(): int {
        $userId = parent::save();
        $db = Database::getInstance();
        $db->save("INSERT INTO patients (user_id) VALUES (?)", [$userId]);
        $this->patientId = (string)$userId;
        return $userId;
    }

    public function __construct(
        string $userId,
        string $name,
        string $email,
        string $password,
        string $phoneNumber,
        ?string $dateOfBirth   = null,
        ?string $medicalHistory = null
    ) {
        parent::__construct($userId, $name, $email, $password, $phoneNumber);
        $this->patientId     = $userId;
        $this->dateOfBirth   = $dateOfBirth;
        $this->medicalHistory = $medicalHistory;
    }

    public function bookAppointment(int $doctorId, string $slotId): void {
        // Delegates through AppointmentSystemProxy
        echo "Patient {$this->name} is booking appointment with doctor #{$doctorId}\n";
    }

    public function cancelAppointment(int $appointmentId): void {
        echo "Patient {$this->name} cancelled appointment #{$appointmentId}\n";
    }

    public function viewAppointment(): array {
        // Returns list of patient appointments
        return [];
    }
}