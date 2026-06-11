import React from 'react';
import { LayoutDashboard, MessageSquare, PlusCircle, ShoppingCart, Trash2, Upload } from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab, hasData, chatSessions, setActiveChatId, onNewChat, onDeleteChat }) {
  return (
    <div className="sidebar" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Brand */}
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon">
          <ShoppingCart size={18} color="white" />
        </div>
        <div>
          <div className="sidebar-brand-text">RFM Analyzer</div>
          <div className="sidebar-brand-sub">Supermarket Intelligence</div>
        </div>
      </div>

      {/* Navigation */}
      <div className="sidebar-nav" style={{ flex: 1, overflowY: 'auto' }}>
        <div className="nav-label">Main Menu</div>

        <div
          className={`nav-item ${activeTab === 'upload' ? 'active' : ''}`}
          onClick={() => setActiveTab('upload')}
        >
          <Upload size={17} className="nav-icon" />
          Upload Data
        </div>

        <div
          className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''} ${!hasData ? 'disabled' : ''}`}
          onClick={() => hasData && setActiveTab('dashboard')}
          style={{ opacity: hasData ? 1 : 0.4, cursor: hasData ? 'pointer' : 'not-allowed' }}
        >
          <LayoutDashboard size={17} className="nav-icon" />
          Dashboard
          {!hasData && <span style={{ fontSize: 9, color: '#9ca3af', marginLeft: 'auto' }}>Upload first</span>}
        </div>

        {/* Chat History Section */}
        <div
          className="nav-label"
          style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          Chat History
          {hasData && (
            <PlusCircle
              size={14}
              style={{ cursor: 'pointer', color: '#6366f1', flexShrink: 0 }}
              onClick={(e) => { e.stopPropagation(); onNewChat(); }}
              title="New Chat"
            />
          )}
        </div>

        {chatSessions.length === 0 && (
          <div style={{ fontSize: 11, color: '#9ca3af', padding: '4px 12px' }}>
            Upload data to start chatting
          </div>
        )}

        {chatSessions.map((chat) => (
          <div
            key={chat.id}
            className={`nav-item ${activeTab === 'agent-' + chat.id ? 'active' : ''}`}
            onClick={() => {
              setActiveChatId(chat.id);
              setActiveTab('agent-' + chat.id);
            }}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 14 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, overflow: 'hidden', flex: 1 }}>
              <MessageSquare size={14} className="nav-icon" style={{ flexShrink: 0 }} />
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 110, fontSize: 12 }}>
                {chat.title}
              </span>
            </div>
            <Trash2
              size={12}
              color="#9ca3af"
              style={{ cursor: 'pointer', flexShrink: 0, marginLeft: 4 }}
              onClick={(e) => { e.stopPropagation(); onDeleteChat(chat.id); }}
              title="Delete Chat"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
