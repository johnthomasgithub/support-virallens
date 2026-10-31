import { Sparkles } from 'lucide-react';

export const Logo = ({ size = 34, showText = true }) => (
  <span className="logo">
    <span className="logo-mark" style={{ width: size, height: size }} aria-hidden="true">
      <Sparkles size={size * 0.52} strokeWidth={2.2} />
    </span>
    {showText && (
      <span className="logo-text">
        Lumi <span>Support</span>
      </span>
    )}
  </span>
);
