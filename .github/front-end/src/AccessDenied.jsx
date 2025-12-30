import { useNavigate } from "react-router-dom";
import "./Dashboard.css";

export function AccessDenied() {
	const navigate = useNavigate();

	return (
		<div className="dashboard">
			<div className="upload-card" style={{ textAlign: 'center', maxWidth: '500px', margin: '2rem auto' }}>
				<h2 style={{ color: '#f44336', marginBottom: '1rem' }}>
					Access denied (admin only)
				</h2>
				<p style={{ color: '#ccc', marginBottom: '2rem' }}>
					You need administrator privileges to access this page.
				</p>
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