import * as React from 'react';
import type { PaneData, SplitZone, Message, ToolCall } from './types.js';

interface PaneViewProps {
  pane: PaneData;
  active: boolean;
  dropZone: SplitZone | null;
  onActivate: () => void;
  onClose: () => void;
  onMinimize: () => void;
  onMaximize: () => void;
}

/** Status dot color class derived from pane state. */
function statusClass(status: PaneData['status']): string {
  return `ade-status-dot ade-status-dot--${status}`;
}

function renderToolCall(toolCall: ToolCall): React.ReactNode {
  const { name, input, output } = toolCall;
  return (
    <div className="ade-tool-call" key={toolCall.id}>
      <div className="ade-tool-call-name">{name}</div>
      {input ? <div className="ade-tool-call-io">in: {input}</div> : null}
      {output ? <div className="ade-tool-call-io">out: {output}</div> : null}
    </div>
  );
}

function renderMessage(message: Message): React.ReactNode {
  return (
    <div className="ade-message-item" key={message.id}>
      <div className="ade-message-meta">
        <span className="ade-message-role">{message.role}</span>
        {typeof message.timestamp === 'number' ? (
          <span>{new Date(message.timestamp).toLocaleTimeString()}</span>
        ) : null}
      </div>
      {message.content ? <div className="ade-message-content">{message.content}</div> : null}
      {message.toolCalls?.map(renderToolCall)}
      {message.codeBlocks?.map((code, index) => (
        <pre className="ade-code-block" key={`${message.id}-code-${index}`}>
          <code>{code}</code>
        </pre>
      ))}
    </div>
  );
}

export function PaneView({
  pane,
  active,
  dropZone,
  onActivate,
  onClose,
  onMinimize,
  onMaximize,
}: PaneViewProps) {
  const classes = [
    'ade-pane-view',
    active ? 'active' : '',
    dropZone ? `drop-${dropZone}` : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={classes}
      data-pane-id={pane.id}
      onPointerDown={onActivate}
    >
      <div className="ade-pane-header">
        <div className="ade-pane-title-group">
          <span className={statusClass(pane.status)} />
          <span className="ade-pane-title">{pane.title}</span>
          {pane.workspaceName ? (
            <span className="ade-workspace-tag">{pane.workspaceName}</span>
          ) : null}
        </div>
        <div className="ade-pane-actions">
          <button className="ade-pane-btn" title="Minimize" onClick={onMinimize}>
            –
          </button>
          <button className="ade-pane-btn" title="Maximize" onClick={onMaximize}>
            □
          </button>
          <button className="ade-pane-btn" title="Close" onClick={onClose}>
            ×
          </button>
        </div>
      </div>
      <div className="ade-pane-body">
        {pane.messages.length === 0 ? (
          <div className="ade-message-content">No messages yet.</div>
        ) : (
          pane.messages.map(renderMessage)
        )}
      </div>
      {dropZone ? (
        <div className={`ade-pane-drop-zone ade-pane-drop-zone--${dropZone}`} />
      ) : null}
    </div>
  );
}