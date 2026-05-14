<?php
// ============================================================
// STATE PATTERN - Doctor Availability
// Doctor delegates behaviour to its current state object
// Avoids massive if/else checks for doctor availability
// ============================================================

// ---------- State Interface ----------
interface State {
    public function handleBook(): void;
    public function handleCancel(): void;
    public function getLabel(): string;
}

// ---------- AvailableState ---------
// Doctor is free and can accept appointments
class AvailableState implements State {

    public function handleBook(): void {
        echo "Doctor is available. Appointment request accepted.\n";
    }

    public function handleCancel(): void {
        echo "No active booking. Doctor remains available.\n";
    }

    public function getLabel(): string {
        return "Available";
    }
}

// ---------- BusyState ---------
// Doctor is occupied and cannot accept new appointments
class BusyState implements State {

    public function handleBook(): void {
        echo "Doctor is busy. Cannot accept appointment at this time.\n";
    }

    public function handleCancel(): void {
        echo "Appointment cancelled. Doctor is now available again.\n";
    }

    public function getLabel(): string {
        return "Busy";
    }
}

// ---------- Context: Doctor Availability ----------
class DoctorAvailability {
    private State $state;
    private int $doctorId;

    public function __construct(int $doctorId, bool $isAvailable = true) {
        $this->doctorId = $doctorId;
        // Set initial state based on doctor's current availability
        $this->state = $isAvailable ? new AvailableState() : new BusyState();
    }

    public function setState(State $state): void {
        $this->state = $state;
    }

    // Patient tries to book this doctor
    public function book(): void {
        $this->state->handleBook();
        // After booking, doctor becomes Busy
        $this->setState(new BusyState());
        $this->updateDatabase("Busy");
    }

    // Appointment is cancelled, doctor becomes free again
    public function cancel(): void {
        $this->state->handleCancel();
        // After cancel, doctor becomes Available again
        $this->setState(new AvailableState());
        $this->updateDatabase("Available");
    }

    // Get current availability label
    public function getStatus(): string {
        return $this->state->getLabel();
    }

    // Sync the state change back to the database
    private function updateDatabase(string $status): void {
        require_once __DIR__ . '/../config/database.php';
        $isBooked = ($status === "Busy") ? 1 : 0;
        Database::getInstance()->save(
            "UPDATE availability SET is_booked = ? WHERE doctor_id = ?",
            [$isBooked, $this->doctorId]
        );
    }
}