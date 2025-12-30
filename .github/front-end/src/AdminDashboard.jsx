import { useState, useEffect } from "react";
import { useAuth } from "./AuthContext";
import "./Dashboard.css";

const API_BASE = "";

// Demo data - will be replaced by real backend data
const demoData = {
	sensitiveDataTypes: {
		fullNames: 45,
		locations: 23,
		datesTimes: 67,
		financial: 12,
		documents: 8,
		contactInfo: 34
	}
};

export function AdminDashboard() {
	const { user } = useAuth();
	const [stats, setStats] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [isVerifiedAdmin, setIsVerifiedAdmin] = useState(false);
	const [useLiveMode, setUseLiveMode] = useState(false);

	useEffect(() => {
		if (user) {
			console.log("AdminDashboard: Verifying admin for user:", user);
			verifyAdminAndFetchStats();
		}
	}, [user]);

	const verifyAdminAndFetchStats = async () => {
		if (useLiveMode) {
			// Live mode - fetch real admin stats from backend
			try {
				console.log("AdminDashboard: Step 1 - Verifying admin status via /api/me");
				const meRes = await fetch(`${API_BASE}/api/me`, {
					headers: {
						"X-User-Id": user.userId,
					},
				});

				console.log("AdminDashboard: /api/me response status:", meRes.status);

				if (!meRes.ok) {
					const errorData = await meRes.json();
					console.log("AdminDashboard: /api/me failed:", errorData);
					setError(`Admin verification failed: ${errorData.error}`);
					setLoading(false);
					return;
				}

				const meData = await meRes.json();
				console.log("AdminDashboard: /api/me response data:", meData);

				if (meData.isAdmin !== true) {
					console.log("AdminDashboard: User is not admin, data:", meData);
					setError("Access denied: admin privileges required");
					setLoading(false);
					return;
				}

				console.log("AdminDashboard: Admin verified, fetching stats");
				setIsVerifiedAdmin(true);

				// Step 2: Fetch admin stats
				console.log("AdminDashboard: Step 2 - Fetching admin stats");
				const statsRes = await fetch(`${API_BASE}/api/admin/stats`, {
					headers: {
						"X-User-Id": user.userId,
					},
				});

				console.log("AdminDashboard: /api/admin/stats response status:", statsRes.status);

				if (statsRes.ok) {
					const statsData = await statsRes.json();
					console.log("AdminDashboard: Admin stats loaded:", statsData);
					setStats(statsData);
					setError(null);
				} else {
					const statsErrorData = await statsRes.json();
					console.log("AdminDashboard: Admin stats failed:", statsErrorData);
					setError(statsErrorData.error || "Failed to fetch admin statistics");
				}
			} catch (error) {
				console.error("AdminDashboard: Error in verification/fetch:", error);
				setError("Network error - could not reach server");
			} finally {
				setLoading(false);
			}
		} else {
			// Demo mode - use fake data
			console.log("AdminDashboard: Using demo mode data");
			setIsVerifiedAdmin(true);
			setStats(demoData);
			setError(null);
			setLoading(false);
		}
	};

	return (
		<div className="dashboard">
			<div className="dashboard-header">
				<div className="dashboard-header-content">
					<h1>Admin Dashboard</h1>
					<div className="profile-email">{user?.email}</div>
					<div className="data-mode-toggle">
						<button 
							className={`mode-toggle ${useLiveMode ? 'active' : ''}`}
							onClick={() => setUseLiveMode(false)}
							title="Demo data - will be replaced by live stats"
						>
								Demo
						</button>
						<button 
							className={`mode-toggle ${!useLiveMode ? 'active' : ''}`}
							onClick={() => setUseLiveMode(true)}
							title="Live data from backend"
							disabled
						>
							Live
						</button>
					</div>
				</div>
			</div>

			<div className="charts-grid">
				{/* Chart 1: Types of Sensitive Data Detected */}
				<div className="chart-card">
					<h2>Types of Sensitive Data Detected</h2>
					<div className="chart-subtitle">User uploads containing personal information</div>
					<div className="chart-container">
						<div className="chart-legend">
							<div className="legend-item">
								<div className="legend-color full-names"></div>
									<span>Full Names</span>
							</div>
							<div className="legend-item">
								<div className="legend-color locations"></div>
									<span>Location References</span>
							</div>
							<div className="legend-item">
								<div className="legend-color dates-times"></div>
									<span>Dates/Times</span>
							</div>
							<div className="legend-item">
								<div className="legend-color financial"></div>
									<span>Financial Info</span>
							</div>
							<div className="legend-item">
								<div className="legend-color documents"></div>
									<span>Official Documents</span>
							</div>
							<div className="legend-item">
								<div className="legend-color contact"></div>
									<span>Contact Info</span>
							</div>
						</div>
						<div className="bar-chart">
							{Object.entries(demoData.sensitiveDataTypes).map(([type, count]) => (
								<div key={type} className="bar-item">
									<div className="bar-label">{type.replace(/([A-Z])/g, ' $1')}</div>
									<div className="bar-outer">
										<div 
											className="bar-fill" 
											style={{width: `${(count / demoData.sensitiveDataTypes.contactInfo) * 100}%`}}
										></div>
										<div className="bar-value">{count}</div>
									</div>
								</div>
							))}
						</div>
					</div>
					<div className="chart-note">Demo data — will be replaced by live admin statistics</div>
				</div>
			</div>
		</div>
	);
}