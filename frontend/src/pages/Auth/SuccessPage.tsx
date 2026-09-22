import React from 'react';
import { Link } from 'react-router-dom';

export const SuccessPage: React.FC = () => (
  <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f7f5', padding: '24px' }}>
    <div style={{ width: '100%', maxWidth: '460px', background: '#fff', borderRadius: '20px', padding: '32px', boxShadow: '0 4px 24px rgba(0,0,0,0.06)', textAlign: 'center' }}>
      <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>Success</h2>
      <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '24px' }}>Your account is ready. You can now sign in and continue to your dashboard.</p>
      <Link to="/login" style={{ display: 'inline-block', padding: '12px 16px', borderRadius: '12px', background: '#2E7D32', color: '#fff', textDecoration: 'none', fontWeight: 600 }}>Go to login</Link>
    </div>
  </div>
);
