"use client";

import React, { useState } from "react";
import { trainCalibrationModel, captureSpectrum } from "../../actions/calibration";

interface CalibrationRow {
  id: string;
  referenceOd: number | "";
  spectrum: number[] | null;
  wavelengths: number[] | null;
  isCapturing: boolean;
}

export default function CalibrationWizard() {
  const [compoundName, setCompoundName] = useState("");
  const [rows, setRows] = useState<CalibrationRow[]>([
    { id: "1", referenceOd: "", spectrum: null, wavelengths: null, isCapturing: false },
  ]);
  const [isTraining, setIsTraining] = useState(false);
  const [result, setResult] = useState<{ success: boolean; r2Score?: number; message?: string } | null>(null);

  const addRow = () => {
    setRows([
      ...rows,
      { id: Date.now().toString(), referenceOd: "", spectrum: null, wavelengths: null, isCapturing: false },
    ]);
  };

  const removeRow = (id: string) => {
    setRows(rows.filter((r) => r.id !== id));
  };

  const updateReferenceOd = (id: string, value: string) => {
    setRows(
      rows.map((r) =>
        r.id === id ? { ...r, referenceOd: value === "" ? "" : Number(value) } : r
      )
    );
  };

  const handleCapture = async (id: string) => {
    setRows(rows.map((r) => (r.id === id ? { ...r, isCapturing: true } : r)));
    try {
      const res: any = await captureSpectrum();
      if (res.success) {
        setRows(
          rows.map((r) =>
            r.id === id
              ? { ...r, spectrum: res.spectrum, wavelengths: res.wavelengths, isCapturing: false }
              : r
          )
        );
      }
    } catch (error: any) {
      alert("Capture Failed: " + error.message);
      setRows(rows.map((r) => (r.id === id ? { ...r, isCapturing: false } : r)));
    }
  };

  const isReadyToTrain =
    compoundName.trim() !== "" &&
    rows.length >= 2 &&
    rows.every((r) => typeof r.referenceOd === "number" && r.spectrum !== null);

  const handleTrain = async () => {
    setIsTraining(true);
    setResult(null);
    try {
      const referenceOds = rows.map((r) => r.referenceOd as number);
      const spectraMatrix = rows.map((r) => r.spectrum!);
      // Assuming all rows use the same wavelengths from the spectrometer
      const wavelengths = rows[0].wavelengths || Array.from({ length: spectraMatrix[0].length }, (_, i) => 900 + i);

      const res: any = await trainCalibrationModel(
        compoundName,
        referenceOds,
        spectraMatrix,
        wavelengths
      );

      if (res.success) {
        setResult({ success: true, r2Score: res.r2Score });
      }
    } catch (error: any) {
      setResult({ success: false, message: error.message });
    } finally {
      setIsTraining(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto dark:bg-zinc-950 dark:text-zinc-100 min-h-screen">
      <h1 className="text-3xl font-bold mb-6 text-indigo-500">Self-Calibration Wizard</h1>
      
      <div className="mb-6 bg-white dark:bg-zinc-900 shadow-md rounded-xl p-6 border border-zinc-200 dark:border-zinc-800">
        <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
          Compound Name
        </label>
        <input
          type="text"
          value={compoundName}
          onChange={(e) => setCompoundName(e.target.value)}
          placeholder="e.g. Chlorophyll a"
          className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div className="bg-white dark:bg-zinc-900 shadow-md rounded-xl p-6 border border-zinc-200 dark:border-zinc-800 overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 text-sm uppercase">
              <th className="py-3 px-4">Reference OD (750nm)</th>
              <th className="py-3 px-4">Spectrum Data</th>
              <th className="py-3 px-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={row.id} className="border-b border-zinc-100 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                <td className="py-3 px-4 w-1/3">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={row.referenceOd}
                    onChange={(e) => updateReferenceOd(row.id, e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </td>
                <td className="py-3 px-4 w-1/3">
                  {row.spectrum ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                      Captured ({row.spectrum.length} px)
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                      Pending
                    </span>
                  )}
                </td>
                <td className="py-3 px-4 flex gap-2 justify-center">
                  <button
                    onClick={() => handleCapture(row.id)}
                    disabled={row.isCapturing}
                    className="px-4 py-2 bg-indigo-500 text-white text-sm rounded-lg hover:bg-indigo-600 focus:ring-2 focus:ring-indigo-400 disabled:opacity-50 transition-colors"
                  >
                    {row.isCapturing ? "Capturing..." : "Capture Spectrum"}
                  </button>
                  <button
                    onClick={() => removeRow(row.id)}
                    className="px-3 py-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        <div className="mt-4 border-t border-zinc-200 dark:border-zinc-800 pt-4 flex justify-between items-center">
             <button
            onClick={addRow}
            className="px-4 py-2 text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-lg transition-colors border border-emerald-200 dark:border-emerald-800"
          >
            + Add Data Point
          </button>
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            {rows.length} points total (Min 2 recommended)
          </span>
        </div>
      </div>

      <div className="mt-8 flex flex-col items-center gap-4">
        {result && (
          <div className={`p-4 rounded-xl w-full text-center ${result.success ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800'}`}>
            {result.success ? `✅ Model Trained Successfully! R² Score: ${result.r2Score?.toFixed(4)}` : `❌ Error: ${result.message}`}
          </div>
        )}

        <button
          onClick={handleTrain}
          disabled={!isReadyToTrain || isTraining}
          className="w-full max-w-sm px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-lg font-bold rounded-xl shadow-lg hover:from-indigo-600 hover:to-purple-700 focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-95"
        >
          {isTraining ? "Training Model..." : "Train Calibration Model"}
        </button>
      </div>
    </div>
  );
}
