import { useNavigate } from "react-router-dom";
import "./styles/Shared.css";

export function AccessDenied() {
	const navigate = useNavigate();

	return (
		<div className="dashboard">
			<div className="upload-card access-denied-card">
				<h2 className="access-denied-title">Access denied (admin only)</h2>
				<p className="access-denied-text">You need administrator privileges to access this page.</p>
				<button className="next-btn access-denied-btn" onClick={() => navigate("/dashboard")}>
					Back to User Dashboard
				</button>
			</div>
		</div>
	);
}
