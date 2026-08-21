export function WarningPanel({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null;
  return (
    <div className="warning-panel" role="status">
      <strong>Let op</strong>
      <ul>{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
    </div>
  );
}
