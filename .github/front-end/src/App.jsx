import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ProtectedRoute } from "./components/routes/ProtectedRoute";
import { AdminRoute } from "./components/routes/AdminRoute";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { AdminDashboard } from "./pages/AdminDashboard";
import "./styles/Shared.css";

function AppRoutes() {
	const { user } = useAuth();

	return (
		<Routes>
			<Route path="/" element={user ? <Navigate to={user?.isAdmin ? "/admin" : "/dashboard"} replace /> : <Login />} />
			<Route
				path="/dashboard"
				element={
					<ProtectedRoute>
						<Dashboard />
					</ProtectedRoute>
				}
			/>
			<Route
				path="/admin"
				element={
					<AdminRoute>
						<AdminDashboard />
					</AdminRoute>
				}
			/>
		</Routes>
	);
}

function App() {
	return (
		<BrowserRouter>
			<AuthProvider>
				<AppRoutes />
			</AuthProvider>
		</BrowserRouter>
	);
}

export default App;
