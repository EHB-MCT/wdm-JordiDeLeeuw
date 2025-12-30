import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./AuthContext";
import { ProtectedRoute } from "./ProtectedRoute";
import { AdminRoute } from "./AdminRoute";
import { Login } from "./Login";
import { Dashboard } from "./Dashboard";
import { AdminDashboard } from "./AdminDashboard";
import { AccessDenied } from "./AccessDenied";
import "./App.css";

function AppRoutes() {
	const { user } = useAuth();

	return (
		<Routes>
			<Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
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
			<Route path="/access-denied" element={<AccessDenied />} />
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
