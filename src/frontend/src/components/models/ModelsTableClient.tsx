"use client";

import React, { useState, useTransition, useCallback, useEffect } from "react";
import { IMLModel, deployModel, deleteModel } from "@/app/actions/models";
import { useMQTT } from "@/contexts/MQTTContext";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
    Loader2,
    MoreVertical,
    Eye,
    Rocket,
    Trash2,
    FlaskConical,
    Brain,
    TrendingUp,
    CalendarDays,
    BarChart3,
    CheckCircle2,
    Circle,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
    ResponsiveContainer,
    ScatterChart,
    Scatter,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    ReferenceLine,
} from "recharts";

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
    try {
        return new Date(iso).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    } catch {
        return iso;
    }
}

function r2Color(r2: number): string {
    if (r2 >= 0.95) return "text-green-500";
    if (r2 >= 0.85) return "text-yellow-500";
    return "text-red-500";
}

function r2Label(r2: number): string {
    if (r2 >= 0.95) return "Excellent";
    if (r2 >= 0.85) return "Good";
    if (r2 >= 0.70) return "Fair";
    return "Poor";
}

// ─── Details Dialog ──────────────────────────────────────────────────────────

interface DetailsDialogProps {
    model: IMLModel | null;
    open: boolean;
    onOpenChange: (v: boolean) => void;
}

