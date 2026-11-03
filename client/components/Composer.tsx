import * as React from 'react';

interface ComposerProps {
  broadcast: boolean;
  targetLabel: string;
  targetCount: number;
  disabled?: boolean;
  onToggleBroadcast: () => void;
  onSend: (text: string) => void;
}

export function Composer({
  broadcast,
  targetLabel,
  targetCount,
  disabled = false,
  onToggleBroadcast,
  onSend,
}: ComposerProps) {
  const [value, setValue] = React.useState('');

  const canSend = value.trim().length > 0 && !disabled;

  const submit = () => {
    if (!canSend) {
      return;
    }
    onSend(value);
    setValue('');
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <footer className="ade-composer">
      <div className="ade-composer-toolbar">
        <label className="ade-toggle">
          <input
            type="checkbox"
            checked={broadcast}
            onChange={onToggleBroadcast}
          />
          Broadcast
        </label>
        <span className="ade-composer-target">
          <span className="ade-badge">{targetLabel}</span>
          {targetCount > 0 ? <span className="ade-composer-count">{targetCount}</span> : null}
        </span>
      </div>
      <div className="ade-composer-input-row">
        <textarea
          className="ade-composer-textarea"
          placeholder="Type a message…"
          value={value}
          disabled={disabled}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <button
          className="ade-composer-send-btn"
          disabled={!canSend}
          onClick={submit}
        >
          Send
        </button>
      </div>
    </footer>
  );
}