import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

interface Tab {
  label: string;
  path: string;
  icon: string;
  activeColor: string;
  glowColor: string;
  bgGradient: string;
}

const TABS: Tab[] = [
  { 
    label: 'New Batch', 
    path: '/batch/create', 
    icon: 'add_circle', 
    activeColor: '#10b981', // Emerald/Green
    glowColor: 'rgba(16, 185, 129, 0.4)',
    bgGradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
  },
  { 
    label: 'All Batches', 
    path: '/all-batches', 
    icon: 'list_alt', 
    activeColor: '#6366f1', // Indigo
    glowColor: 'rgba(99, 102, 241, 0.4)',
    bgGradient: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)'
  },
  { 
    label: 'Scan Queue', 
    path: '/scan', 
    icon: 'document_scanner', 
    activeColor: '#06b6d4', // Cyan/Teal
    glowColor: 'rgba(6, 182, 212, 0.4)',
    bgGradient: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)'
  },
  { 
    label: 'RR Queue', 
    path: '/rr', 
    icon: 'build', 
    activeColor: '#f43f5e', // Rose/Red
    glowColor: 'rgba(244, 63, 94, 0.4)',
    bgGradient: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)'
  },
];

export function QueueTabs() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center',
      gap: 10, 
      padding: '4px 8px 20px 8px', 
      overflowX: 'auto', 
      scrollbarWidth: 'none',
      msOverflowStyle: 'none',
    }}>
      <style>{`
        @keyframes tab-bounce {
          0%, 100% { transform: translateY(-1px); }
          50% { transform: translateY(-4px); }
        }
        @keyframes active-pulse {
          0% { box-shadow: 0 4px 12px var(--pulse-color); }
          50% { box-shadow: 0 4px 20px var(--pulse-color-vibrant); }
          100% { box-shadow: 0 4px 12px var(--pulse-color); }
        }
        .queue-tab-btn:hover:not(.active) {
          animation: tab-bounce 0.4s cubic-bezier(0.36, 0, 0.66, -0.56) alternate;
        }
        .queue-tab-btn.active {
          animation: active-pulse 2s infinite ease-in-out;
        }
      `}</style>

      {TABS.map((tab) => {
        const isActive = location.pathname === tab.path;
        return (
          <button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            className={`queue-tab-btn ${isActive ? 'active' : ''}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              borderRadius: '12px',
              border: isActive ? `1px solid ${tab.activeColor}` : '1px solid var(--border-subtle)',
              background: isActive ? tab.bgGradient : 'rgba(255, 255, 255, 0.03)',
              color: isActive ? '#fff' : 'var(--fg-muted)',
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.02em',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              backdropFilter: isActive ? 'none' : 'blur(8px)',
              flexShrink: 0,
              transform: isActive ? 'translateY(-1px)' : 'none',
              // Use CSS variables for the pulse animation
              ['--pulse-color' as any]: tab.glowColor,
              ['--pulse-color-vibrant' as any]: tab.glowColor.replace('0.4', '0.6'),
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.borderColor = tab.activeColor;
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.07)';
                e.currentTarget.style.color = 'var(--fg)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.borderColor = 'var(--border-subtle)';
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                e.currentTarget.style.color = 'var(--fg-muted)';
                e.currentTarget.style.transform = 'none';
              }
            }}
          >
            <span className="material-symbols-outlined" style={{ 
              fontSize: 18,
              color: isActive ? '#fff' : tab.activeColor,
              fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0",
              transition: 'all 0.3s ease',
            }}>
              {tab.icon}
            </span>
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
