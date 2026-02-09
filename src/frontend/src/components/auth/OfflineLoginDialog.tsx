"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface OfflineLoginDialogProps {
    open: boolean;
    onLogin: (user: { name: string; email: string }) => void;
}

export function OfflineLoginDialog({ open, onLogin }: OfflineLoginDialogProps) {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [error, setError] = useState("");

    // Load from local storage if previously used
    useEffect(() => {
        if (open) {
            const stored = localStorage.getItem("offline_user");
            if (stored) {
                try {
                    const parsed = JSON.parse(stored);
                    setName(parsed.name || "");
                    setEmail(parsed.email || "");
                } catch (e) {
                    console.error(e)
                }
            }
        }
    }, [open]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !email.trim()) {
            setError("Name and Email are required for offline access.");
            return;
        }

        // Save to local storage
        const user = { name, email };
        localStorage.setItem("offline_user", JSON.stringify(user));

        // Notify parent
        onLogin(user);
    };

    return (
        <Dialog open={open} onOpenChange={() => { }}>
            <DialogContent className="sm:max-w-[425px]" onInteractOutside={(e) => e.preventDefault()}>
                <DialogHeader>
                    <DialogTitle>Offline Mode</DialogTitle>
                    <DialogDescription>
                        You are currently offline. Please enter your details to continue working locally.
                        Data will be synced when you reconnect.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="name" className="text-right">
                            Name
                        </Label>
                        <Input
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="col-span-3"
                            placeholder="John Doe"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="email" className="text-right">
                            Email
                        </Label>
                        <Input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="col-span-3"
                            placeholder="john@example.com"
                        />
                    </div>
                    {error && <p className="text-sm text-destructive text-center">{error}</p>}
                    <DialogFooter>
                        <Button type="submit">Start Offline Session</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
