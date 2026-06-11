export function DemoSection({ title, description, changes, children }) {
  return (
    <div>
      <div className="demo-section-header">
        <h2>{title}</h2>
        <p>{description}</p>
        {changes && (
          <div className="demo-changes-note">
            <strong>Cambios vs actual:</strong> {changes}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}
