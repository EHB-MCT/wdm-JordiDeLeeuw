import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import "./Dashboard.css";

const API_BASE = "";

export function AdminDashboard() {
	const { user } = useAuth();
	const navigate = useNavigate();
	const [stats, setStats] = useState({
		totalUsers: 0,
		totalPhotos: 0,
		ocrCompleted: 0,
		analysesCompleted: 0
	});
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);

	const [adminVerified, setAdminVerified] = useState(false);

	// First verify admin status, then fetch stats if admin
	useEffect(() => {
		const verifyAdminAndFetchStats = async () => {
			try {
				setLoading(true);
				setError(null);

				// Step 1: Verify admin status via /api/me
				const meRes = await fetch(`${API_BASE}/api/me`, {
					headers: {
						"X-User-Id": user.userId,
					},
				});

				if (!meRes.ok) {
					setError("Failed to verify admin status.");
					setLoading(false);
					setAdminVerified(false);
					return;
				}

				const meData = await meRes.json();
				
				// Step 2: Check if user is actually admin
				if (!meData.isAdmin) {
					setError("Access denied. Admin privileges required.");
					setLoading(false);
					setAdminVerified(false);
					return;
				}

				setAdminVerified(true);

				// Step 3: Fetch admin stats
				const statsRes = await fetch(`${API_BASE}/api/admin/stats`, {
					headers: {
						"X-User-Id": user.userId,
					},
				});

				if (statsRes.ok) {
					const statsData = await statsRes.json();
					setStats(statsData);
				} else if (statsRes.status === 403) {
					setError("Access denied. Admin privileges required.");
				} else {
					setError("Failed to load admin statistics.");
				}
			} catch (err) {
				console.error("Failed to verify admin or fetch stats:", err);
				setError("Network error loading statistics.");
			} finally {
				setLoading(false);
			}
		};

		verifyAdminAndFetchStats();
	}, [user.userId]);

	// Show loading during admin verification or stats fetching
	if (loading) {
		return (
			<div className="dashboard">
				<div className="upload-card" style={{ textAlign: 'center', padding: '2rem' }}>
					<div style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>
						{adminVerified ? "Loading Admin Statistics..." : "Verifying admin status..."}
					</div>
					<div style={{ color: '#646cff' }}>
						{adminVerified ? "📊 Fetching stats data..." : "🔐 Checking admin privileges..."}
					</div>
				</div>
			</div>
		);
	}

	// Show error (includes access denied)
	if (error) {
		return (
			<div className="dashboard">
				<div className="upload-card" style={{ textAlign: 'center', padding: '2rem' }}>
					<div style={{ fontSize: '1.2rem', color: '#f44336', marginBottom: '1rem' }}>
						Error Loading Statistics
					</div>
					<div style={{ color: '#ccc', marginBottom: '1.5rem' }}>
						{error}
					</div>
					<button 
						className="next-btn" 
						onClick={() => window.location.reload()}
						style={{ maxWidth: '300px' }}
					>
						Try Again
					</button>
				</div>
			</div>
		);
	}

	// Show access denied specifically (before showing error state)
	if (!adminVerified && !loading && !error) {
		return (
			<div className="dashboard">
				<div className="upload-card" style={{ textAlign: 'center', padding: '2rem' }}>
					<div style={{ fontSize: '1.2rem', color: '#f44336', marginBottom: '1rem' }}>
						Access denied (admin only)
					</div>
					<div style={{ color: '#ccc', marginBottom: '1.5rem' }}>
						You need administrator privileges to access this page.
					</div>
					<button 
						className="next-btn" 
						onClick={() => navigate("/dashboard")}
						style={{ maxWidth: '300px' }}
					>
						Back to User Dashboard
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="dashboard">
			<div className="dashboard-header">
				<h1>Admin Dashboard</h1>
				<div className="profile-menu">
					<button className="profile-icon" onClick={() => navigate("/dashboard")}>
						👤
					</button>
				</div>
			</div>

			<div className="upload-card">
				<h2>Welcome to Admin Dashboard</h2>
				
				<div style={{ 
					display: 'grid', 
					gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
					gap: '1.5rem',
					marginTop: '2rem'
				}}>
					{/* Total Users Card */}
					<div style={{ 
						background: '#1a1a1a', 
						border: '1px solid #444', 
						borderRadius: '8px', 
						padding: '1.5rem',
						textAlign: 'center'
					}}>
						<div style={{ 
							fontSize: '2rem', 
							fontWeight: 'bold', 
							color: '#646cff',
							marginBottom: '0.5rem'
						}}>
							{stats.totalUsers.toLocaleString()}
						</div>
						<div style={{ 
							fontSize: '0.9rem', 
							color: '#ccc' 
						}}>
							Total Users
						</div>
					</div>

					{/* Total Photos Card */}
					<div style={{ 
						background: '#1a1a1a', 
						border: '1px solid #444', 
						borderRadius: '8px', 
						padding: '1.5rem',
						textAlign: 'center'
					}}>
						<div style={{ 
							fontSize: '2rem', 
							fontWeight: 'bold', 
							color: '#ff6b6b',
							marginBottom: '0.5rem'
						}}>
							{stats.totalPhotos.toLocaleString()}
						</div>
						<div style={{ 
							fontSize: '0.9rem', 
							color: '#ccc' 
						}}>
							Total Photos
						</div>
					</div>

					{/* OCR Completed Card */}
					<div style={{ 
						background: '#1a1a1a', 
						border: '1px solid #444', 
						borderRadius: '8px', 
						padding: '1.5rem',
						textAlign: 'center'
					}}>
						<div style={{ 
							fontSize: '2rem', 
							fontWeight: 'bold', 
							color: '#4ade80',
							marginBottom: '0.5rem'
						}}>
							{stats.ocrCompleted.toLocaleString()}
						</div>
						<div style={{ 
							fontSize: '0.9rem', 
							color: '#ccc' 
						}}>
							OCR Completed
						</div>
					</div>

					{/* Analyses Card */}
					<div style={{ 
						background: '#1a1a1a', 
						border: '1px solid #444', 
						borderRadius: '8px', 
						padding: '1.5rem',
						textAlign: 'center'
					}}>
						<div style={{ 
							fontSize: '2rem', 
							fontWeight: 'bold', 
							color: '#ffa500',
							marginBottom: '0.5rem'
						}}>
							{stats.analysesCompleted.toLocaleString()}
						</div>
						<div style={{ 
							fontSize: '0.9rem', 
							color: '#ccc' 
						}}>
							Analyses
						</div>
					</div>
				</div>

				{/* Back to User Dashboard Button */}
				<div style={{ marginTop: '2rem', textAlign: 'center' }}>
					<button 
						className="next-btn" 
						onClick={() => navigate("/dashboard")}
						style={{ 
							maxWidth: '300px',
							background: '#646cff'
						}}
					>
						Back to User Dashboard
					</button>
				</div>
			</div>
		</div>
	);
}