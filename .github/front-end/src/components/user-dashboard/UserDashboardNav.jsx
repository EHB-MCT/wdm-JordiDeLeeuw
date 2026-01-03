export function UserDashboardNav({ email, onLogout }) {
	return (
		<div className="admin-nav">
			<div className="admin-nav-left">
				<h1>User Dashboard</h1>
			</div>

			<div className="admin-nav-middle">
				<div className="user-email">{email || "unknown"}</div>
			</div>

			<div className="admin-nav-right">
				<button className="logout-btn" onClick={onLogout}>
					Logout
				</button>
			</div>
		</div>
	);
}
