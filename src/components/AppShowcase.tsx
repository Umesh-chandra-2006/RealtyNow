import React, { useState } from "react";

type ActiveTab = "chat" | "verify" | "yield";

export default function AppShowcase() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("chat");

  const renderScreenContent = () => {
    switch (activeTab) {
      case "chat":
        return (
          <div style={styles.screenInner}>
            <div style={styles.screenHeader}>
              <div style={styles.avatarMini}>M</div>
              <div>
                <div style={styles.ownerName}>Meera T. (Owner)</div>
                <div style={styles.statusText}>Active now</div>
              </div>
            </div>
            <div style={styles.chatFeed}>
              <div style={styles.msgBubbleBot}>
                Hello! I saw your 3BHK listing at DLF Phase 5. Is it still available?
              </div>
              <div style={styles.msgBubbleUser}>
                Hi! Yes, it is. I am the direct owner. No broker commission.
              </div>
              <div style={styles.msgBubbleBot}>
                That's awesome! Can we schedule a site visit this Saturday at 11 AM?
              </div>
              <div style={styles.msgBubbleUser}>
                Saturday works perfectly. I'll send you the location pin right away.
              </div>
            </div>
            <div style={styles.chatInputMock}>
              <div style={styles.chatInputPlaceholder}>Message Meera...</div>
              <div style={styles.chatSendIconMock}>⚡</div>
            </div>
          </div>
        );
      case "verify":
        return (
          <div style={styles.screenInner}>
            <div style={styles.verifyBanner}>
              <div style={styles.verifyIcon}>🛡️</div>
              <div>
                <div style={styles.verifyTitle}>RERA Verifier active</div>
                <div style={styles.verifySubtitle}>Government Registry Match</div>
              </div>
            </div>
            <div style={{ ...styles.cardMock, marginTop: "16px" }}>
              <div style={styles.cardImageMock}>
                <div style={styles.verifiedStamp}>100% OWNER VERIFIED</div>
              </div>
              <div style={styles.cardBodyMock}>
                <div style={styles.cardHeaderRow}>
                  <div style={styles.cardTitleMock}>Emaar Luxury Villa</div>
                  <div style={styles.priceTagMock}>₹ 6.4 Cr</div>
                </div>
                <div style={styles.cardLocMock}>Sector 65, Gurgaon</div>
                <div style={styles.reraRow}>
                  <span style={styles.reraBadge}>RERA APPROVED</span>
                  <span style={styles.reraId}>HRERA-2024-9102</span>
                </div>
                <div style={styles.legalCheckList}>
                  <div style={styles.legalItem}>✓ Title deed registration match</div>
                  <div style={styles.legalItem}>✓ No active litigation cases</div>
                  <div style={styles.legalItem}>✓ Geolocation tag verified</div>
                </div>
              </div>
            </div>
          </div>
        );
      case "yield":
        return (
          <div style={styles.screenInner}>
            <div style={styles.screenHeaderSimple}>
              <span style={{ fontSize: "14px", fontWeight: "700" }}>Investment Analytics</span>
            </div>
            <div style={styles.chatFeed}>
              <div style={styles.analyticsCard}>
                <div style={styles.statLabel}>AVERAGE ANNUAL RENTAL YIELD</div>
                <div style={styles.statValue}>6.82%</div>
                <div style={styles.statTrend}>↑ 1.2% this quarter</div>
              </div>
              <div style={styles.analyticsCard}>
                <div style={styles.statLabel}>ESTIMATED 5-YEAR APPRECIATION</div>
                <div style={styles.statValue}>+42.8%</div>
                <div style={styles.statTrend}>Based on local development logs</div>
              </div>
              <div style={{ padding: "0 10px" }}>
                <div style={styles.chartTitle}>Appreciation History</div>
                <div style={styles.barChartMock}>
                  <div style={styles.chartBarRow}>
                    <span style={styles.barLabel}>2024</span>
                    <div style={{ ...styles.barFill, width: "60%" }}></div>
                    <span style={styles.barVal}>+8.4%</span>
                  </div>
                  <div style={styles.chartBarRow}>
                    <span style={styles.barLabel}>2025</span>
                    <div style={{ ...styles.barFill, width: "80%" }}></div>
                    <span style={styles.barVal}>+12.1%</span>
                  </div>
                  <div style={styles.chartBarRow}>
                    <span style={styles.barLabel}>2026</span>
                    <div
                      style={{ ...styles.barFill, width: "100%", background: "var(--primary)" }}
                    ></div>
                    <span style={styles.barVal}>+15.3%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <section className="showcase-section reveal-scroll">
      <div className="container-page showcase-grid">
        <div className="showcase__text-content">
          <span className="showcase__tagline">The Mobile Application</span>
          <h2 className="showcase__title font-display">RealtyNow in your pocket</h2>
          <p className="showcase__desc">
            Experience India's most secure and direct property portal on the move. Built with
            lightning-fast real-time search, instant owner chat links, and legal document
            verification checks.
          </p>

          <div className="showcase__features">
            <div className="showcase-feat">
              <div className="showcase-feat__icon">💬</div>
              <div className="showcase-feat__text">
                <h4>Direct Owner Communication</h4>
                <p>
                  Chat directly with landlords and sellers. Absolutely zero broker intermediaries or
                  spam calls.
                </p>
              </div>
            </div>
            <div className="showcase-feat">
              <div className="showcase-feat__icon">🛡️</div>
              <div className="showcase-feat__text">
                <h4>Real-Time RERA Database Check</h4>
                <p>
                  Instantly fetch and check RERA registration ID validation status before you submit
                  queries.
                </p>
              </div>
            </div>
            <div className="showcase-feat">
              <div className="showcase-feat__icon">📈</div>
              <div className="showcase-feat__text">
                <h4>ROI & Appreciation Yield Logs</h4>
                <p>
                  Analyze verified historical appreciation indices and rental yield scores for all
                  major micro-markets.
                </p>
              </div>
            </div>
          </div>

          <div className="showcase-tabs">
            <button
              onClick={() => setActiveTab("chat")}
              className={`showcase-tab ${activeTab === "chat" ? "active" : ""}`}
            >
              Direct Chat
            </button>
            <button
              onClick={() => setActiveTab("verify")}
              className={`showcase-tab ${activeTab === "verify" ? "active" : ""}`}
            >
              RERA Verify
            </button>
            <button
              onClick={() => setActiveTab("yield")}
              className={`showcase-tab ${activeTab === "yield" ? "active" : ""}`}
            >
              Yield Trends
            </button>
          </div>
        </div>

        <div className="mockup-container">
          <div className="phone-frame">
            <div className="phone-screen">
              <div className="phone-header">
                <span>9:41 AM</span>
                <div style={styles.statusBarIcons}>
                  <span>📶</span> <span>🔋</span>
                </div>
              </div>
              <div className="phone-notch">
                <div className="phone-notch-camera"></div>
              </div>
              <div className="phone-content">{renderScreenContent()}</div>
              <div className="phone-footer">
                <div className="phone-home-indicator"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  statusBarIcons: {
    display: "flex",
    gap: "4px",
  },
  screenInner: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    backgroundColor: "#F8FAFC",
  },
  screenHeader: {
    backgroundColor: "#0A1128",
    color: "#FFFFFF",
    padding: "16px 16px 12px",
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  screenHeaderSimple: {
    backgroundColor: "#0A1128",
    color: "#FFFFFF",
    padding: "16px",
    textAlign: "center",
  },
  avatarMini: {
    width: "28px",
    height: "28px",
    borderRadius: "50%",
    backgroundColor: "var(--primary)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "bold",
    fontSize: "12px",
    color: "#FFFFFF",
  },
  ownerName: {
    fontSize: "12.5px",
    fontWeight: "600",
  },
  statusText: {
    fontSize: "10px",
    color: "#4ADE80",
  },
  chatFeed: {
    flex: 1,
    padding: "12px",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  msgBubbleBot: {
    backgroundColor: "#FFFFFF",
    color: "#1E293B",
    padding: "8px 12px",
    borderRadius: "12px",
    borderBottomLeftRadius: "2px",
    fontSize: "11px",
    maxWidth: "85%",
    alignSelf: "flex-start",
    boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
  },
  msgBubbleUser: {
    backgroundColor: "var(--primary)",
    color: "#FFFFFF",
    padding: "8px 12px",
    borderRadius: "12px",
    borderBottomRightRadius: "2px",
    fontSize: "11px",
    maxWidth: "85%",
    alignSelf: "flex-end",
  },
  chatInputMock: {
    padding: "10px 12px",
    backgroundColor: "#FFFFFF",
    borderTop: "1px solid #E2E8F0",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  chatInputPlaceholder: {
    color: "#94A3B8",
    fontSize: "11.5px",
  },
  chatSendIconMock: {
    color: "var(--primary)",
    fontWeight: "bold",
    fontSize: "12px",
  },
  verifyBanner: {
    backgroundColor: "#DCFCE7",
    borderBottom: "1px solid #BBF7D0",
    padding: "12px",
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  verifyIcon: {
    fontSize: "20px",
  },
  verifyTitle: {
    color: "#166534",
    fontSize: "12px",
    fontWeight: "700",
  },
  verifySubtitle: {
    color: "#15803D",
    fontSize: "10px",
  },
  cardMock: {
    backgroundColor: "#FFFFFF",
    borderRadius: "12px",
    overflow: "hidden",
    margin: "0 12px",
    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
  },
  cardImageMock: {
    height: "90px",
    background: "linear-gradient(to right, #1E293B, #0F172A)",
    position: "relative",
  },
  verifiedStamp: {
    position: "absolute",
    top: "10px",
    left: "10px",
    backgroundColor: "#22C55E",
    color: "#FFFFFF",
    fontSize: "8px",
    fontWeight: "bold",
    padding: "3px 6px",
    borderRadius: "4px",
  },
  cardBodyMock: {
    padding: "12px",
  },
  cardHeaderRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "4px",
  },
  cardTitleMock: {
    fontSize: "12px",
    fontWeight: "700",
    color: "#0F172A",
  },
  priceTagMock: {
    fontSize: "12px",
    fontWeight: "800",
    color: "var(--primary)",
  },
  cardLocMock: {
    fontSize: "10px",
    color: "#64748B",
    marginBottom: "8px",
  },
  reraRow: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    marginBottom: "8px",
  },
  reraBadge: {
    backgroundColor: "#FEE2E2",
    color: "#EF4444",
    fontSize: "8px",
    fontWeight: "bold",
    padding: "2px 4px",
    borderRadius: "2px",
  },
  reraId: {
    fontSize: "8.5px",
    color: "#64748B",
    fontWeight: "600",
  },
  legalCheckList: {
    borderTop: "1px solid #F1F5F9",
    paddingTop: "8px",
    display: "flex",
    flexDirection: "column",
    gap: "3px",
  },
  legalItem: {
    fontSize: "9px",
    color: "#15803D",
    fontWeight: "500",
  },
  analyticsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: "12px",
    padding: "12px",
    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.02)",
    border: "1px solid #E2E8F0",
    marginBottom: "8px",
  },
  statLabel: {
    fontSize: "8px",
    color: "#64748B",
    fontWeight: "700",
    letterSpacing: "0.05em",
    marginBottom: "4px",
  },
  statValue: {
    fontSize: "18px",
    fontWeight: "800",
    color: "#0F172A",
  },
  statTrend: {
    fontSize: "9px",
    color: "#22C55E",
    fontWeight: "600",
  },
  chartTitle: {
    fontSize: "10px",
    fontWeight: "700",
    color: "#475569",
    marginBottom: "8px",
  },
  barChartMock: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  chartBarRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  barLabel: {
    fontSize: "9px",
    color: "#64748B",
    width: "24px",
  },
  barFill: {
    height: "8px",
    borderRadius: "4px",
    backgroundColor: "#CBD5E1",
  },
  barVal: {
    fontSize: "9px",
    fontWeight: "600",
    color: "#334155",
  },
};
