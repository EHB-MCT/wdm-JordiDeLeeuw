export function UserDashboardNav({ email, onLogout }) {
	return (
		<div className="admin-nav">
			{/* Navigatiebalk voor gebruiker */}
			<div className="admin-nav-left">
				<h1>CUYS - clean up your screenshots!</h1>
			</div>

			<div className="admin-nav-middle">
				<div className="user-email">{email || "unknown"}</div>
			</div>

			<div className="admin-nav-right">
				{/* Uitloggen */}
				<button className="logout-btn" onClick={onLogout}>
					Logout
				</button>
			</div>
		</div>
	);
}
