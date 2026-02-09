import { useState, useEffect } from 'react';

export function useNetworkStatus() {
    const [status, setStatus] = useState({
        isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
        isChecking: true
    });

    useEffect(() => {
        const checkConnection = async () => {
            if (!navigator.onLine) {
                setStatus({ isOnline: false, isChecking: false });
                return;
            }

            try {
                // Try to reach a reliable public endpoint to confirm internet access
                // Using no-cors mode to avoid CORS errors, but still detect network failure
                await fetch('https://www.google.com/favicon.ico', {
                    mode: 'no-cors',
                    cache: 'no-store'
                });
                setStatus({ isOnline: true, isChecking: false });
            } catch (error) {
                console.log("Internet check failed:", error);
                setStatus({ isOnline: false, isChecking: false });
            }
        };

        // Initial check
        checkConnection();

        // Listeners for offline/online events
        const handleOnline = () => {
            setStatus(prev => ({ ...prev, isChecking: true }));
            // Delay slightly to allow network stack to initialize
            setTimeout(checkConnection, 1000);
        };
        const handleOffline = () => setStatus({ isOnline: false, isChecking: false });

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Optional: Periodic check every 30s to detect silent dropouts
        const interval = setInterval(checkConnection, 30000);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            clearInterval(interval);
        };
    }, []);

    return status;
}
