<?php
// ============================================================
// USER MODEL (Abstract Base Class)
// ============================================================

require_once __DIR__ . '/../config/database.php';

abstract class User {
    public string $userId;
    public string $name;
    public string $email;
    protected string $password;
    public string $phoneNumber;

    public function __construct(
        string $userId,
        string $name,
        string $email,
        string $password,
        string $phoneNumber
    ) {
        $this->userId      = $userId;
        $this->name        = $name;
        $this->email       = $email;
        $this->password    = $password;
        $this->phoneNumber = $phoneNumber;
    }

    public function login(string $email, string $password): bool {
        return $this->email === $email
            && $this->password === $password;
    }

    public function logout(): void {
        session_destroy();
    }

    public function save(): int {
        $db = Database::getInstance();
        $db->save(
            "INSERT INTO users (email, password, role, full_name, phone) VALUES (?, ?, ?, ?, ?)",
            [$this->email, $this->password, $this->getRole(), $this->name, $this->phoneNumber]
        );
        $result = $db->executeQuery("SELECT id FROM users WHERE email = ?", [$this->email]);
        $this->userId = (string)$result[0]['id'];
        return (int)$this->userId;
    }

    abstract protected function getRole(): string;

    public function register(): bool {
        return true;
    }

    public function updateProfile(array $data): void {
        if (isset($data['name']))  $this->name  = $data['name'];
        if (isset($data['phone'])) $this->phoneNumber = $data['phone'];
    }

    public function receiveNotification(array $notification): void {
        // Triggered by Observer pattern – updates UI / sends alert
        echo "Notification for {$this->name}: {$notification['message']}\n";
    }
}