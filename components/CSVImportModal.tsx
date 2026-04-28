
import React, { useState, useRef } from 'react';
import * as Papa from 'papaparse';
import { supabase } from '../supabase';
import { Dialog, Button, showToast, Badge, cn } from './ui';
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2, X, Table as TableIcon, Info } from 'lucide-react';

interface CSVImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  type: 'menu' | 'inventory';
  branchId?: string | null;
}

interface ValidationResult {
  data: any[];
  errors: { row: number; msg: string }[];
  headers: string[];
}

export const CSVImportModal: React.FC<CSVImportModalProps> = ({
  isOpen, onClose, onSuccess, type, branchId
}) => {
  const [step, setStep] = useState<'upload' | 'preview' | 'processing' | 'results'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [validationErrors, setValidationErrors] = useState<{ row: number; msg: string }[]>([]);
  const [importResults, setImportResults] = useState<{ success: number; errors: any[] | null } | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const REQUIRED_COLS = {
    menu: ['name', 'category'],
    inventory: ['name', 'category', 'unit', 'cost_per_unit', 'current_stock']
  };

  const ALLOWED_COLS = {
    menu: ['name', 'category', 'price', 'description', 'image_url', 'recipes', 'status', 'is_available'],
    inventory: ['name', 'category', 'unit', 'cost_per_unit', 'current_stock', 'par_min', 'par_max']
  };

  const sanitizeRow = (row: Record<string, any>) => {
    const allowed = ALLOWED_COLS[type];
    return allowed.reduce((acc, key) => {
      if (row[key] !== undefined && row[key] !== null) {
        acc[key] = typeof row[key] === 'string' ? row[key].trim() : row[key];
      }
      return acc;
    }, {} as Record<string, any>);
  };

  const resolveOrganizationId = async () => {
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) throw new Error('You must be logged in to import menu data.');

    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('organization_id, role')
      .eq('id', user.id)
      .single();

    if (profileErr || !profile?.organization_id) {
      throw new Error('Could not resolve your restaurant account.');
    }

    return { userId: user.id, organizationId: profile.organization_id, role: profile.role };
  };

  const importMenuDirectly = async () => {
    if (type !== 'menu') {
      throw new Error('Direct fallback is only available for menu imports right now.');
    }

    if (!branchId) {
      throw new Error('Select a branch before importing CSV data.');
    }

    const { organizationId } = await resolveOrganizationId();

    const normalizeKey = (value: unknown) =>
      String(value ?? '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');

    const hasValue = (value: unknown) =>
      value !== undefined && value !== null && String(value).trim() !== '';

    const { data: categoryRows, error: categoryErr } = await supabase
      .from('categories')
      .select('id, name')
      .eq('organization_id', organizationId);

    if (categoryErr) throw categoryErr;

    const categoryCache = new Map<string, string>();
    (categoryRows || []).forEach((cat: any) => {
      categoryCache.set(String(cat.name || '').toLowerCase(), cat.id);
    });

    const { data: existingMenuRows, error: existingMenuErr } = await supabase
      .from('menu')
      .select('id, name, category, branch_id, price, description, image_url, is_available, status, category_id')
      .eq('organization_id', organizationId)
      .eq('branch_id', branchId);

    if (existingMenuErr) throw existingMenuErr;

    let successCount = 0;
    const errors: { item: string; error: string }[] = [];

    for (const row of parsedData) {
      const itemName = String(row.name || '').trim();
      const categoryName = String(row.category || '').trim();
      if (!itemName) {
        errors.push({ item: 'Unknown', error: 'Missing item name' });
        continue;
      }

      let categoryId = categoryCache.get(categoryName.toLowerCase()) || null;

      if (!categoryId && categoryName) {
        const { data: newCat, error: newCatErr } = await supabase
          .from('categories')
          .insert({
            name: categoryName,
            organization_id: organizationId
          })
          .select()
          .single();

        if (newCatErr) {
          errors.push({ item: row.name || 'Unknown', error: newCatErr.message });
          continue;
        }

        categoryId = newCat.id;
        categoryCache.set(categoryName.toLowerCase(), categoryId);
      }

      const payload = {
        name: itemName,
        category: categoryName,
        category_id: categoryId,
        description: hasValue(row.description) ? String(row.description).trim() : null,
        price: hasValue(row.price) ? Number(row.price) : null,
        image_url: hasValue(row.image_url) ? String(row.image_url).trim() : null,
        status: row.is_available === false ? 'unavailable' : 'available',
        is_available: row.is_available !== false,
        branch_id: branchId,
        organization_id: organizationId,
      };

      const existingMatch = existingMenuRows?.find(existing =>
        normalizeKey(existing.name) === normalizeKey(itemName)
      ) || null;

      if (existingMatch) {
        const resolvedPayload = {
          ...payload,
          price: payload.price ?? existingMatch.price ?? 0,
          category: payload.category || existingMatch.category || null,
          category_id: payload.category_id || existingMatch.category_id || null,
          description: payload.description ?? existingMatch.description ?? null,
          image_url: payload.image_url ?? existingMatch.image_url ?? null,
          is_available: row.is_available !== undefined ? row.is_available !== false : existingMatch.is_available,
          status: row.is_available !== undefined
            ? (row.is_available === false ? 'unavailable' : 'available')
            : existingMatch.status || 'available'
        };

        const { error: itemErr } = await supabase
          .from('menu')
          .update(resolvedPayload)
          .eq('id', existingMatch.id);

        if (itemErr) {
          errors.push({ item: itemName, error: itemErr.message });
          continue;
        }
      } else {
        const newPayload = {
          ...payload,
          price: payload.price ?? 0
        };
        const { data: insertedItem, error: itemErr } = await supabase
          .from('menu')
          .insert(newPayload)
          .select()
          .single();

        if (itemErr) {
          errors.push({ item: itemName, error: itemErr.message });
          continue;
        }

        if (insertedItem) {
          existingMenuRows?.push(insertedItem);
        }
      }

      successCount += 1;
    }

    return { count: successCount, errors: errors.length > 0 ? errors : null };
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) processFile(selectedFile);
  };

  const processFile = (file: File) => {
    setFile(file);
    setLoading(true);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields || [];
        const required = REQUIRED_COLS[type];
        const missing = required.filter(col => !headers.includes(col));

        if (missing.length > 0) {
          showToast(`Missing required columns: ${missing.join(', ')}`, "error");
          setLoading(false);
          return;
        }

        const errors: { row: number; msg: string }[] = [];
        const safeRows = (results.data as Record<string, any>[]).map(sanitizeRow);

        safeRows.forEach((row: any, index: number) => {
          required.forEach(col => {
            if (!row[col] || row[col].toString().trim() === '') {
              errors.push({ row: index + 1, msg: `Missing ${col}` });
            }
          });

          // Price/Stock Validation
          if (type === 'menu' && row.price !== undefined && row.price !== null && String(row.price).trim() !== '' && isNaN(parseFloat(row.price))) {
            errors.push({ row: index + 1, msg: `Invalid price: ${row.price}` });
          }
          if (type === 'inventory' && isNaN(parseFloat(row.current_stock))) {
            errors.push({ row: index + 1, msg: `Invalid stock: ${row.current_stock}` });
          }
        });

        setParsedData(safeRows);
        setValidationErrors(errors);
        setStep('preview');
        setLoading(false);
      },
      error: (err) => {
        showToast(err.message, "error");
        setLoading(false);
      }
    });
  };

  const handleImport = async () => {
    if (validationErrors.length > 0) {
      showToast("Please fix validation errors in your CSV before importing.", "error");
      return;
    }

    if (!branchId) {
      showToast("Select a branch before importing CSV data.", "error");
      return;
    }

    setStep('processing');
    setLoading(true);

    try {
      const functionName = type === 'menu' ? 'manage-menu' : 'manage-inventory';
      const payload = {
        action: 'bulk_upsert',
        branch_id: branchId,
        items: parsedData
      };

      const { data, error } = await supabase.functions.invoke(functionName, {
        body: payload
      });

      const shouldFallback = !!error || (data && data.error);

      if (!shouldFallback) {
        setImportResults({
          success: data.count || 0,
          errors: data.errors || null
        });
        setStep('results');
        if (data.count > 0) onSuccess();
      } else if (type === 'menu') {
        console.warn('Menu bulk import edge function failed, using direct fallback.', error || data?.error);
        const fallback = await importMenuDirectly();
        setImportResults({
          success: fallback.count,
          errors: fallback.errors
        });
        setStep('results');
        if (fallback.count > 0) onSuccess();
      } else {
        throw error || new Error(data?.error || 'Import failed');
      }
    } catch (err: any) {
      showToast(err.message || "Import failed", "error");
      setStep('preview');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setStep('upload');
    setFile(null);
    setParsedData([]);
    setValidationErrors([]);
    setImportResults(null);
  };

  return (
    <Dialog 
      isOpen={isOpen} 
      onClose={onClose} 
      title={`Bulk Import: ${type === 'menu' ? 'Menu Items' : 'Inventory'}`}
      maxWidth="max-w-4xl"
    >
      <div className="flex flex-col gap-6 min-h-[400px]">
        
        {step === 'upload' && (
          <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-primary/20 rounded-[2rem] bg-black/20 p-10 transition-all hover:bg-black/30 group">
            <div className="w-20 h-20 rounded-3xl bg-primary/5 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <Upload className="w-10 h-10 text-primary" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2 uppercase tracking-tighter text-center">Standard CSV Upload</h3>
            <p className="text-[10px] text-gray-500 mb-6 text-center max-w-sm uppercase font-black tracking-[0.15em] leading-relaxed">
              Ensure your file corresponds to the active branch.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl mb-10 overflow-hidden">
               <div className="bg-black/40 border border-primary/10 p-5 rounded-2xl flex flex-col gap-2">
                  <span className="text-[9px] font-black text-primary uppercase tracking-widest bg-primary/10 w-fit px-2 py-0.5 rounded-lg mb-1">Mandatory Columns</span>
                  <div className="flex flex-wrap gap-1.5 uppercase font-mono text-[10px] text-white">
                      {REQUIRED_COLS[type].map(c => <Badge key={c} variant="outline" className="border-primary/20 text-primary">{c}</Badge>)}
                  </div>
               </div>
               <div className="bg-black/40 border border-white/5 p-5 rounded-2xl flex flex-col gap-2">
                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest bg-white/5 w-fit px-2 py-0.5 rounded-lg mb-1">Optional Fields</span>
                  <div className="flex flex-wrap gap-1.5 uppercase font-mono text-[9px] text-gray-500">
                      {ALLOWED_COLS[type].filter(c => !REQUIRED_COLS[type].includes(c)).map(c => <Badge key={c} variant="ghost" className="bg-white/5 text-gray-400">{c}</Badge>)}
                  </div>
               </div>
            </div>
            
            <Button 
              onClick={() => fileInputRef.current?.click()}
              isLoading={loading}
              className="px-14 h-14 rounded-2xl bg-primary text-black font-black uppercase tracking-widest shadow-2xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
            >
              Select CSV File
            </Button>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              accept=".csv" 
              className="hidden" 
            />
          </div>
        )}

        {step === 'preview' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <FileText className="w-6 h-6 text-primary" />
                <div>
                  <h3 className="text-lg font-bold text-white uppercase tracking-tighter">{file?.name}</h3>
                  <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest">
                    {parsedData.length} rows found • {validationErrors.length} errors
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={reset} className="text-red-500">
                <X className="w-4 h-4 mr-2" /> Change File
              </Button>
            </div>

            <div className="rounded-2xl border border-white/5 bg-black/40 overflow-hidden mb-6">
              <div className="max-h-[300px] overflow-auto custom-scrollbar">
                <table className="w-full text-[10px] text-left">
                  <thead className="bg-black/60 text-gray-500 font-black uppercase tracking-widest sticky top-0">
                    <tr>
                      <th className="px-4 py-3 border-b border-white/5 w-12 text-center">Row</th>
                      {REQUIRED_COLS[type].map(col => (
                        <th key={col} className="px-4 py-3 border-b border-white/5 uppercase">{col}</th>
                      ))}
                      <th className="px-4 py-3 border-b border-white/5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {parsedData.slice(0, 50).map((row, i) => {
                      const rowErrors = validationErrors.filter(e => e.row === i + 1);
                      return (
                        <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-4 py-3 text-center text-gray-600 font-mono">{i + 1}</td>
                          {REQUIRED_COLS[type].map(col => (
                            <td key={col} className="px-4 py-3 text-gray-300">
                              {row[col]?.toString().substring(0, 30)}
                              {row[col]?.toString().length > 30 && '...'}
                            </td>
                          ))}
                          <td className="px-4 py-3 text-right">
                            {rowErrors.length > 0 ? (
                              <Badge variant="destructive" className="h-5 px-1.5 text-[8px]">Fix Error</Badge>
                            ) : (
                              <Badge variant="success" className="h-5 px-1.5 text-[8px]">Valid</Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {validationErrors.length > 0 && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 mb-8">
                <div className="flex items-center gap-3 mb-4">
                  <AlertCircle className="w-5 h-5 text-red-500" />
                  <h4 className="text-sm font-bold text-red-500 uppercase tracking-widest">Validation Errors</h4>
                </div>
                <div className="space-y-2 max-h-[120px] overflow-auto pr-2">
                  {validationErrors.slice(0, 20).map((err, i) => (
                    <div key={i} className="text-[10px] text-gray-400 flex items-center justify-between bg-black/20 p-2 rounded-lg">
                      <span className="font-black text-red-400/60 font-mono">Row {err.row}</span>
                      <span>{err.msg}</span>
                    </div>
                  ))}
                  {validationErrors.length > 20 && (
                    <p className="text-[9px] text-gray-600 italic">...and {validationErrors.length - 20} more errors</p>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-4">
              <Button 
                onClick={handleImport} 
                disabled={validationErrors.length > 0}
                className="flex-1 h-14 text-sm"
              >
                Start Secure Import
              </Button>
            </div>
          </div>
        )}

        {step === 'processing' && (
          <div className="flex-1 flex flex-col items-center justify-center py-20">
            <Loader2 className="w-12 h-12 text-primary animate-spin mb-6" />
            <h3 className="text-xl font-bold text-white mb-2 uppercase tracking-tighter">Processing Data</h3>
            <p className="text-xs text-gray-500 uppercase font-black tracking-widest">Enforcing database constraints & mapping relations...</p>
          </div>
        )}

        {step === 'results' && importResults && (
          <div className="animate-in zoom-in-95 duration-500 flex flex-col items-center text-center">
            <div className="w-20 h-20 rounded-3xl bg-green-500/10 flex items-center justify-center mb-6">
              <CheckCircle2 className="w-10 h-10 text-green-500" />
            </div>
            <h3 className="text-2xl font-black text-white mb-2 uppercase tracking-tighter">Import Complete</h3>
            <p className="text-sm text-gray-400 mb-8 uppercase tracking-widest font-bold">
              Successfully processed <span className="text-primary">{importResults.success}</span> records
            </p>

            {importResults.errors && importResults.errors.length > 0 && (
              <div className="w-full bg-red-500/5 border border-red-500/10 rounded-2xl p-6 text-left mb-8 max-h-[200px] overflow-auto">
                <div className="flex items-center gap-2 mb-4">
                  <AlertCircle className="w-4 h-4 text-red-500" />
                  <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">Import Exceptions ({importResults.errors.length})</span>
                </div>
                <div className="space-y-2">
                  {importResults.errors.map((err, i) => (
                    <div key={i} className="text-[10px] text-gray-500 flex justify-between gap-4 p-2 bg-black/20 rounded-lg">
                      <span className="font-bold whitespace-nowrap">{err.item || err.name}</span>
                      <span className="text-red-400/80">{err.error}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button onClick={onClose} className="w-full h-14">Finish & Close</Button>
          </div>
        )}
      </div>
    </Dialog>
  );
};
