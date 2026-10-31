import { useState } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';

/** Labelled input with a leading icon. */
export const FormField = ({ id, label, icon: Icon, optional, hint, error, children, ...inputProps }) => (
  <div className="form-group">
    <label htmlFor={id}>
      {label} {optional && <span className="optional">(optional)</span>}
    </label>
    <div className="input-wrap">
      {Icon && <Icon size={18} />}
      <input id={id} aria-invalid={Boolean(error)} aria-describedby={hint || error ? `${id}-hint` : undefined} {...inputProps} />
      {children}
    </div>
    {(error || hint) && (
      <span id={`${id}-hint`} className={error ? 'field-error' : 'field-hint'}>
        {error || hint}
      </span>
    )}
  </div>
);

/** Password input with a show/hide toggle. */
export const PasswordField = (props) => {
  const [visible, setVisible] = useState(false);

  return (
    <FormField icon={Lock} type={visible ? 'text' : 'password'} {...props}>
      <button
        type="button"
        className="icon-btn"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
      >
        {visible ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </FormField>
  );
};

const STRENGTH_LEVELS = [
  { label: 'Too short', color: 'var(--danger)' },
  { label: 'Weak', color: 'var(--danger)' },
  { label: 'Fair', color: 'var(--warning)' },
  { label: 'Good', color: '#22c55e' },
  { label: 'Strong', color: 'var(--success)' }
];

const scorePassword = (password) => {
  if (password.length < 8) return 0;
  let score = 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password) || password.length >= 14) score++;
  return score;
};

export const PasswordStrength = ({ password }) => {
  if (!password) return null;
  const score = scorePassword(password);
  const { label, color } = STRENGTH_LEVELS[score];

  return (
    <div className="strength" aria-live="polite">
      <div className="strength-bars">
        {[1, 2, 3, 4].map((i) => (
          <span key={i} style={{ background: i <= score ? color : undefined }} />
        ))}
      </div>
      <span className="strength-label" style={{ color }}>
        {label}
      </span>
    </div>
  );
};
