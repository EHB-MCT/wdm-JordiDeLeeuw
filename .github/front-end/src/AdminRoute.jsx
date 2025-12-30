import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

const API_BASE = "";

export function AdminRoute({ children }) {
	const { user, loading } = useAuth();
	const [verifying, setVerifying] = useState(true);
	const [isAdmin, setIsAdmin] = useState(false);

	useEffect(() => {
		if (!loading && user) {
			console.log("AdminRoute: Verifying admin status for user:", user);
			verifyAdminStatus();
		} else {
			setVerifying(false);
		}
	}, [user, loading]);

	const verifyAdminStatus = async () => {
		try {
			console.log("AdminRoute: Calling /api/me with userId:", user.userId);
			const res = await fetch(`${API_BASE}/api/me`, {
				headers: {
					"X-User-Id": user.userId,
				},
			});

			console.log("AdminRoute: /api/me response status:", res.status);

			if (res.ok) {
				const data = await res.json();
				console.log("AdminRoute: /api/me response data:", data);
				setIsAdmin(data.isAdmin === true);
			} else {
				console.log("AdminRoute: /api/me failed, status:", res.status);
				const errorData = await res.json();
				console.log("AdminRoute: /api/me error:", errorData);
				setIsAdmin(false);
			}
		} catch (error) {
			console.error("AdminRoute: Error verifying admin status:", error);
			setIsAdmin(false);
		} finally {
			setVerifying(false);
		}
	};

	if (loading || verifying) {
		return (
			<div className="dashboard">
				<div className="dashboard-header">
					<h1>Verifying access...</h1>
				</div>
				<div className="loading-photos">Checking admin permissions...</div>
			</div>
		);
	}

	if (!user) {
		console.log("AdminRoute: No user, redirecting to login");
		return <Navigate to="/" replace />;
	}

	if (!isAdmin) {
		console.log("AdminRoute: User is not admin, redirecting to dashboard");
		return <Navigate to="/dashboard" replace />;
	}

	console.log("AdminRoute: Admin confirmed, showing admin dashboard");
	return children;
}