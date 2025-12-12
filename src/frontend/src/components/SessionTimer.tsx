"use client";

import { useSession } from "@/contexts/SessionContext";
import { usePathname, useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { formatDuration } from "@/lib/utils";

const SessionTimer = () => {
    const { activeSession } = useSession();
    const pathname = usePathname();
    const router = useRouter();

    const isVisible = !!activeSession && activeSession.status === 'running' && pathname !== "/" && pathname !== "/session";


    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                    onClick={() => router.push("/session")}
                    className="cursor-pointer hover:bg-slate-100 p-2 rounded-lg transition-colors"
                >
                    <span className="font-mono font-bold  tabular-nums">
                        {formatDuration(activeSession.time || 0)}
                    </span>

                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default SessionTimer;
