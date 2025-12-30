import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import "./Dashboard.css";

export function AdminDashboard() {
	const { user } = useAuth();
	const navigate = useNavigate();

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
							—
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
							—
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
							—
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
							—
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