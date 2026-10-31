import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { ArrowRight, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../api/client';
import { AuthLayout } from '../components/auth/AuthLayout';
import { FormField, PasswordField } from '../components/auth/FormField';
import { Alert } from '../components/ui/Alert';

export const LoginPage = () => {
  const { login } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(form.email.trim(), form.password);
      // PublicOnlyRoute redirects once the user is set
    } catch (err) {
      setError(getErrorMessage(err, 'Login failed. Please check your credentials.'));
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to continue your support conversations."
      footer={
        <>
          Don&apos;t have an account? <Link to="/signup">Create one</Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="auth-form" noValidate>
        <AnimatePresence>{error && <Alert message={error} onDismiss={() => setError(null)} />}</AnimatePresence>

        <FormField
          id="login-email"
          label="Email"
          icon={Mail}
          type="email"
          value={form.email}
          onChange={update('email')}
          placeholder="you@example.com"
          autoComplete="email"
          autoFocus
          required
        />

        <PasswordField
          id="login-password"
          label="Password"
          value={form.password}
          onChange={update('password')}
          placeholder="Enter your password"
          autoComplete="current-password"
          required
        />

        <button
          type="submit"
          className="btn btn-primary auth-submit"
          disabled={submitting || !form.email.trim() || !form.password}
        >
          {submitting ? <span className="spinner sm" /> : <>Log in <ArrowRight size={18} /></>}
        </button>
      </form>
    </AuthLayout>
  );
};
