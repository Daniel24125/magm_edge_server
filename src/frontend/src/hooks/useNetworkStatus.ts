import { useState, useEffect } from 'react';

export function useNetworkStatus() {
    const isKiosk = process.env.NEXT_PUBLIC_IS_KIOSK === 'true';
    const [status, setStatus] = useState({
        isOnline: isKiosk ? false : (typeof navigator !== 'undefined' ? navigator.onLine : true),
        isChecking: true
    });

    useEffect(() => {
        if (isKiosk) {
            setStatus({ isOnline: false, isChecking: false });
            return;
        }


        // Listeners for offline/online events
        const handleOnline = () => {
            setStatus(prev => ({ ...prev, isChecking: false }));
        };
        const handleOffline = () => {
            setStatus({ isOnline: false, isChecking: false });
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        setStatus(prev => ({ ...prev, isChecking: false }));

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    return status;
}
