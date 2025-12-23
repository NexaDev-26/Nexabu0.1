/**
 * Bulk Import Modal Component
 * Handles CSV/Excel file imports for products
 */

import React, { useState, useRef } from 'react';
import { Upload, X, FileText, CheckCircle, AlertCircle, Download, Loader } from 'lucide-react';
import { importProducts, generateProductTemplate, ImportResult } from '../utils/bulkImport';
import { ApiService } from '../services/apiService';
import { ErrorHandler } from '../utils/errorHandler';
import { useLoading } from '../hooks/useLoading';

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  uid: string;
  onSuccess?: () => void;
}

export const BulkImportModal: React.FC<BulkImportModalProps> = ({
  isOpen,
  onClose,
  uid,
  onSuccess
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const loading = useLoading();

  if (!isOpen) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const validExtensions = ['.csv', '.xlsx', '.xls'];
      const fileExtension = selectedFile.name.substring(selectedFile.name.lastIndexOf('.')).toLowerCase();
      
      if (!validExtensions.includes(fileExtension)) {
        alert('Please select a valid CSV or Excel file (.csv, .xlsx, .xls)');
        return;
      }
      
      setFile(selectedFile);
      setImportResult(null);
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setIsImporting(true);
    setImportProgress(0);
    loading.startLoading();

    try {
      // Step 1: Parse and validate file
      setImportProgress(25);
      const result = await importProducts(file, uid, undefined, {
        skipHeader: true,
        validateData: true,
        batchSize: 50
      });

      setImportProgress(50);
      setImportResult(result);

      if (!result.success || !result.data || result.data.length === 0) {
        loading.stopLoading();
        setIsImporting(false);
        return;
      }

      // Step 2: Import products in batches
      setImportProgress(60);
      const batchSize = 50;
      let imported = 0;
      let failed = 0;

      for (let i = 0; i < result.data.length; i += batchSize) {
        const batch = result.data.slice(i, i + batchSize);
        
        const operations = batch.map(product => ({
          type: 'create' as const,
          collection: 'products',
          data: product
        }));

        const batchResponse = await ApiService.batchWrite(operations);
        
        if (batchResponse.success) {
          imported += batch.length;
        } else {
          failed += batch.length;
        }

        setImportProgress(60 + Math.floor((i / result.data.length) * 30));
      }

      setImportProgress(100);
      setImportResult({
        ...result,
        successful: imported,
        failed: result.failed + failed
      });

      if (imported > 0) {
        onSuccess?.();
      }

    } catch (error: any) {
      const appError = ErrorHandler.handleApiError(error);
      ErrorHandler.logError(appError, 'Bulk Import');
      setImportResult({
        success: false,
        totalRows: 0,
        successful: 0,
        failed: 0,
        errors: [{ row: 0, errors: [appError.message] }]
      });
    } finally {
      setIsImporting(false);
      loading.stopLoading();
    }
  };

  const handleDownloadTemplate = () => {
    generateProductTemplate();
  };

  const handleClose = () => {
    setFile(null);
    setImportResult(null);
    setImportProgress(0);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden border border-neutral-200 dark:border-neutral-800">
        {/* Header */}
        <div className="p-6 border-b border-neutral-200 dark:border-neutral-800 flex justify-between items-center bg-neutral-50 dark:bg-neutral-950">
          <div>
            <h3 className="font-bold text-lg text-neutral-900 dark:text-white">Bulk Import Products</h3>
            <p className="text-sm text-neutral-500 mt-1">Import products from CSV or Excel file</p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded-full transition-colors text-neutral-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* File Upload */}
          {!importResult && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-neutral-300 dark:border-neutral-700 rounded-xl p-8 text-center hover:border-orange-500 transition-colors">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                
                {!file ? (
                  <div className="space-y-4">
                    <Upload className="w-12 h-12 mx-auto text-neutral-400" />
                    <div>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="text-orange-600 dark:text-orange-400 font-medium hover:underline"
                      >
                        Click to upload
                      </button>
                      <span className="text-neutral-500"> or drag and drop</span>
                    </div>
                    <p className="text-sm text-neutral-500">CSV or Excel file (max 10MB)</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <FileText className="w-12 h-12 mx-auto text-green-500" />
                    <p className="font-medium text-neutral-900 dark:text-white">{file.name}</p>
                    <p className="text-sm text-neutral-500">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                    <button
                      onClick={() => {
                        setFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="text-sm text-red-600 hover:underline"
                    >
                      Remove file
                    </button>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleDownloadTemplate}
                  className="flex-1 px-4 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 flex items-center justify-center gap-2 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download Template
                </button>
                <button
                  onClick={handleImport}
                  disabled={!file || isImporting}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                >
                  {isImporting ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Import Products
                    </>
                  )}
                </button>
              </div>

              {/* Progress Bar */}
              {isImporting && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-neutral-600 dark:text-neutral-400">
                    <span>Importing products...</span>
                    <span>{importProgress}%</span>
                  </div>
                  <div className="w-full bg-neutral-200 dark:bg-neutral-800 rounded-full h-2">
                    <div
                      className="bg-orange-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${importProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Import Results */}
          {importResult && (
            <div className="space-y-4">
              <div className={`p-4 rounded-lg ${
                importResult.success && importResult.failed === 0
                  ? 'bg-green-50 dark:bg-green-900/20'
                  : 'bg-yellow-50 dark:bg-yellow-900/20'
              }`}>
                <div className="flex items-start gap-3">
                  {importResult.success && importResult.failed === 0 ? (
                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <h4 className="font-medium text-neutral-900 dark:text-white mb-2">
                      Import {importResult.success && importResult.failed === 0 ? 'Completed' : 'Completed with Errors'}
                    </h4>
                    <div className="space-y-1 text-sm">
                      <p>Total Rows: {importResult.totalRows}</p>
                      <p className="text-green-600 dark:text-green-400">
                        Successful: {importResult.successful}
                      </p>
                      {importResult.failed > 0 && (
                        <p className="text-red-600 dark:text-red-400">
                          Failed: {importResult.failed}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Errors */}
              {importResult.errors.length > 0 && (
                <div className="space-y-2">
                  <h5 className="font-medium text-neutral-900 dark:text-white">Errors:</h5>
                  <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 max-h-60 overflow-y-auto">
                    {importResult.errors.map((error, idx) => (
                      <div key={idx} className="text-sm text-red-700 dark:text-red-400 mb-2">
                        <p className="font-medium">Row {error.row}:</p>
                        <ul className="list-disc list-inside ml-2">
                          {error.errors.map((err, i) => (
                            <li key={i}>{err}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 flex justify-end gap-3">
          <button
            onClick={handleClose}
            className="px-4 py-2 bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-lg hover:bg-neutral-300 dark:hover:bg-neutral-700 transition-colors"
          >
            {importResult ? 'Close' : 'Cancel'}
          </button>
          {importResult && (
            <button
              onClick={() => {
                setFile(null);
                setImportResult(null);
                setImportProgress(0);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-500 transition-colors"
            >
              Import Another File
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

