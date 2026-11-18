import React from 'react';
import { createPortal } from 'react-dom';

/**
 * Renders modal overlays directly under document.body so CSS transforms or
 * scroll containers inside <main> never trap fixed positioning or allow
 * surrounding sidebar/header controls to remain clickable.
 */
export const ModalPortal: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  if (typeof document === 'undefined') {
    return <>{children}</>;
  }
  return createPortal(children, document.body);
};
