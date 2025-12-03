"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingProps {
    isLoading: boolean;
    className?: string;
}

const Loading = ({ isLoading, className }: LoadingProps) => {
    return (
        <AnimatePresence>
            {isLoading && (
                <motion.div
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className={cn(
                        "fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm",
                        className
                    )}
                >
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="flex flex-col items-center gap-2"
                    >
                        <Loader2 className="h-16 w-16 animate-spin text-primary" />
                        <p className="text-sm font-medium text-muted-foreground">Loading...</p>
                    </motion.div>
                </motion.div>
            )}

        </AnimatePresence>
    );
};

export default Loading;
