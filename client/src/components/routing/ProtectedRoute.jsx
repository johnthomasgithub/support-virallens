import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { FullPageLoader } from '../ui/FullPageLoader';

/** Renders child routes only for authenticated users; otherwise redirects to /login. */
export const ProtectedRoute = () => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
};

/** Login/signup: logged-in users are sent where they were going (or /chat). */
export const PublicOnlyRoute = () => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageLoader />;
  if (user) return <Navigate to={location.state?.from?.pathname || '/chat'} replace />;
  return <Outlet />;
};
