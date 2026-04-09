"use client";

import React, { useState } from "react";
import { useUserContext } from "@/contexts/UserContext";
import { useMQTT } from "@/contexts/MQTTContext";
import { useDeviceManager } from "@/contexts/DeviceManagerContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, CheckCircle2, ChevronDown, ChevronUp, BarChart3 } from "lucide-react";
import { ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogHeader, ResponsiveDialogTitle, ResponsiveDialogFooter } from "@/components/ui/responsive-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip } from "recharts";

interface CalibrationRow {
    id: string;
    referenceOd: number | '';
    spectrum: number[] | null;
    isCapturing: boolean;
}

export default function CalibrationWizardPage() {
    const { user } = useUserContext();
    const { publish, subscribe, unsubscribe } = useMQTT();
    const { isRPIConnected } = useDeviceManager();

    // Section 1 State – Configuration
    const [compoundName, setCompoundName] = useState("");
    const [targetType, setTargetType] = useState("chemical_compound");
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [sgWindow, setSgWindow] = useState(11);
    const [sgPoly, setSgPoly] = useState(2);
    const [sgDeriv, setSgDeriv] = useState(0);

    // Section 2 State – Baseline Spectra
    const [darkSpectrum, setDarkSpectrum] = useState<number[] | null>(null);
    const [refSpectrum, setRefSpectrum] = useState<number[] | null>(null);
    const [isCapturingDark, setIsCapturingDark] = useState(false);
    const [isCapturingRef, setIsCapturingRef] = useState(false);

    // Section 3 State – Sample Acquisition
    const [calibrationRows, setCalibrationRows] = useState<CalibrationRow[]>([
        { id: crypto.randomUUID(), referenceOd: '', spectrum: null, isCapturing: false }
    ]);
    const [capturedWavelengths, setCapturedWavelengths] = useState<number[] | null>(null);

    // Section 4 State – Training
    const [isTraining, setIsTraining] = useState(false);
    const [trainingResult, setTrainingResult] = useState<any>(null);

    // Preview Modal State
    const [previewSpectrum, setPreviewSpectrum] = useState<{ title: string; data: { wavelength: number; intensity: number }[] } | null>(null);

    // ─── Helpers ────────────────────────────────────────────────────────────────

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

    /** Shared wavelength setter with index-based fallback for missing wavelength arrays. */
    const applyWavelengths = (payload: any) => {
        if (!capturedWavelengths) {
            setCapturedWavelengths(
                payload.wavelengths || payload.raw_spectrum.map((_: any, i: number) => i)
            );
        }
    };

    const handleViewSpectrum = (title: string, spectrum: number[] | null) => {
        if (!spectrum || !capturedWavelengths) return;
        const data = capturedWavelengths.map((wl, i) => ({
            wavelength: wl,
            intensity: spectrum[i] ?? 0,
        }));
        setPreviewSpectrum({ title, data });
    };

    // ─── Baseline Capture ────────────────────────────────────────────────────────

    const captureSpecialSpectrum = (type: 'dark' | 'ref') => {
        const requestId = crypto.randomUUID();
        if (type === 'dark') setIsCapturingDark(true);
        else setIsCapturingRef(true);

        const timeout = setTimeout(() => {
            unsubscribe("magm/calibration/capture/response", handleResponse);
            if (type === 'dark') setIsCapturingDark(false);
            else setIsCapturingRef(false);
            toast.error("Capture timeout.");
        }, 10000);

        const handleResponse = (topic: string, payload: any) => {
            if (payload.request_id !== requestId) return;
            clearTimeout(timeout);
            unsubscribe("magm/calibration/capture/response", handleResponse);

            if (payload.status === "success" && payload.raw_spectrum) {
                if (type === 'dark') setDarkSpectrum(payload.raw_spectrum);
                else setRefSpectrum(payload.raw_spectrum);
                applyWavelengths(payload);
                toast.success(`${type === 'dark' ? 'Dark' : 'Reference'} spectrum captured.`);
            } else {
                toast.error(`Capture failed: ${payload.message || "No data"}`);
            }

            if (type === 'dark') setIsCapturingDark(false);
            else setIsCapturingRef(false);
        };

        subscribe("magm/calibration/capture/response", handleResponse);
        try {
            publish("magm/calibration/capture/request", { request_id: requestId });
        } catch (e) {
            clearTimeout(timeout);
            unsubscribe("magm/calibration/capture/response", handleResponse);
            if (type === 'dark') setIsCapturingDark(false);
            else setIsCapturingRef(false);
            toast.error("Failed to send capture request.");
        }
    };

    // ─── Sample Capture ──────────────────────────────────────────────────────────

    const captureSpectrum = (id: string) => {
        const requestId = crypto.randomUUID();
        setCalibrationRows(prev => prev.map(r => r.id === id ? { ...r, isCapturing: true } : r));

        const timeout = setTimeout(() => {
            unsubscribe("magm/calibration/capture/response", handleCaptureResponse);
            setCalibrationRows(prev => prev.map(r => r.id === id ? { ...r, isCapturing: false } : r));
            toast.error("Capture timeout.");
        }, 10000);

        const handleCaptureResponse = (topic: string, payload: any) => {
            if (payload.request_id !== requestId) return;
            clearTimeout(timeout);
            unsubscribe("magm/calibration/capture/response", handleCaptureResponse);

            if (payload.status === "success" && payload.raw_spectrum) {
                setCalibrationRows(prev => prev.map(r =>
                    r.id === id ? { ...r, spectrum: payload.raw_spectrum, isCapturing: false } : r
                ));
                applyWavelengths(payload);
                toast.success("Spectrum captured.");
            } else {
                setCalibrationRows(prev => prev.map(r => r.id === id ? { ...r, isCapturing: false } : r));
                toast.error(`Capture failed: ${payload.message || "No data"}`);
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

    // ─── Training ───────────────────────────────────────────────────────────────

    // Training error state — persists until next successful train or new attempt
    const [trainingError, setTrainingError] = useState<string | null>(null);

    const isValidToTrain =
        compoundName.trim() !== "" &&
        darkSpectrum !== null &&
        refSpectrum !== null &&
        calibrationRows.length >= 2 &&
        calibrationRows.every(r => typeof r.referenceOd === 'number' && r.spectrum !== null) &&
        capturedWavelengths !== null;

    const trainModel = () => {
        // Filter to only rows that have both a spectrum and a valid numeric OD value
        const validRows = calibrationRows.filter(
            row => row.spectrum !== null && row.referenceOd !== ''
        );

        if (validRows.length === 0) {
            toast.error("No valid data rows to train on. Capture at least one spectrum.");
            return;
        }

        // Build the exact arrays the backend expects — derived from validRows only
        const reference_ods = validRows.map(row => Number(row.referenceOd));
        const raw_spectra_matrix = validRows.map(row => row.spectrum);
        const requestId = crypto.randomUUID();

        const mqttPayload = {
            request_id: requestId,
            auth0_user_id: user?.sub || "anonymous",
            compound_name: compoundName,
            user_config: {
                target_type: targetType,
                sg_window: sgWindow,
                sg_poly: sgPoly,
                sg_deriv: sgDeriv,
            },
            reference_ods,
            raw_spectra_matrix,
            wavelengths: capturedWavelengths,
            dark_spectrum: darkSpectrum,
            ref_spectrum: refSpectrum,
        };

        setIsTraining(true);
        setTrainingResult(null);
        setTrainingError(null);

        const timeout = setTimeout(() => {
            unsubscribe("magm/calibration/train/response", handleResponse);
            setIsTraining(false);
            const msg = "Training request timed out. The server may be busy or unreachable.";
            setTrainingError(msg);
            toast.error(msg);
        }, 30000);

        const handleResponse = (topic: string, responsePayload: any) => {
            if (responsePayload.request_id !== requestId) return;
            clearTimeout(timeout);
            unsubscribe("magm/calibration/train/response", handleResponse);
            setIsTraining(false);

            if (responsePayload.status === "success") {
                setTrainingError(null);
                setTrainingResult(responsePayload.winning_model);
                toast.success(`Training complete! Best model: ${responsePayload.winning_model?.algorithm}`);
            } else {
                const errMsg = responsePayload.message || "An unknown error occurred during training.";
                setTrainingError(errMsg);
                toast.error(`Training failed: ${errMsg}`);
            }
        };

        subscribe("magm/calibration/train/response", handleResponse);

        try {
            publish("magm/calibration/train/request", mqttPayload);
            toast.info("Training initiated. This may take a few moments...");
        } catch (e) {
            clearTimeout(timeout);
            unsubscribe("magm/calibration/train/response", handleResponse);
            setIsTraining(false);
            toast.error("Failed to send training request to the broker.");
        }
    };

    // ─── Render ──────────────────────────────────────────────────────────────────

    return (
        <div className="container mx-auto p-6 max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h1 className="text-3xl font-bold mb-8">Calibration Wizard</h1>

            {/* SECTION 1: Configuration */}
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

            {/* SECTION 2: Baseline Calibration */}
            <div className="bg-card border rounded-lg p-6 mb-6 shadow-sm">
                <h2 className="text-xl font-semibold mb-4">2. Baseline Calibration</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                    {/* Dark Spectrum */}
                    <div className="p-4 border rounded-md bg-muted/10 flex flex-col gap-3">
                        <div className="flex justify-between items-center">
                            <Label className="text-base font-medium">Dark Spectrum</Label>
                            {darkSpectrum && (
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 className="text-green-500 size-5" />
                                    <Button variant="ghost" size="icon" onClick={() => handleViewSpectrum("Dark Spectrum", darkSpectrum)}>
                                        <BarChart3 className="size-4 text-blue-500" />
                                    </Button>
                                </div>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground">Block the sensor to capture baseline noise.</p>
                        <Button
                            variant={darkSpectrum ? "secondary" : "default"}
                            onClick={() => captureSpecialSpectrum('dark')}
                            disabled={isCapturingDark || !isRPIConnected}
                        >
                            {isCapturingDark && <Loader2 className="animate-spin size-4 mr-2" />}
                            {darkSpectrum ? "Recapture Dark" : "Capture Dark"}
                        </Button>
                    </div>

                    {/* Reference Spectrum */}
                    <div className="p-4 border rounded-md bg-muted/10 flex flex-col gap-3">
                        <div className="flex justify-between items-center">
                            <Label className="text-base font-medium">Reference Spectrum</Label>
                            {refSpectrum && (
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 className="text-green-500 size-5" />
                                    <Button variant="ghost" size="icon" onClick={() => handleViewSpectrum("Reference Spectrum", refSpectrum)}>
                                        <BarChart3 className="size-4 text-blue-500" />
                                    </Button>
                                </div>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground">Capture a blank reference (e.g., pure water).</p>
                        <Button
                            variant={refSpectrum ? "secondary" : "default"}
                            onClick={() => captureSpecialSpectrum('ref')}
                            disabled={isCapturingRef || !isRPIConnected}
                        >
                            {isCapturingRef && <Loader2 className="animate-spin size-4 mr-2" />}
                            {refSpectrum ? "Recapture Reference" : "Capture Reference"}
                        </Button>
                    </div>
                </div>
            </div>

            {/* SECTION 3: Data Acquisition */}
            <div className="bg-card border rounded-lg p-6 mb-6 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold">3. Data Acquisition</h2>
                    <Button onClick={addRow} size="sm" variant="outline"><Plus className="mr-2 size-4" /> Add Sample</Button>
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
                                    disabled={row.isCapturing || !isRPIConnected}
                                >
                                    {row.isCapturing ? <Loader2 className="animate-spin size-4" /> : "Capture Spectrum"}
                                </Button>
                            </div>
                            <div className="w-16 flex justify-center gap-2 items-center">
                                {row.spectrum && (
                                    <>
                                        <CheckCircle2 className="text-green-500 size-5 shrink-0" />
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleViewSpectrum(`Sample #${index + 1}`, row.spectrum)}
                                        >
                                            <BarChart3 className="size-4 text-blue-500 hover:text-blue-700" />
                                        </Button>
                                    </>
                                )}
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => removeRow(row.id)} disabled={calibrationRows.length === 1}>
                                <Trash2 className="size-4 text-destructive" />
                            </Button>
                        </div>
                    ))}
                </div>
            </div>

            {/* SECTION 4: Training */}
            <div className="bg-card border rounded-lg p-6 shadow-sm flex flex-col items-center">
                <Button
                    size="lg"
                    className="w-full md:w-1/2 py-8 text-lg font-bold"
                    disabled={!isValidToTrain || isTraining}
                    onClick={trainModel}
                >
                    {isTraining ? <><Loader2 className="mr-2 size-6 animate-spin" /> Training AutoML...</> : "Train AutoML Model"}
                </Button>
                {!isValidToTrain && !trainingError && (
                    <p className="text-sm text-muted-foreground mt-3 text-center">
                        Please provide a compound name, capture dark &amp; reference baselines, and ensure at least 2 samples have a reference value and captured spectrum.
                    </p>
                )}
                {trainingError && (
                    <div className="mt-4 w-full md:w-3/4 flex items-start gap-3 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                        <span className="mt-0.5 shrink-0">⚠</span>
                        <div className="flex-1">
                            <p className="font-semibold mb-0.5">Training failed</p>
                            <p className="text-destructive/80">{trainingError}</p>
                        </div>
                        <button
                            onClick={() => setTrainingError(null)}
                            className="shrink-0 ml-2 opacity-60 hover:opacity-100 transition-opacity"
                            aria-label="Dismiss error"
                        >
                            ✕
                        </button>
                    </div>
                )}
            </div>

            {/* Training Results Modal */}
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
                        <Button onClick={() => setTrainingResult(null)} className="w-full">Close &amp; Continue</Button>
                    </ResponsiveDialogFooter>
                </ResponsiveDialogContent>
            </ResponsiveDialog>

            {/* Spectrum Preview Modal */}
            <Dialog open={previewSpectrum !== null} onOpenChange={() => setPreviewSpectrum(null)}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>{previewSpectrum?.title || "Captured Spectrum"}</DialogTitle>
                    </DialogHeader>
                    <div className="h-[400px] w-full mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={previewSpectrum?.data || []}>
                                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                                <XAxis
                                    dataKey="wavelength"
                                    type="number"
                                    domain={['dataMin', 'dataMax']}
                                    tickFormatter={(val) => Math.round(val).toString()}
                                    label={{ value: 'Wavelength (nm)', position: 'insideBottom', offset: -10 }}
                                />
                                <YAxis
                                    domain={['auto', 'auto']}
                                    label={{ value: 'Intensity', angle: -90, position: 'insideLeft' }}
                                />
                                <RechartsTooltip
                                    labelFormatter={(label) => `${Number(label).toFixed(1)} nm`}
                                    formatter={(value) => [Number(value).toFixed(2), "Intensity"]}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="intensity"
                                    stroke="#3b82f6"
                                    strokeWidth={2}
                                    dot={false}
                                    activeDot={{ r: 4 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
