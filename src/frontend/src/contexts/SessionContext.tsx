/**
 * SessionContext.tsx
 *
 * Responsibilities:
 * - Manages global session state (e.g., Session ID | Is Session Active | Session Data).
 * - Stores the current Session configuration.
 * - Handles high-level UI state (e.g., active wizard step).
 *
 * Usage:
 * Wrap the root layout with <SessionProvider> and use useSession()
 * in child components to access or update global state.
 */