import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Copy, Share, Edit2, Check } from 'lucide-react';

export default function AIAgent({ data, messages, isGenerating, onSendMessage, onEditMessage }) {
  const [input, setInput] = useState('');
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editValue, setEditValue] = useState('');
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isGenerating, editingIndex]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() || isGenerating) return;
    onSendMessage(input.trim());
    setInput('');
  };

  const handleCopy = async (text, idx) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for non-HTTPS connections
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
      }
      setCopiedIndex(idx);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
      alert('Copy failed. Your browser might not support copying from this context.');
    }
  };

  const handleShare = async (text) => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'AI Sales Agent', text: text });
      } catch (e) {
        // user aborted share
      }
    } else {
      await handleCopy(text, -1);
      alert('Message copied to clipboard! You can paste it to share.');
    }
  };

  const handleStartEdit = (text, idx) => {
    setEditingIndex(idx);
    setEditValue(text);
  };

  const submitEdit = (idx) => {
    if (!editValue.trim() || isGenerating) return;
    onEditMessage(idx, editValue.trim());
    setEditingIndex(null);
  };

  const quickActions = [
    'List top 5 loyal customers',
    'Show at-risk customers',
    'Give me a segment overview',
    'Marketing strategy for champions',
  ];

  return (
    <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px', borderBottom: '1px solid #f0f0f5',
        display: 'flex', alignItems: 'center', gap: 10,
        background: 'linear-gradient(135deg, #f5f3ff, #eef2ff)',
        borderRadius: '16px 16px 0 0',
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Sparkles size={18} color="white" />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e' }}>Sales AI Agent</div>
          <div style={{ fontSize: 11, color: '#6366f1', fontWeight: 500 }}>
            Powered by phi4-mini · {data ? 'Data loaded ✓' : 'No data'}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="chat-messages" style={{ flex: 1, paddingBottom: 24, overflowY: 'auto' }}>
        {messages.map((msg, idx) => (
          <div key={idx} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, maxWidth: '88%', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row', width: editingIndex === idx ? '100%' : 'auto' }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                background: msg.role === 'user' ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : '#f3f4f6',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {msg.role === 'user'
                  ? <User size={14} color="white" />
                  : <Bot size={14} color="#6366f1" />
                }
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start', width: editingIndex === idx ? '100%' : 'auto' }}>
                
                {editingIndex === idx ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', minWidth: 300 }}>
                    <textarea 
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      style={{
                        width: '100%', padding: '10px 14px', background: '#ffffff',
                        border: '1px solid #6366f1', borderRadius: 10, fontSize: 13,
                        color: '#374151', outline: 'none', resize: 'vertical', minHeight: 60
                      }}
                      autoFocus
                    />
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <button 
                        onClick={() => setEditingIndex(null)}
                        style={{ padding: '6px 12px', borderRadius: 8, background: '#f3f4f6', border: 'none', color: '#374151', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
                      >Cancel</button>
                      <button 
                        onClick={() => submitEdit(idx)}
                        style={{ padding: '6px 12px', borderRadius: 8, background: '#6366f1', border: 'none', color: 'white', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
                      >Save & Submit</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className={`chat-bubble ${msg.role}`}>
                      <FormattedMessage text={msg.content} />
                    </div>
                    {/* Action Icons under bubble */}
                    <div style={{ display: 'flex', gap: 12, marginTop: 6, padding: '0 4px', color: '#9ca3af' }}>
                      {copiedIndex === idx ? (
                        <Check size={13} color="#16a34a" />
                      ) : (
                        <Copy size={13} style={{ cursor: 'pointer' }} onClick={() => handleCopy(msg.content, idx)} title="Copy text" />
                      )}
                      
                      <Share size={13} style={{ cursor: 'pointer' }} onClick={() => handleShare(msg.content)} title="Share" />
                      
                      {msg.role === 'user' && !isGenerating && (
                        <Edit2 size={13} style={{ cursor: 'pointer' }} onClick={() => handleStartEdit(msg.content, idx)} title="Edit and resend" />
                      )}
                    </div>
                  </>
                )}

              </div>
            </div>
          </div>
        ))}
        {isGenerating && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 16 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8, background: '#f3f4f6',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Bot size={14} color="#6366f1" />
            </div>
            <div className="chat-bubble agent" style={{ padding: '12px 16px' }}>
              <div className="typing-dots" style={{ display: 'flex', gap: 4 }}>
                <span /><span /><span />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      {messages.length <= 2 && (
        <div style={{ padding: '0 16px 8px 16px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {quickActions.map((q, i) => (
            <button
              key={i}
              onClick={() => setInput(q)}
              style={{
                padding: '5px 12px', borderRadius: 20, border: '1px solid #e5e7eb',
                background: '#fafafa', fontSize: 11, color: '#6366f1', fontWeight: 500,
                cursor: 'pointer', transition: 'all 0.15s',
              }}
              onMouseOver={(e) => { e.target.style.background = '#eef2ff'; e.target.style.borderColor = '#c7d2fe'; }}
              onMouseOut={(e) => { e.target.style.background = '#fafafa'; e.target.style.borderColor = '#e5e7eb'; }}
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} style={{
        padding: '12px 16px', borderTop: '1px solid #f0f0f5',
        display: 'flex', gap: 8, alignItems: 'center',
      }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about customers, segments, strategies..."
          style={{
            flex: 1, padding: '10px 14px', background: '#f9fafb',
            border: '1px solid #f0f0f5', borderRadius: 10,
            fontSize: 13, color: '#374151', outline: 'none',
          }}
          onFocus={(e) => e.target.style.borderColor = '#c7d2fe'}
          onBlur={(e) => e.target.style.borderColor = '#f0f0f5'}
        />
        <button
          type="submit"
          disabled={isGenerating || !input.trim()}
          style={{
            width: 38, height: 38, borderRadius: 10, border: 'none',
            background: (isGenerating || !input.trim()) ? '#e5e7eb' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: (isGenerating || !input.trim()) ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s',
          }}
        >
          <Send size={16} color="white" />
        </button>
      </form>
    </div>
  );
}

function FormattedMessage({ text }) {
  if (!text) return null;

  const lines = text.split('\n');
  const elements = [];
  let listBuffer = [];
  let listType = null;

  const flushList = () => {
    if (listBuffer.length > 0) {
      if (listType === 'ol') {
        elements.push(
          <ol key={`ol-${elements.length}`} style={{ margin: '6px 0', paddingLeft: 20, fontSize: 13, lineHeight: 1.7 }}>
            {listBuffer.map((item, i) => <li key={i}>{formatInline(item)}</li>)}
          </ol>
        );
      } else {
        elements.push(
          <ul key={`ul-${elements.length}`} style={{ margin: '6px 0', paddingLeft: 18, fontSize: 13, lineHeight: 1.7, listStyleType: 'disc' }}>
            {listBuffer.map((item, i) => <li key={i}>{formatInline(item)}</li>)}
          </ul>
        );
      }
      listBuffer = [];
      listType = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      flushList();
      continue;
    }

    if (/^#{1,3}\s/.test(trimmed)) {
      flushList();
      const headerText = trimmed.replace(/^#{1,3}\s*/, '');
      elements.push(
        <div key={`h-${i}`} style={{ fontWeight: 700, fontSize: 14, color: '#1a1a2e', margin: '8px 0 4px 0' }}>
          {formatInline(headerText)}
        </div>
      );
      continue;
    }

    if (/^[-•*]\s/.test(trimmed)) {
      if (listType !== 'ul') { flushList(); listType = 'ul'; }
      listBuffer.push(trimmed.replace(/^[-•*]\s*/, ''));
      continue;
    }

    if (/^\d+[.)]\s/.test(trimmed)) {
      if (listType !== 'ol') { flushList(); listType = 'ol'; }
      listBuffer.push(trimmed.replace(/^\d+[.)]\s*/, ''));
      continue;
    }

    flushList();
    elements.push(
      <div key={`p-${i}`} style={{ margin: '3px 0', fontSize: 13, lineHeight: 1.65 }}>
        {formatInline(trimmed)}
      </div>
    );
  }

  flushList();
  return <>{elements}</>;
}

function formatInline(text) {
  const parts = [];
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[2]) {
      parts.push(<strong key={match.index} style={{ fontWeight: 700 }}>{match[2]}</strong>);
    } else if (match[3]) {
      parts.push(<em key={match.index}>{match[3]}</em>);
    } else if (match[4]) {
      parts.push(
        <code key={match.index} style={{
          background: '#f3f4f6', padding: '1px 5px', borderRadius: 4,
          fontSize: 12, fontFamily: 'monospace', color: '#6366f1'
        }}>
          {match[4]}
        </code>
      );
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}
