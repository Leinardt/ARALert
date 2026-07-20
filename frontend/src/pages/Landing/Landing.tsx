import React from 'react';
import { Link } from 'react-router-dom';

const containerStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: 'linear-gradient(180deg, #eef7f1 0%, #f8fafc 60%, #ffffff 100%)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  padding: '40px 24px',
};

const panelStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '1080px',
  borderRadius: '32px',
  background: 'rgba(255,255,255,0.96)',
  boxShadow: '0 32px 90px rgba(15, 23, 42, 0.12)',
  border: '1px solid rgba(148, 163, 184, 0.18)',
  overflow: 'hidden',
};

const heroStyle: React.CSSProperties = {
  padding: '56px 48px 24px',
};

const badgeStyle: React.CSSProperties = {
  display: 'inline-flex',
  background: '#e7f0ff',
  color: '#0b5ed7',
  borderRadius: '999px',
  padding: '10px 18px',
  fontSize: '12px',
  letterSpacing: '0.18em',
  fontWeight: 700,
};

const titleStyle: React.CSSProperties = {
  marginTop: '32px',
  fontSize: '3.2rem',
  lineHeight: 1.05,
  color: '#0f172a',
  maxWidth: '750px',
};

const descriptionStyle: React.CSSProperties = {
  marginTop: '24px',
  color: '#475569',
  fontSize: '1.05rem',
  lineHeight: 1.8,
  maxWidth: '680px',
};

const buttonPrimaryStyle: React.CSSProperties = {
  borderRadius: '999px',
  background: '#0b5ed7',
  color: '#ffffff',
  padding: '16px 32px',
  fontWeight: 700,
  border: 'none',
  cursor: 'pointer',
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: '0 20px 40px rgba(11, 94, 215, 0.12)',
};

const buttonSecondaryStyle: React.CSSProperties = {
  borderRadius: '999px',
  background: '#ffffff',
  color: '#0f172a',
  padding: '16px 32px',
  fontWeight: 700,
  border: '1px solid rgba(148, 163, 184, 0.3)',
  cursor: 'pointer',
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const cardGridStyle: React.CSSProperties = {
  display: 'grid',
  gap: '20px',
  padding: '24px 48px 48px',
  background: '#f8fafc',
};

const cardStyle: React.CSSProperties = {
  borderRadius: '24px',
  background: '#ffffff',
  border: '1px solid rgba(148, 163, 184, 0.18)',
  boxShadow: '0 12px 30px rgba(15, 23, 42, 0.06)',
  padding: '32px',
};

const cardTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '1.125rem',
  fontWeight: 700,
  color: '#0f172a',
};

const cardTextStyle: React.CSSProperties = {
  marginTop: '14px',
  color: '#475569',
  fontSize: '1rem',
  lineHeight: 1.75,
};

const features = [
  {
    title: 'Student performance monitoring',
    description: 'Continuous collection of grades, assessments, and attendance to compute per-student performance indicators and trends.',
  },
  {
    title: 'Early academic risk detection',
    description: 'Automated algorithms identify at-risk students using attendance and performance signals so teachers can intervene early.',
  },
  {
    title: 'Data-driven interventions',
    description: 'Actionable reports and timelines empower tutors and administrators to target support and measure outcomes over time.',
  },
];

export const Landing: React.FC = () => (
  <div style={containerStyle}>
    <div style={panelStyle}>
      <div style={heroStyle}>
        <span style={badgeStyle}>Student Risk Monitoring</span>

        <h1 style={titleStyle}>
          A Web-Based Student Performance Monitoring and Early Academic Risk Detection System for the ARAL Program of Palanas National Agriculture High School
        </h1>

        <p style={descriptionStyle}>
          ARALert is designed to support the Academic Recovery and Accessible Learning (ARAL) program by consolidating attendance, assessment, and course performance data into a unified monitoring platform. The system computes student-level performance indicators, surfaces early warning signs, and equips tutors and administrators with timely, actionable insights for interventions.
        </p>

        <p style={descriptionStyle}>
          Key capabilities include continuous student performance tracking, robust attendance logging, automated risk detection, and reporting tools that drive data-informed decisions and targeted academic support.
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginTop: '32px' }}>
          <Link to="/login" style={buttonPrimaryStyle}>
            Sign in
          </Link>
          <a href="#features" style={buttonSecondaryStyle}>
            Explore features
          </a>
        </div>
      </div>

      <div style={cardGridStyle}>
        {features.map((feature) => (
          <div key={feature.title} style={cardStyle}>
            <h2 style={cardTitleStyle}>{feature.title}</h2>
            <p style={cardTextStyle}>{feature.description}</p>
          </div>
        ))}
      </div>
    </div>
  </div>
);
