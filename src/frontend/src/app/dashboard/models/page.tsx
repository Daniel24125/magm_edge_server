import React from "react";
import ModelsTableClient from "@/components/models/ModelsTableClient";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowRight, Brain } from "lucide-react";

export const metadata = {
    title: "Saved Calibrations & Models | MAGM",
    description: "View, analyze, and deploy your trained chemometric models.",
};

export default async function ModelsPage() {
    // We now fetch models via MQTT in the client component for full offline support
    const models: any[] = [];

    return (
        <div className="flex flex-col gap-6 py-6 md:p-6 h-full w-full overflow-y-auto">
            {/* Page header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                        <Brain className="h-6 w-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Saved Calibrations & Models</h1>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            Manage your trained AutoML chemometric models
                        </p>
                    </div>
                </div>
                <Button asChild>
                    <Link href="/dashboard/calibrate">
                        Train New Model <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                </Button>
            </div>



            {/* Table with all interactions */}
            <ModelsTableClient initialModels={models} />
        </div>
    );
}
