<?php
// ============================================================
// DOCTOR MODEL
// ============================================================

require_once __DIR__ . '/User.php';

class Doctor extends User {
    public string $doctorId;
    public string $specialization;
    public string $licenseNumber;
    public float  $rating;

    protected function getRole(): string { return 'doctor'; }

    public function save(): int {
        $userId = parent::save();
        $db = Database::getInstance();
        $db->save("INSERT INTO doctors (user_id, specialty, license_no) VALUES (?, ?, ?)", [$userId, $this->specialization, $this->licenseNumber]);
        $this->doctorId = (string)$userId;
        return $userId;
    }

    public function __construct(
        string $userId,
        string $name,
        string $email,
        string $password,
        string $phoneNumber,
        string $specialization,
        string $licenseNumber,
        float  $rating = 0.0
    ) {
        parent::__construct($userId, $name, $email, $password, $phoneNumber);
        $this->doctorId       = $userId;
        $this->specialization = $specialization;
        $this->licenseNumber  = $licenseNumber;
        $this->rating         = $rating;
    }

    public function viewSchedule(): array {
        // Returns doctor's upcoming appointments
        return [];
    }

    public function setAvailability(string $startTime, string $endTime): void {
        echo "Doctor {$this->name} set availability: {$startTime} - {$endTime}\n";
    }
}