export function PhoneFrame({ children, className = '' }) {
  return (
    <div className={`phone-frame-outer${className ? ` ${className}` : ''}`}>
      <div className="phone-frame">
        <div className="phone-notch">
          <i />
        </div>
        <div className="phone-content">{children}</div>
      </div>
    </div>
  );
}
