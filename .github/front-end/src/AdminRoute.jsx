import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

export function AdminRoute({ children }) {
	const { user } = useAuth();
	
	// User not logged in
	if (!user) {
		return <Navigate to="/access-denied" replace />;
	}
	
	// Admin status will be verified by the AdminDashboard component itself
	// This prevents stale localStorage issues
	return children;
}