import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

export function ProtectedRoute({ children }) {
	const { user, loading } = useAuth();

	if (loading) {
		return <div className="loading-screen">Loading...</div>;
	}

	if (!user) {
		return <Navigate to="/" replace />;
	}

	return children;
}
