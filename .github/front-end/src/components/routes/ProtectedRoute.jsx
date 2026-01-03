import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export function ProtectedRoute({ children }) {
	const { user, loading } = useAuth();

	// Wacht tot auth-status geladen is
	if (loading) {
		return <div className="loading-screen">Loading...</div>;
	}

	// Niet ingelogd: terug naar login
	if (!user) {
		return <Navigate to="/" replace />;
	}

	// Ingelogd: render de beschermde route
	return children;
}
