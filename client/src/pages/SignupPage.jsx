import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { ArrowRight, Mail, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../api/client';
import { AuthLayout } from '../components/auth/AuthLayout';
import { FormField, PasswordField, PasswordStrength } from '../components/auth/FormField';
import { Alert } from '../components/ui/Alert';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validate = ({ email, password, confirmPassword }) => {
  const errors = {};
  if (!EMAIL_PATTERN.test(email.trim())) errors.email = 'Please enter a valid email address.';
  if (password.length < 8) errors.password = 'Password must be at least 8 characters.';
  else if (password.length > 128) errors.password = 'Password cannot exceed 128 characters.';
  if (confirmPassword !== password) errors.confirmPassword = 'Passwords do not match.';
  return errors;
};

export const SignupPage = () => {
  const { signup } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [touched, setTouched] = useState({});
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const fieldErrors = validate(form);
  const showError = (field) => (touched[field] ? fieldErrors[field] : undefined);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  const touch = (field) => () => setTouched((t) => ({ ...t, [field]: true }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setTouched({ email: true, password: true, confirmPassword: true });
    if (Object.keys(fieldErrors).length > 0) return;

    setSubmitting(true);
    try {
      await signup({ name: form.name.trim(), email: form.email.trim(), password: form.password });
    } catch (err) {
      setError(getErrorMessage(err, 'Registration failed. Please try again.'));
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Get instant answers from our AI support assistant."
      footer={
        <>
          Already have an account? <Link to="/login">Log in</Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="auth-form" noValidate>
        <AnimatePresence>{error && <Alert message={error} onDismiss={() => setError(null)} />}</AnimatePresence>

        <FormField
          id="signup-name"
          label="Name"
          optional
          icon={User}
          value={form.name}
          onChange={update('name')}
          placeholder="Jane Doe"
          autoComplete="name"
          maxLength={60}
          autoFocus
        />

        <FormField
          id="signup-email"
          label="Email"
          icon={Mail}
          type="email"
          value={form.email}
          onChange={update('email')}
          onBlur={touch('email')}
          error={showError('email')}
          placeholder="you@example.com"
          autoComplete="email"
          required
        />

        <PasswordField
          id="signup-password"
          label="Password"
          value={form.password}
          onChange={update('password')}
          onBlur={touch('password')}
          error={showError('password')}
          hint={!showError('password') && !form.password ? 'At least 8 characters.' : undefined}
          placeholder="Create a password"
          autoComplete="new-password"
          required
        />
        <PasswordStrength password={form.password} />

        <PasswordField
          id="signup-confirm-password"
          label="Confirm password"
          value={form.confirmPassword}
          onChange={update('confirmPassword')}
          onBlur={touch('confirmPassword')}
          error={showError('confirmPassword')}
          placeholder="Repeat your password"
          autoComplete="new-password"
          required
        />

        <button type="submit" className="btn btn-primary auth-submit" disabled={submitting}>
          {submitting ? <span className="spinner sm" /> : <>Create account <ArrowRight size={18} /></>}
        </button>
      </form>
    </AuthLayout>
  );
};
