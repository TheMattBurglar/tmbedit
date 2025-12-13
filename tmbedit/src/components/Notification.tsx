
import React, { useEffect } from 'react';
import '../App.css';

interface NotificationProps {
    message: string;
    onClose: () => void;
    duration?: number;
}

const Notification: React.FC<NotificationProps> = ({ message, onClose, duration = 3000 }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, duration);

        return () => clearTimeout(timer);
    }, [message, duration, onClose]);

    return (
        <div className="notification-toast">
            {message}
        </div>
    );
};

export default Notification;
