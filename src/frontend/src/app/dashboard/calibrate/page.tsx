"use client";

import React, { useState, useEffect } from "react";
import { useUserContext } from "@/contexts/UserContext";
import { useMQTT } from "@/contexts/MQTTContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogHeader, ResponsiveDialogTitle, ResponsiveDialogFooter } from "@/components/ui/responsive-dialog";

interface CalibrationRow {
    id: string;
    referenceOd: number | '';
    spectrum: number[] | null;
    isCapturing: boolean;
}

export default function CalibrationWizardPage() {
    const { user } = useUserContext();
    const { publish, subscribe, unsubscribe } = useMQTT();

    // Section A State
    const [compoundName, setCompoundName] = useState("");
    const [targetType, setTargetType] = useState("chemical_compound");
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [sgWindow, setSgWindow] = useState(11);
    const [sgPoly, setSgPoly] = useState(2);
    const [sgDeriv, setSgDeriv] = useState(0);

    // Section B State
    const [calibrationRows, setCalibrationRows] = useState<CalibrationRow[]>([
        { id: crypto.randomUUID(), referenceOd: '', spectrum: null, isCapturing: false }
    ]);
    const [capturedWavelengths, setCapturedWavelengths] = useState<number[] | null>(null);

    // Section C State
    const [isTraining, setIsTraining] = useState(false);
    const [trainingResult, setTrainingResult] = useState<any>(null);

    const addRow = () => {
        setCalibrationRows(prev => [...prev, { id: crypto.randomUUID(), referenceOd: '', spectrum: null, isCapturing: false }]);
    };

    const removeRow = (id: string) => {
        setCalibrationRows(prev => prev.filter(r => r.id !== id));
    };

    const updateRowOd = (id: string, value: string) => {
        const num = parseFloat(value);
        setCalibrationRows(prev => prev.map(r => 
            r.id === id ? { ...r, referenceOd: isNaN(num) ? '' : num } : r
        ));
    };

    // Capture Spectrum Logic
    const captureSpectrum = (id: string) => {
        const requestId = crypto.randomUUID();
        
        setCalibrationRows(prev => prev.map(r => r.id === id ? { ...r, isCapturing: true } : r));

        const timeout = setTimeout(() => {
            unsubscribe("magm/calibration/capture/response", handleCaptureResponse);
            setCalibrationRows(prev => prev.map(r => r.id === id ? { ...r, isCapturing: false } : r));
            toast.error("Capture timeout.");
        }, 10000);

        const handleCaptureResponse = (topic: string, payload: any) => {
            if (payload.request_id === requestId) {
                clearTimeout(timeout);
                unsubscribe("magm/calibration/capture/response", handleCaptureResponse);
                
                if (payload.status === "success" && payload.raw_spectrum) {
                    setCalibrationRows(prev => prev.map(r => 
                        r.id === id ? { ...r, spectrum: payload.raw_spectrum, isCapturing: false } : r
                    ));
                    if (!capturedWavelengths && payload.wavelengths) {
                        setCapturedWavelengths(payload.wavelengths);
                    }
                    toast.success("Spectrum captured.");
                } else {
                    setCalibrationRows(prev => prev.map(r => r.id === id ? { ...r, isCapturing: false } : r));
                    toast.error(`Capture failed: ${payload.message || "No data"}`);
                }
            }
        };

        subscribe("magm/calibration/capture/response", handleCaptureResponse);
        try {
            publish("magm/calibration/capture/request", { request_id: requestId });
        } catch (e) {
            clearTimeout(timeout);
            unsubscribe("magm/calibration/capture/response", handleCaptureResponse);
            setCalibrationRows(prev => prev.map(r => r.id === id ? { ...r, isCapturing: false } : r));
            toast.error("Failed to send capture request.");
        }
    };

    // Training Logic
    const isValidToTrain = compoundName.trim() !== "" && 
                           calibrationRows.length > 0 && 
                           calibrationRows.every(r => typeof r.referenceOd === 'number' && r.spectrum !== null) &&
                           capturedWavelengths !== null;

    const trainModel = () => {
        if (!isValidToTrain) return;
        setIsTraining(true);
        setTrainingResult(null);
        
        const requestId = crypto.randomUUID();

        const timeout = setTimeout(() => {
            unsubscribe("magm/calibration/train/response", handleTrainResponse);
            setIsTraining(false);
            toast.error("Training timeout.");
        }, 30000);

        const handleTrainResponse = (topic: string, payload: any) => {
            if (payload.request_id === requestId) {
                clearTimeout(timeout);
                unsubscribe("magm/calibration/train/response", handleTrainResponse);
                
                if (payload.status === "success") {
                    setTrainingResult(payload.winning_model);
                    toast.success("Model trained successfully!");
                } else {
                    toast.error(`Training failed: ${payload.message}`);
                }
                setIsTraining(false);
            }
        };

        subscribe("magm/calibration/train/response", handleTrainResponse);

        const payload = {
            request_id: requestId,
            auth0_user_id: user?.sub || "unknown_user",
            compound_name: compoundName,
            user_config: {
                target_type: targetType,
                sg_window: sgWindow,
                sg_poly: sgPoly,
                sg_deriv: sgDeriv
            },
            reference_ods: calibrationRows.map(r => r.referenceOd),
            raw_spectra_matrix: calibrationRows.map(r => r.spectrum),
            wavelengths: capturedWavelengths
        };

        try {
            publish("magm/calibration/train/request", payload);
            toast.info("Training initiated. This may take a few moments...");
        } catch (e) {
            clearTimeout(timeout);
            unsubscribe("magm/calibration/train/response", handleTrainResponse);
            setIsTraining(false);
            toast.error("Failed to submit training request.");
        }
    };

    return (
        <div className="container mx-auto p-6 max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h1 className="text-3xl font-bold mb-8">Calibration Wizard</h1>
            
            {/* SECTION A: Setup */}
            <div className="bg-card border rounded-lg p-6 mb-6 shadow-sm">
                <h2 className="text-xl font-semibold mb-4">1. Configuration</h2>
                <div className="grid gap-6">
                    <div className="grid gap-2">
                        <Label htmlFor="compound">Compound Name</Label>
                        <Input 
                            id="compound" 
                            placeholder="e.g. Glucose, Biomass..." 
                            value={compoundName} 
                            onChange={e => setCompoundName(e.target.value)} 
                        />
                    </div>
                    
                    <div className="grid gap-2">
                        <Label htmlFor="targetType">Target Type</Label>
                        <select 
                            id="targetType" 
                            className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            value={targetType}
                            onChange={(e) => setTargetType(e.target.value)}
                        >
                            <option value="chemical_compound">Chemical Compound (SNV)</option>
                            <option value="biomass">Biomass / Turbidity (Mean Center)</option>
                        </select>
                    </div>

                    <div>
                        <Button variant="ghost" className="p-0 h-auto font-medium flex items-center text-muted-foreground" onClick={() => setShowAdvanced(!showAdvanced)}>
                            Advanced Preprocessing {showAdvanced ? <ChevronUp className="ml-1 size-4" /> : <ChevronDown className="ml-1 size-4" />}
                        </Button>
                        
                        {showAdvanced && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 p-4 border rounded-md bg-muted/20">
                                <div className="grid gap-2">
                                    <Label>Savitzky-Golay Window</Label>
                                    <Input type="number" min={5} step={2} value={sgWindow} onChange={e => setSgWindow(parseInt(e.target.value))} />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Polynomial Order</Label>
                                    <Input type="number" min={1} value={sgPoly} onChange={e => setSgPoly(parseInt(e.target.value))} />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Derivative</Label>
                                    <Input type="number" min={0} value={sgDeriv} onChange={e => setSgDeriv(parseInt(e.target.value))} />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* SECTION B: Acquisition */}
            <div className="bg-card border rounded-lg p-6 mb-6 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold">2. Data Acquisition</h2>
                    <Button onClick={addRow} size="sm" variant="outline"><Plus className="mr-2 size-4"/> Add Sample</Button>
                </div>
                
                <div className="space-y-3">
                    {calibrationRows.map((row, index) => (
                        <div key={row.id} className="flex items-center gap-4 p-3 bg-muted/10 border rounded-md">
                            <div className="font-medium text-muted-foreground w-8">#{index + 1}</div>
                            <div className="flex-1 grid gap-1">
                                <Label className="text-xs">Reference Value (OD/Conc)</Label>
                                <Input 
                                    type="number" 
                                    placeholder="Enter reference..." 
                                    value={row.referenceOd} 
                                    onChange={(e) => updateRowOd(row.id, e.target.value)} 
                                />
                            </div>
                            <div className="flex-1 flex flex-col items-center justify-center gap-1">
                                <Button 
                                    variant={row.spectrum ? "secondary" : "default"} 
                                    className="w-full"
                                    onClick={() => captureSpectrum(row.id)}
                                    disabled={row.isCapturing}
                                >
                                    {row.isCapturing ? <Loader2 className="animate-spin size-4" /> : "Capture Spectrum"}
                                </Button>
                            </div>
                            <div className="w-10 flex justify-center">
                                {row.spectrum && <CheckCircle2 className="text-green-500 size-6" />}
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => removeRow(row.id)} disabled={calibrationRows.length === 1}>
                                <Trash2 className="size-4 text-destructive" />
                            </Button>
                        </div>
                    ))}
                </div>
            </div>

            {/* SECTION C: Training */}
            <div className="bg-card border rounded-lg p-6 shadow-sm flex flex-col items-center">
                <Button 
                    size="lg" 
                    className="w-full md:w-1/2 py-8 text-lg font-bold" 
                    disabled={!isValidToTrain || isTraining}
                    onClick={trainModel}
                >
                    {isTraining ? <><Loader2 className="mr-2 size-6 animate-spin" /> Training AutoML...</> : "Train AutoML Model"}
                </Button>
                {!isValidToTrain && (
                    <p className="text-sm text-muted-foreground mt-3 text-center">
                        Please provide a compound name, select a target type, and ensure all samples have a reference value and captured spectrum.
                    </p>
                )}
            </div>

            {/* Results Modal */}
            <ResponsiveDialog open={trainingResult !== null} onOpenChange={() => setTrainingResult(null)}>
                <ResponsiveDialogContent>
                    <ResponsiveDialogHeader>
                        <ResponsiveDialogTitle>Training Complete</ResponsiveDialogTitle>
                    </ResponsiveDialogHeader>
                    {trainingResult && (
                        <div className="py-6 space-y-4">
                            <div className="text-center p-4 bg-muted/20 rounded-lg">
                                <h3 className="text-sm text-muted-foreground mb-1">Winning Algorithm</h3>
                                <p className="text-2xl font-bold text-primary">{trainingResult.algorithm}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 border rounded-lg text-center">
                                    <p className="text-sm text-muted-foreground">R² Score</p>
                                    <p className="text-xl font-mono">{trainingResult.r2.toFixed(4)}</p>
                                </div>
                                <div className="p-4 border rounded-lg text-center">
                                    <p className="text-sm text-muted-foreground">RMSE</p>
                                    <p className="text-xl font-mono">{trainingResult.rmse.toFixed(4)}</p>
                                </div>
                            </div>
                            <p className="text-sm text-center text-muted-foreground mt-4">
                                This model has been automatically saved and activated for <b>{compoundName}</b>.
                            </p>
                        </div>
                    )}
                    <ResponsiveDialogFooter>
                        <Button onClick={() => setTrainingResult(null)} className="w-full">Close & Continue</Button>
                    </ResponsiveDialogFooter>
                </ResponsiveDialogContent>
            </ResponsiveDialog>
        </div>
    );
}
