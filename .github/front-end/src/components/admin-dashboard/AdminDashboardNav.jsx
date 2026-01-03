export function AdminDashboardNav({ email, modeLabel, useLiveMode, onSetLiveMode, onLogout }) {
	return (
		<div className="admin-nav">
			<div className="admin-nav-left">
				<h1>Admin Dashboard</h1>
				<span className={`pill ${modeLabel.toLowerCase()}`}>{modeLabel}</span>
			</div>
			<div className="admin-nav-middle">
				<div className="user-email">{email || "unknown"}</div>
			</div>
			<div className="admin-nav-right">
				<div className="data-mode-toggle">
					<button className={`mode-toggle ${!useLiveMode ? "active" : ""}`} onClick={() => onSetLiveMode(false)} title="Demo data">
						Demo
					</button>
					<button className={`mode-toggle ${useLiveMode ? "active" : ""}`} onClick={() => onSetLiveMode(true)} title="Live data">
						Live
					</button>
				</div>
				<button className="logout-btn" onClick={onLogout}>
					Logout
				</button>
			</div>
		</div>
	);
}
