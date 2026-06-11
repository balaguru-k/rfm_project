import React, { useState, useRef } from 'react';
import axios from 'axios';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import AIAgent from './components/AIAgent';
import FileUpload from './components/FileUpload';
import { Upload } from 'lucide-react';

function App() {
  const [rfmData,        setRfmData]        = useState(null);   // array of customer records
  const [datasetProfile, setDatasetProfile] = useState(null);   // profile object from backend
  const [activeTab,      setActiveTab]      = useState('upload');

  const [chatSessions,  setChatSessions]  = useState([]);
  const [activeChatId,  setActiveChatId]  = useState(null);
  const [isGenerating,  setIsGenerating]  = useState(false);

  const fileInputRef = useRef(null);

  // ── Single entry-point for all data updates ──────────────────────────────
  const handleDataReceived = (responseData) => {
    // Backend now returns { customers: [...], profile: {...} }
    const customers = responseData.customers ?? responseData; // fallback for old format
    const profile   = responseData.profile   ?? null;

    setRfmData(customers);
    setDatasetProfile(profile);

    const newChatId  = Date.now();
    const totalCusts = profile?.rfm?.total_customers ?? customers.length;
    const dateMin    = profile?.date_range?.min ?? '';
    const dateMax    = profile?.date_range?.max ?? '';
    const dateStr    = dateMin ? ` (${dateMin} → ${dateMax})` : '';

    const newSession = {
      id: newChatId,
      title: 'Dataset Chat',
      messages: [{
        role: 'agent',
        content:
          `✅ **Dataset loaded successfully!**\n\n` +
          `- **${totalCusts.toLocaleString()}** unique customers analysed\n` +
          `- **${(profile?.total_records ?? 0).toLocaleString()}** transactions processed${dateStr}\n` +
          `- **$${(profile?.total_revenue ?? 0).toLocaleString(undefined, {maximumFractionDigits: 0})}** total revenue\n\n` +
          `Ask me anything about your customers, segments, or marketing strategies!`,
      }],
    };

    setChatSessions(prev => [...prev, newSession]);
    setActiveChatId(newChatId);
    setActiveTab('dashboard');   // jump straight to dashboard
  };

  // Header re-upload
  const handleHeaderUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await axios.post('http://localhost:8000/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      handleDataReceived(res.data);
    } catch (err) {
      alert(err.response?.data?.detail || 'Error uploading file.');
    }
    e.target.value = '';
  };

  const handleNewChat = () => {
    const newChatId = Date.now();
    setChatSessions(prev => [...prev, {
      id: newChatId,
      title: 'New Chat',
      messages: [{ role: 'agent', content: '👋 Hello! How can I assist you with your customer data today?' }],
    }]);
    setActiveChatId(newChatId);
    setActiveTab('agent-' + newChatId);
  };

  const handleDeleteChat = (chatId) => {
    setChatSessions(prev => {
      const updated = prev.filter(c => c.id !== chatId);
      if (activeChatId === chatId) {
        if (updated.length > 0) {
          const last = updated[updated.length - 1];
          setActiveChatId(last.id);
          setActiveTab('agent-' + last.id);
        } else {
          setActiveChatId(null);
          setActiveTab('dashboard');
        }
      }
      return updated;
    });
  };

  const activeChat = chatSessions.find(c => c.id === activeChatId);

  const updateChatMessages = (fn) => {
    setChatSessions(prev => prev.map(chat =>
      chat.id === activeChatId
        ? { ...chat, messages: typeof fn === 'function' ? fn(chat.messages) : fn }
        : chat
    ));
  };

  const renameChatFromMessage = (userMessage) => {
    setChatSessions(prev => prev.map(chat =>
      chat.id === activeChatId && (chat.title === 'New Chat' || chat.title === 'Dataset Chat')
        ? { ...chat, title: userMessage.slice(0, 26) + (userMessage.length > 26 ? '…' : '') }
        : chat
    ));
  };

  const triggerAIResponse = async (historyToSend) => {
    setIsGenerating(true);
    try {
      const res = await axios.post('http://localhost:8000/api/chat', {
        message: historyToSend[historyToSend.length - 1].content,
        history: historyToSend.slice(0, -1),
      }, { timeout: 180000 });
      updateChatMessages(prev => [...prev, { role: 'agent', content: res.data.response }]);
    } catch (error) {
      const detail = error.response?.data?.detail || 'Cannot reach the backend. Ensure the backend and Ollama are running.';
      updateChatMessages(prev => [...prev, { role: 'agent', content: `⚠️ ${detail}` }]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendMessage = (userMessage) => {
    const current  = chatSessions.find(c => c.id === activeChatId)?.messages ?? [];
    const updated  = [...current, { role: 'user', content: userMessage }];
    updateChatMessages(updated);
    renameChatFromMessage(userMessage);
    const history = updated.slice(1).map(m => ({ role: m.role === 'agent' ? 'assistant' : 'user', content: m.content }));
    triggerAIResponse(history);
  };

  const handleEditMessage = (idx, newText) => {
    const current  = chatSessions.find(c => c.id === activeChatId)?.messages ?? [];
    const truncated = [...current.slice(0, idx), { role: 'user', content: newText }];
    updateChatMessages(truncated);
    const history = truncated.slice(1).map(m => ({ role: m.role === 'agent' ? 'assistant' : 'user', content: m.content }));
    triggerAIResponse(history);
  };

  const isOnAgent = activeTab.startsWith('agent');

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', background: '#f4f5f7', overflow: 'hidden' }}>
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        hasData={!!rfmData}
        chatSessions={chatSessions}
        setActiveChatId={setActiveChatId}
        onNewChat={handleNewChat}
        onDeleteChat={handleDeleteChat}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', marginLeft: 220 }}>
        {/* Header */}
        <div className="top-header" style={{ flexShrink: 0 }}>
          <div>
            <div className="header-title">
              {activeTab === 'dashboard' ? 'Dashboard'
                : activeTab === 'upload'  ? 'Upload Data'
                : 'AI Sales Agent'}
            </div>
            <div className="header-breadcrumb">
              RFM Analyzer /{' '}
              {activeTab === 'dashboard' ? `${(datasetProfile?.rfm?.total_customers ?? 0).toLocaleString()} customers`
                : activeTab === 'upload'  ? 'Upload'
                : activeChat?.title}
            </div>
          </div>

          <div className="header-actions">
            {rfmData && (
              <>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 16px', borderRadius: 10, background: '#f9fafb',
                    border: '1px solid #f0f0f5', color: '#374151', fontSize: 13,
                    fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  <Upload size={14} color="#6366f1" />
                  Upload New CSV
                </button>
                <input type="file" ref={fileInputRef} accept=".csv" style={{ display: 'none' }} onChange={handleHeaderUpload} />
              </>
            )}
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '24px 28px', flex: 1, overflowY: 'auto' }}>
          {(activeTab === 'upload' || (!rfmData && activeTab === 'dashboard')) && (
            <FileUpload onDataReceived={handleDataReceived} />
          )}

          {activeTab === 'dashboard' && rfmData && (
            <Dashboard data={rfmData} profile={datasetProfile} />
          )}

          {isOnAgent && activeChat && (
            <div style={{ height: '100%' }}>
              <AIAgent
                data={rfmData}
                profile={datasetProfile}
                messages={activeChat.messages}
                isGenerating={isGenerating}
                onSendMessage={handleSendMessage}
                onEditMessage={handleEditMessage}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