const DetailsDialog = ({ model, open, onOpenChange }: DetailsDialogProps) => {
    if (!model) return null;

    const r2 = model.metrics?.r2 ?? 0;
    const rmse = model.metrics?.rmse ?? 0;

    const placeholderScatterData = Array.from({ length: 12 }, (_, i) => {
        const actual = 0.1 + i * 0.15;
        const noise = (Math.random() - 0.5) * rmse * 4;
        return { actual: +actual.toFixed(3), predicted: +(actual + noise).toFixed(3) };
    });
    const maxVal = Math.max(...placeholderScatterData.map(d => Math.max(d.actual, d.predicted)));

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <Brain className="h-5 w-5 text-primary" />
                        {model.compound_name} — {model.algorithm}
                    </DialogTitle>
                    <DialogDescription>
                        Trained {formatDate(model.created_at)}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-2">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 border rounded-lg text-center bg-muted/20">
                            <p className="text-xs text-muted-foreground mb-1 uppercase font-semibold tracking-wider">R² Score</p>
                            <p className={`text-3xl font-mono font-bold ${r2Color(r2)}`}>{r2.toFixed(4)}</p>
                            <p className={`text-xs mt-1 font-medium ${r2Color(r2)}`}>{r2Label(r2)}</p>
                        </div>
                        <div className="p-4 border rounded-lg text-center bg-muted/20">
                            <p className="text-xs text-muted-foreground mb-1 uppercase font-semibold tracking-wider">RMSE</p>
                            <p className="text-3xl font-mono font-bold text-foreground">{rmse.toFixed(4)}</p>
                            <p className="text-xs mt-1 text-muted-foreground">Lower is better</p>
                        </div>
                    </div>

                    <Separator />

                    <div>
                        <h4 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">Model Details</h4>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                            <div className="flex justify-between p-2 bg-muted/20 rounded">
                                <span className="text-muted-foreground">Algorithm</span>
                                <span className="font-medium">{model.algorithm}</span>
                            </div>
                            <div className="flex justify-between p-2 bg-muted/20 rounded">
                                <span className="text-muted-foreground">Compound</span>
                                <span className="font-medium">{model.compound_name}</span>
                            </div>
                            <div className="flex justify-between p-2 bg-muted/20 rounded">
                                <span className="text-muted-foreground">Status</span>
                                <Badge variant={model.is_active ? "default" : "secondary"}>
                                    {model.is_active ? "Active" : "Inactive"}
                                </Badge>
                            </div>
                        </div>
                    </div>

                    <Separator />

                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                                Actual vs Predicted
                            </h4>
                            <Badge variant="outline" className="text-[10px]">Preview</Badge>
                        </div>
                        <div className="h-[240px] w-full border rounded-lg p-2 bg-muted/10">
                            <ResponsiveContainer width="100%" height="100%">
                                <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
                                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                                    <XAxis
                                        dataKey="actual"
                                        type="number"
                                        domain={[0, maxVal * 1.1]}
                                        label={{ value: "Actual", position: "insideBottom", offset: -12, fontSize: 11 }}
                                        tick={{ fontSize: 10 }}
                                    />
                                    <YAxis
                                        dataKey="predicted"
                                        type="number"
                                        domain={[0, maxVal * 1.1]}
                                        label={{ value: "Predicted", angle: -90, position: "insideLeft", offset: 10, fontSize: 11 }}
                                        tick={{ fontSize: 10 }}
                                    />
                                    <RechartsTooltip
                                        cursor={{ strokeDasharray: "3 3" }}
                                        formatter={(v: any) => [Number(v).toFixed(3)]}
                                        labelFormatter={() => ""}
                                    />
                                    <ReferenceLine
                                        segment={[{ x: 0, y: 0 }, { x: maxVal * 1.1, y: maxVal * 1.1 }]}
                                        stroke="hsl(var(--primary))"
                                        strokeDasharray="4 4"
                                        strokeWidth={1.5}
                                        label={{ value: "Perfect fit", fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                                    />
                                    <Scatter
                                        data={placeholderScatterData}
                                        fill="hsl(var(--primary))"
                                        opacity={0.7}
                                    />
                                </ScatterChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

// ─── Table Row ──────────────────────────────────────────────────────────────

interface RowProps {
    model: IMLModel;
    onViewDetails: (m: IMLModel) => void;
    onDelete: (m: IMLModel) => void;
    onDeploy: (m: IMLModel) => void;
}

const ModelRow = ({ model, onViewDetails, onDelete, onDeploy }: RowProps) => {
    const r2 = model.metrics?.r2 ?? 0;
    const rmse = model.metrics?.rmse ?? 0;

    return (
        <div className="grid grid-cols-[1fr_1fr_1fr_1fr_auto_auto] items-center gap-x-4 gap-y-2 px-4 py-3 border-b last:border-b-0 hover:bg-muted/30 transition-colors text-sm">
            <div className="flex items-center gap-2 text-muted-foreground min-w-0">
                <CalendarDays className="h-4 w-4 shrink-0" />
                <span className="truncate">{formatDate(model.created_at)}</span>
            </div>
            <div className="flex items-center gap-2 min-w-0">
                <FlaskConical className="h-4 w-4 shrink-0 text-violet-500" />
                <span className="font-medium truncate">{model.compound_name}</span>
            </div>
            <div className="flex items-center gap-2">
                <Brain className="h-4 w-4 shrink-0 text-blue-500" />
                <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">{model.algorithm}</span>
            </div>
            <div className="flex flex-col gap-0.5">
                <span className={`font-mono font-bold ${r2Color(r2)}`}>R² {r2.toFixed(3)}</span>
                <span className="text-xs text-muted-foreground font-mono">RMSE {rmse.toFixed(3)}</span>
            </div>
            <div>
                {model.is_active ? (
                    <Badge className="gap-1.5 bg-green-600/15 text-green-700 dark:text-green-400 hover:bg-green-600/20 border-green-500/30">
                        <CheckCircle2 className="h-3 w-3" /> Active
                    </Badge>
                ) : (
                    <Badge variant="outline" className="gap-1.5 text-muted-foreground">
                        <Circle className="h-3 w-3" /> Inactive
                    </Badge>
                )}
            </div>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                        <span className="sr-only">Actions</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onViewDetails(model)}>
                        <Eye className="mr-2 h-4 w-4" /> View Details
                    </DropdownMenuItem>
                    {!model.is_active && (
                        <DropdownMenuItem onClick={() => onDeploy(model)}>
                            <Rocket className="mr-2 h-4 w-4 text-green-500" />
                            Deploy
                        </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => onDelete(model)}
                    >
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
};

// ─── Main Client Component ───────────────────────────────────────────────────

export default function ModelsTableClient({ initialModels }: { initialModels: IMLModel[] }) {
    const router = useRouter();
    const { subscribe, unsubscribe, publish, isConnected } = useMQTT();
    const [isPending, startTransition] = useTransition();
    const [models, setModels] = useState<IMLModel[]>(initialModels);
    const [isLoading, setIsLoading] = useState(true);

    const [detailsModel, setDetailsModel] = useState<IMLModel | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<IMLModel | null>(null);

    // ── MQTT Fetch Logic ────────────────────────────────────────────────────
    useEffect(() => {
        const topic = "ui/responses/get_ml_models";

        const handleMessage = (t: string, payload: any) => {
            if (t === topic && payload.type === "ml_models_list") {
                setModels(payload.models || []);
                setIsLoading(false);
            }
        };

        subscribe(topic, handleMessage);

        // Fetch models once connected
        if (isConnected) {
            publish("ui/commands/get_ml_models", {
                command: "get_ml_models",
                params: {}
            });
        }

        return () => {
            unsubscribe(topic, handleMessage);
        };
    }, [subscribe, unsubscribe, publish, isConnected]);

    // ── Deploy ──────────────────────────────────────────────────────────────
    const handleDeploy = useCallback((model: IMLModel) => {
        startTransition(async () => {
            const res = await deployModel(model.id);
            if (res.success) {
                toast.success(`"${model.compound_name} — ${model.algorithm}" is now active.`);
                // Refresh data via MQTT
                publish("ui/commands/get_ml_models", { command: "get_ml_models", params: {} });
                router.refresh();
            } else {
                toast.error(res.error || "Failed to deploy model.");
            }
        });
    }, [router, publish]);

    // ── Delete ──────────────────────────────────────────────────────────────
    const handleDeleteConfirm = useCallback(() => {
        if (!deleteTarget) return;
        const target = deleteTarget;
        setDeleteTarget(null);
        startTransition(async () => {
            const res = await deleteModel(target.id);
            if (res.success) {
                toast.success("Model deleted.");
                setModels(prev => prev.filter(m => m.id !== target.id));
                router.refresh();
            } else {
                toast.error(res.error || "Failed to delete model.");
            }
        });
    }, [deleteTarget, router]);

    const totalActive = models.filter(m => m.is_active).length;
    const avgR2 = models.length
        ? (models.reduce((s, m) => s + (m.metrics?.r2 ?? 0), 0) / models.length).toFixed(3)
        : "—";

    return (
        <>
            {/* Summary stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {[
                    { label: "Total Models", value: models.length, icon: <Brain className="h-5 w-5 text-blue-500" /> },
                    { label: "Active Models", value: totalActive, icon: <CheckCircle2 className="h-5 w-5 text-green-500" /> },
                    { label: "Avg. R² Score", value: avgR2, icon: <TrendingUp className="h-5 w-5 text-violet-500" /> },
                    { label: "Compounds", value: new Set(models.map(m => m.compound_name)).size, icon: <FlaskConical className="h-5 w-5 text-orange-400" /> },
                ].map(stat => (
                    <div key={stat.label} className="flex items-center gap-4 p-4 bg-card border rounded-xl">
                        <div className="p-2 rounded-lg bg-muted">{stat.icon}</div>
                        <div>
                            <p className="text-xs text-muted-foreground font-medium">{stat.label}</p>
                            <p className="text-2xl font-bold">{stat.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Table */}
            <div className="border rounded-xl bg-card overflow-hidden">
                <div className="grid grid-cols-[1fr_1fr_1fr_1fr_auto_auto] gap-x-4 px-4 py-3 bg-muted/40 border-b text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <span>Date Trained</span>
                    <span>Compound</span>
                    <span>Algorithm</span>
                    <span>Accuracy</span>
                    <span>Status</span>
                    <span className="sr-only">Actions</span>
                </div>

                {(isPending || (isLoading && models.length === 0)) && (
                    <div className="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground border-b">
                        <Loader2 className="h-4 w-4 animate-spin" /> {isLoading ? "Fetching models..." : "Updating..."}
                    </div>
                )}

                {models.length === 0 && !isLoading ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
                        <BarChart3 className="h-12 w-12 opacity-30" />
                        <p className="font-medium">No models trained yet</p>
                        <p className="text-sm opacity-70">
                            Train your first model from the Calibration Wizard.
                        </p>
                    </div>
                ) : (
                    models.map(model => (
                        <ModelRow
                            key={model.id}
                            model={model}
                            onViewDetails={setDetailsModel}
                            onDelete={setDeleteTarget}
                            onDeploy={handleDeploy}
                        />
                    ))
                )}
            </div>

            {/* Details dialog */}
            <DetailsDialog
                model={detailsModel}
                open={detailsModel !== null}
                onOpenChange={v => !v && setDetailsModel(null)}
            />

            {/* Delete confirmation */}
            <AlertDialog open={deleteTarget !== null} onOpenChange={v => !v && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete this model?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete{" "}
                            <strong>{deleteTarget?.compound_name} — {deleteTarget?.algorithm}</strong>.
                            This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={handleDeleteConfirm}
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
