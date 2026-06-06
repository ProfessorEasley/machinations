import React from 'react';
import './QuickRunResultDialog.css';

export interface QuickRunResultDialogProps {
  durationSeconds: number;
  endConditionMessage: string;
  onClose: () => void;
}

const QuickRunResultDialog: React.FC<QuickRunResultDialogProps> = ({
  durationSeconds,
  endConditionMessage,
  onClose,
}) => {
  const formattedSeconds =
    durationSeconds >= 10
      ? durationSeconds.toFixed(1)
      : durationSeconds.toFixed(2);

  return (
    <div
      className="quick-run-result-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-run-result-title"
    >
      <div className="quick-run-result-dialog">
        <h2 id="quick-run-result-title" className="quick-run-result-title">
          Run complete
        </h2>
        <p className="quick-run-result-row">
          <span className="quick-run-result-label">Time</span>
          <span className="quick-run-result-value">{formattedSeconds} s</span>
        </p>
        <p className="quick-run-result-row">
          <span className="quick-run-result-label">Result</span>
          <span className="quick-run-result-value">{endConditionMessage}</span>
        </p>
        <button
          type="button"
          className="quick-run-result-dismiss"
          onClick={onClose}
        >
          OK
        </button>
      </div>
    </div>
  );
};

export default QuickRunResultDialog;
