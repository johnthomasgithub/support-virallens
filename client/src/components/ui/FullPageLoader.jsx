import { Logo } from './Logo';

export const FullPageLoader = () => (
  <div className="app-loading" role="status">
    <Logo size={44} showText={false} />
    <div className="spinner" />
    <span>Restoring your session…</span>
  </div>
);
