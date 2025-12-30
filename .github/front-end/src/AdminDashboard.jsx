import { useState, useEffect } from "react";
import { useAuth } from "./AuthContext";
import "./Dashboard.css";

const API_BASE = "";

export function AdminDashboard() {
	const { user } = useAuth();
	const [stats, setStats] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [isVerifiedAdmin, setIsVerifiedAdmin] = useState(false);

	useEffect(() => {
		if (user) {
			console.log("AdminDashboard: Verifying admin for user:", user);
			verifyAdminAndFetchStats();
		}
	}, [user]);

	const verifyAdminAndFetchStats = async () => {
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
				setError(statsErrorData.error || "Failed to fetch admin stats");
			}
		} catch (error) {
			console.error("AdminDashboard: Error in verification/fetch:", error);
			setError("Network error - could not reach server");
		} finally {
			setLoading(false);
		}
	};

	const handleRetry = () => {
		setLoading(true);
		setError(null);
		verifyAdminAndFetchStats();
	};

	if (loading) {
		return (
			<div className="dashboard">
				<div className="dashboard-header">
					<h1>Admin Dashboard</h1>
				</div>
				<div className="loading-photos">Loading admin statistics...</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="dashboard">
				<div className="dashboard-header">
					<h1>Admin Dashboard</h1>
				</div>
				<div className="response-box error">
					<h3>Error</h3>
					<p>{error}</p>
					<button className="auth-submit" onClick={handleRetry}>
						Try Again
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="dashboard">
			<div className="dashboard-header">
				<h1>Admin Dashboard</h1>
				<div className="profile-email">{user?.email} (Admin)</div>
			</div>

			<div className="admin-stats">
				<h2>System Overview</h2>
				<div className="stats-grid">
					<div className="stat-card">
						<h3>Total Users</h3>
						<div className="stat-value">{stats.totalUsers || 0}</div>
					</div>
					<div className="stat-card">
						<h3>Admin Users</h3>
						<div className="stat-value">{stats.adminUsers || 0}</div>
					</div>
					<div className="stat-card">
						<h3>New Users (7 days)</h3>
						<div className="stat-value">{stats.newUsersLast7Days || 0}</div>
					</div>
					<div className="stat-card">
						<h3>Total Photos</h3>
						<div className="stat-value">{stats.totalPhotos || 0}</div>
					</div>
					<div className="stat-card">
						<h3>Photos (7 days)</h3>
						<div className="stat-value">{stats.photosLast7Days || 0}</div>
					</div>
					<div className="stat-card">
						<h3>Avg Photos/User</h3>
						<div className="stat-value">{stats.avgPhotosPerUser || 0}</div>
					</div>
				</div>

				<div className="stats-section">
					<h3>OCR Pipeline</h3>
					<div className="stats-grid">
						<div className="stat-card">
							<h4>OCR Completed</h4>
							<div className="stat-value">{stats.ocrDone || 0}</div>
						</div>
						<div className="stat-card">
							<h4>OCR Processing</h4>
							<div className="stat-value">{stats.ocrProcessing || 0}</div>
						</div>
						<div className="stat-card">
							<h4>OCR Errors</h4>
							<div className="stat-value">{stats.ocrError || 0}</div>
						</div>
						<div className="stat-card">
							<h4>OCR Success Rate</h4>
							<div className="stat-value">{((stats.ocrSuccessRate || 0) * 100).toFixed(1)}%</div>
						</div>
						<div className="stat-card">
							<h4>Avg Text Length</h4>
							<div className="stat-value">{Math.round(stats.avgTextLength || 0)}</div>
						</div>
						<div className="stat-card">
							<h4>Avg Line Count</h4>
							<div className="stat-value">{Math.round(stats.avgLineCount || 0)}</div>
						</div>
					</div>
				</div>

				<div className="stats-section">
					<h3>LLM Pipeline</h3>
					<div className="stats-grid">
						<div className="stat-card">
							<h4>Analysis Completed</h4>
							<div className="stat-value">{stats.analysisDone || 0}</div>
						</div>
						<div className="stat-card">
							<h4>Analysis Fallback</h4>
							<div className="stat-value">{stats.analysisFallback || 0}</div>
						</div>
						<div className="stat-card">
							<h4>Analysis Error</h4>
							<div className="stat-value">{stats.analysisError || 0}</div>
						</div>
						<div className="stat-card">
							<h4>Fallback Rate</h4>
							<div className="stat-value">{((stats.fallbackRate || 0) * 100).toFixed(1)}%</div>
						</div>
						<div className="stat-card">
							<h4>Avg Chunks/Photo</h4>
							<div className="stat-value">{stats.avgChunksPerPhoto || "N/A"}</div>
						</div>
						<div className="stat-card">
							<h4>Avg LLM Duration</h4>
							<div className="stat-value">{stats.avgLlmDurationMs ? `${stats.avgLlmDurationMs}ms` : "N/A"}</div>
						</div>
					</div>
				</div>

				<div className="stats-section">
					<h3>Privacy & Risk Metrics</h3>
					<div className="stats-grid">
						<div className="stat-card">
							<h4>Photos with EXIF</h4>
							<div className="stat-value">{stats.photosWithExif || 0}</div>
						</div>
						<div className="stat-card">
							<h4>GPS Present</h4>
							<div className="stat-value">{stats.photosWithGpsPresent || 0}</div>
						</div>
						<div className="stat-card">
							<h4>GPS Stored</h4>
							<div className="stat-value">{stats.photosWithGpsStored || 0}</div>
						</div>
						<div className="stat-card">
							<h4>Emails Detected</h4>
							<div className="stat-value">{stats.photosWithEmailsDetected || 0}</div>
						</div>
						<div className="stat-card">
							<h4>Phone Numbers</h4>
							<div className="stat-value">{stats.photosWithPhoneNumbersDetected || 0}</div>
						</div>
						<div className="stat-card">
							<h4>IBANs Detected</h4>
							<div className="stat-value">{stats.photosWithIBANDetected || 0}</div>
						</div>
						<div className="stat-card">
							<h4>Addresses Found</h4>
							<div className="stat-value">{stats.photosWithAddressLikeTextDetected || 0}</div>
						</div>
					</div>
				</div>

				<div className="stats-section">
					<h3>Sensitivity Score Distribution</h3>
					<div className="sensitivity-distribution">
						{Object.entries(stats.sensitivityScoreDistribution || {}).map(([score, count]) => (
							<div key={score} className="sensitivity-bar">
								<div className="sensitivity-label">Score {score}:</div>
								<div className="sensitivity-count">{count}</div>
								<div className="sensitivity-visual" style={{ width: `${Math.max(count, 2)}px` }}></div>
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}