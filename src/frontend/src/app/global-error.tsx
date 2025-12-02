"use client";
import "./globals.css";

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <html>
            <body>
                <div className="flex min-h-screen flex-col items-center justify-center bg-gray-900 text-white p-4 text-center">
                    <h1 className="text-4xl font-bold mb-4 text-red-500">Critical Error</h1>
                    <p className="mb-8 text-gray-300">The application encountered a critical failure.</p>
                    <button
                        onClick={() => reset()}
                        className="px-6 py-3 bg-red-600 rounded hover:bg-red-700 transition-colors font-semibold"
                    >
                        Reload Application
                    </button>
                </div>
            </body>
        </html>
    );
}
