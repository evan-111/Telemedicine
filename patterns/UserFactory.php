<?php
// ============================================================
// FACTORY PATTERN - Abstract UserFactory
// Centralizes object creation – no manual if/else type checks
// ============================================================

require_once __DIR__ . '/../models/User.php';
require_once __DIR__ . '/../models/Patient.php';
require_once __DIR__ . '/../models/Doctor.php';

abstract class UserFactory {
    // Subclasses decide which User object to create
    abstract public function createUser(array $data): User;
}

class PatientFactory extends UserFactory {
    public function createUser(array $data): User {
        return new Patient(
            $data['userId'],
            $data['name'],
            $data['email'],
            $data['password'],
            $data['phoneNumber'],
            $data['dateOfBirth']   ?? null,
            $data['medicalHistory'] ?? null
        );
    }
}

class DoctorFactory extends UserFactory {
    public function createUser(array $data): User {
        return new Doctor(
            $data['userId'],
            $data['name'],
            $data['email'],
            $data['password'],
            $data['phoneNumber'],
            $data['specialization'] ?? '',
            $data['licenseNumber']  ?? '',
            $data['rating']         ?? 0.0
        );
    }
}