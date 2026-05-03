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
    activeColor: '#d97757',
    glowColor: 'rgba(217, 119, 87, 0.4)',
    bgGradient: 'linear-gradient(135deg, #d97757 0%, #a35238 100%)'
  },
  { 
    label: 'All Batches', 
    path: '/all-batches', 
    icon: 'list_alt', 
    activeColor: '#d97757',
    glowColor: 'rgba(217, 119, 87, 0.4)',
    bgGradient: 'linear-gradient(135deg, #d97757 0%, #a35238 100%)'
  },
  { 
    label: 'Scan Queue', 
    path: '/scan', 
    icon: 'document_scanner', 
    activeColor: '#d97757',
    glowColor: 'rgba(217, 119, 87, 0.4)',
    bgGradient: 'linear-gradient(135deg, #d97757 0%, #a35238 100%)'
  },
  { 
    label: 'RR Queue', 
    path: '/rr', 
    icon: 'build', 
    activeColor: '#d97757',
    glowColor: 'rgba(217, 119, 87, 0.4)',
    bgGradient: 'linear-gradient(135deg, #d97757 0%, #a35238 100%)'
  },
];

export function QueueTabs() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <>
      <style>{`
        .queue-tabs-container {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          background: var(--bg-raised);
          border: 1px solid var(--border);
          border-radius: var(--r-lg);
          margin-bottom: 16px;
          box-shadow: var(--shadow-xs);
          overflow-x: auto;
          scrollbar-width: none;
          ms-overflow-style: none;
        }
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

        @media (max-width: 640px) {
          .queue-tabs-container {
            position: fixed !important;
            bottom: 0 !important;
            left: 0 !important;
            right: 0 !important;
            z-index: 40 !important;
            background: var(--bg-raised) !important;
            border: none !important;
            border-top: 1px solid var(--border) !important;
            border-radius: 0 !important;
            margin: 0 !important;
            padding: 8px 4px 14px 4px !important;
            justify-content: space-around !important;
            gap: 2px !important;
            box-shadow: 0 -4px 16px rgba(0,0,0,0.15) !important;
            height: auto !important;
            backdrop-filter: blur(12px);
          }
          .queue-tab-btn {
            flex-direction: column !important;
            gap: 4px !important;
            padding: 6px 2px !important;
            flex: 1 !important;
            min-width: 0 !important;
            background: transparent !important;
            border: none !important;
            box-shadow: none !important;
            animation: none !important;
            color: var(--fg-subtle) !important;
          }
          .queue-tab-btn.active {
            color: var(--tab-color) !important;
            transform: none !important;
          }
          .queue-tab-btn.active .tab-icon {
            color: var(--tab-color) !important;
            font-variation-settings: 'FILL' 1 !important;
          }
          .queue-tab-btn .tab-icon {
            font-size: 24px !important;
          }
          .queue-tab-btn .tab-label {
            font-size: 9px !important;
            font-weight: 600 !important;
            text-transform: uppercase;
            letter-spacing: 0.02em;
          }
        }
      `}</style>

      <div className="queue-tabs-container">
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
                ['--tab-color' as any]: tab.activeColor,
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
              <span className="material-symbols-outlined tab-icon" style={{ 
                fontSize: 18,
                color: isActive ? '#fff' : tab.activeColor,
                fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0",
                transition: 'all 0.3s ease',
              }}>
                {tab.icon}
              </span>
              <span className="tab-label">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}
