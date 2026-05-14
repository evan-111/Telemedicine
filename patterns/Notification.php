<?php
// ============================================================
// OBSERVER PATTERN - Follow Doctor / Subscribe
// Subject   = Doctor (notifies followers when status changes)
// Observer  = Patient (only subscribed patients get notified)
// Middleman = Notify (connects Doctor to its subscribers)
// ============================================================

require_once __DIR__ . '/../config/database.php';

// ---------- Observer Interface ----------
// Every Patient must implement this to receive notifications
interface Observer {
    public function receiveNotification(array $notification): void;
}

// ---------- Subject Interface ----------
// Doctor acts as the subject that patients subscribe to
interface Subject {
    public function subscribe(Observer $observer): void;
    public function unsubscribe(Observer $observer): void;
    public function notifySubscribers(string $message): void;
}

// ---------- Notification (stores the message) ----------
class Notification {
    public string $notificationId;
    public string $message;
    public string $sentAt;
    public bool   $isRead = false;

    public function __construct(string $notificationId, string $message) {
        $this->notificationId = $notificationId;
        $this->message        = $message;
        $this->sentAt         = date('Y-m-d H:i:s');
    }

    public function markAsRead(): void {
        $this->isRead = true;
        Database::getInstance()->save(
            "UPDATE notifications SET is_read = 1 WHERE id = ?",
            [$this->notificationId]
        );
    }

    public function getNotification(string $userId): array {
        return Database::getInstance()->executeQuery(
            "SELECT * FROM notifications WHERE user_id = ?",
            [$userId]
        );
    }
}

// ---------- Notify (middleman - connects Doctor to Patients) ----------
class Notify {
    // List of patients who followed this doctor
    private array $subscribers = [];

    // Patient follows the doctor
    public function addSubscriber(Observer $observer): void {
        $this->subscribers[] = $observer;
    }

    // Patient unfollows the doctor
    public function removeSubscriber(Observer $observer): void {
        $this->subscribers = array_filter(
            $this->subscribers,
            fn($sub) => $sub !== $observer
        );
    }

    // Push notification to ALL subscribed patients only
    public function notifyUser(string $message, string $doctorName): void {
        foreach ($this->subscribers as $subscriber) {
            $subscriber->receiveNotification([
                'message' => "Dr. {$doctorName}: {$message}",
                'sentAt'  => date('Y-m-d H:i:s'),
            ]);
        }
    }
}

// ---------- DoctorSubject (the Doctor being followed) ----------
class DoctorSubject implements Subject {
    private string $doctorName;
    private int    $doctorId;
    private Notify $notify;

    public function __construct(int $doctorId, string $doctorName) {
        $this->doctorId   = $doctorId;
        $this->doctorName = $doctorName;
        $this->notify     = new Notify();
    }

    // Patient clicks "Follow Doctor"
    public function subscribe(Observer $observer): void {
        $this->notify->addSubscriber($observer);
        echo "{$observer->name} is now following Dr. {$this->doctorName}\n";
    }

    // Patient clicks "Unfollow"
    public function unsubscribe(Observer $observer): void {
        $this->notify->removeSubscriber($observer);
        echo "{$observer->name} unfollowed Dr. {$this->doctorName}\n";
    }

    // Notify only the patients who followed this doctor
    public function notifySubscribers(string $message): void {
        $this->notify->notifyUser($message, $this->doctorName);

        Database::getInstance()->save(
            "INSERT INTO notifications (user_id, type, message)
             SELECT p.user_id, 'reminder', ?
             FROM follows f
             JOIN patients p ON p.id = f.patient_id
             WHERE f.doctor_id = ?",
            [$message, $this->doctorId]
        );
    }

    // Doctor sets new availability - automatically alerts followers
    public function setAvailability(string $startTime, string $endTime): void {
        echo "Dr. {$this->doctorName} set new availability.\n";
        $this->notifySubscribers(
            "New slot available: {$startTime} to {$endTime}. Book now!"
        );
    }
}