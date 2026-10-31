import { lazy, Suspense } from 'react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute, PublicOnlyRoute } from './components/routing/ProtectedRoute';
import { FullPageLoader } from './components/ui/FullPageLoader';

// Route-level code splitting: the auth pages don't download the chat bundle (markdown, speech) and vice versa
const LoginPage = lazy(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })));
const SignupPage = lazy(() => import('./pages/SignupPage').then((m) => ({ default: m.SignupPage })));
const ChatPage = lazy(() => import('./pages/ChatPage').then((m) => ({ default: m.ChatPage })));

const NotFound = () => (
  <div className="not-found">
    <h1>404</h1>
    <p>This page doesn&apos;t exist.</p>
    <Link to="/chat" className="btn btn-primary">
      Back to chat
    </Link>
  </div>
);

export const App = () => (
  <Suspense fallback={<FullPageLoader />}>
    <Routes>
      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/chat/:conversationId" element={<ChatPage />} />
      </Route>

      <Route path="/" element={<Navigate to="/chat" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  </Suspense>
);

export default App;
