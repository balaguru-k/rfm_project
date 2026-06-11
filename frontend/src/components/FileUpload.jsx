import React, { useState, useRef } from 'react';
import axios from 'axios';
import { UploadCloud, CheckCircle, AlertCircle, FileSpreadsheet, X } from 'lucide-react';

export default function FileUpload({ onDataReceived }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (f) { setFile(f); setError(''); setSuccess(''); }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f && f.name.endsWith('.csv')) { setFile(f); setError(''); setSuccess(''); }
    else { setError('Only CSV files are supported.'); }
  };

  const handleUpload = async () => {
    if (!file) { setError('Please select a file first.'); return; }
    const formData = new FormData();
    formData.append('file', file);
    setLoading(true); setError(''); setSuccess('');

    try {
      const response = await axios.post('http://localhost:8000/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const count = response.data?.customers?.length ?? response.data?.length ?? 0;
      setSuccess(`Successfully analysed ${count} customers!`);
      setTimeout(() => onDataReceived(response.data), 800);
    } catch (err) {
      setError(err.response?.data?.detail || 'An error occurred during upload.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '70vh', gap: 24 }}>
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <h2 style={{ fontSize: 24, fontWeight: 800, color: '#1a1a2e', marginBottom: 6 }}>Upload Transaction Data</h2>
        <p style={{ color: '#9ca3af', fontSize: 14 }}>Import a CSV with <strong>CustomerID</strong>, <strong>Date</strong>, and <strong>Amount</strong> columns</p>
      </div>

      {/* Drop Zone */}
      <div
        className={`upload-zone ${file ? 'has-file' : ''}`}
        style={{ maxWidth: 480, width: '100%' }}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        {file ? (
          <>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileSpreadsheet size={26} color="#6366f1" />
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e' }}>{file.name}</div>
              <div style={{ fontSize: 12, color: '#9ca3af' }}>{(file.size / 1024).toFixed(1)} KB</div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); setFile(null); setError(''); setSuccess(''); }}
              style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <X size={16} color="#9ca3af" />
            </button>
          </>
        ) : (
          <>
            <div style={{ width: 60, height: 60, borderRadius: 16, background: 'linear-gradient(135deg, #eef2ff, #ede9fe)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <UploadCloud size={28} color="#6366f1" />
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>Drop your CSV file here</div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>or click to browse</div>
            </div>
          </>
        )}
        <input ref={inputRef} type="file" accept=".csv" onChange={handleFileChange} style={{ display: 'none' }} />
      </div>

      {/* Upload Button */}
      <button
        onClick={handleUpload}
        disabled={!file || loading}
        style={{
          padding: '12px 40px', borderRadius: 12, border: 'none',
          background: (!file || loading) ? '#e5e7eb' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          color: (!file || loading) ? '#9ca3af' : 'white',
          fontWeight: 700, fontSize: 14, cursor: (!file || loading) ? 'not-allowed' : 'pointer',
          boxShadow: file && !loading ? '0 4px 14px rgba(99,102,241,0.3)' : 'none',
          transition: 'all 0.2s',
        }}
      >
        {loading ? 'Processing...' : 'Upload & Analyze'}
      </button>

      {/* Status Messages */}
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#dc2626', fontSize: 13, fontWeight: 500 }}>
          <AlertCircle size={15} /> {error}
        </div>
      )}
      {success && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#16a34a', fontSize: 13, fontWeight: 500 }}>
          <CheckCircle size={15} /> {success}
        </div>
      )}
    </div>
  );
}
