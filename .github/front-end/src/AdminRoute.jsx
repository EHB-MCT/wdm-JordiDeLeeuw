import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

export function AdminRoute({ children }) {
	const { user } = useAuth();
	
	// User not logged in or not admin
	if (!user || !user.isAdmin) {
		return <Navigate to="/access-denied" replace />;
	}
	
	return children;
}