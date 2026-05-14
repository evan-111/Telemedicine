<?php
// ============================================================
// SINGLETON PATTERN - Database Connection
// Ensures only ONE database instance exists system-wide
// ============================================================

class Database {
    private static ?Database $instance = null;
    private ?PDO $connection = null;

    private string $host     = 'localhost';
    private string $dbname   = 'telemedicine';
    private string $username = 'root';
    private string $password = '';

    // Private constructor – prevents direct instantiation
    private function __construct() {}

    // Global access point to the single instance
    public static function getInstance(): Database {
        if (self::$instance === null) {
            self::$instance = new Database();
        }
        return self::$instance;
    }

    // Connect to MySQL using PDO
    public function connect(): PDO {
        if ($this->connection === null) {
            $dsn = "mysql:host={$this->host};dbname={$this->dbname};charset=utf8";
            $this->connection = new PDO($dsn, $this->username, $this->password, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
            ]);
        }
        return $this->connection;
    }

    // Execute a SELECT query and return results
    public function executeQuery(string $sql, array $params = []): array {
        $stmt = $this->connect()->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    // Execute INSERT / UPDATE / DELETE
    public function save(string $sql, array $params = []): bool {
        $stmt = $this->connect()->prepare($sql);
        return $stmt->execute($params);
    }

    // Fetch appointments by patient ID
    public function getByPatient(int $patientId): array {
        return $this->executeQuery(
            "SELECT * FROM appointments WHERE patient_id = ?",
            [$patientId]
        );
    }
}