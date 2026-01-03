import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/Auth.css";

// Basis-URL voor API calls (leeg = zelfde origin)
const API_BASE = "";

export function Login() {
	const { login } = useAuth();
	const navigate = useNavigate();
	const [mode, setMode] = useState("login");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [isAdmin, setIsAdmin] = useState(false);
	const [loading, setLoading] = useState(false);
	const [response, setResponse] = useState(null);
	const [showPassword, setShowPassword] = useState(false);
	const [showConfirmPassword, setShowConfirmPassword] = useState(false);

	const handleSubmit = async (e) => {
		// Verwerk login of registratie
		e.preventDefault();
		setLoading(true);
		setResponse(null);

		try {
			// Kies endpoint en payload op basis van de mode
			const endpoint = mode === "login" ? `${API_BASE}/api/login` : `${API_BASE}/api/register`;
			const body = mode === "login" ? { email, password } : { email, password, confirmPassword, isAdmin };

			const res = await fetch(endpoint, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			});

			let data;
			try {
				// Parseer JSON response
				data = await res.json();
			} catch {
				data = { error: "Invalid response from server" };
			}

			if (res.ok) {
				setResponse({ success: true, data });
				// Store admin status and redirect appropriately
				// Sla gebruikersinfo op in context
				login({
					email: data.email,
					userId: data.userId,
					isAdmin: data.isAdmin || false,
				});

				// Redirect admin to admin dashboard, users to regular dashboard
				// Stuur door naar het juiste dashboard
				const redirectPath = data.isAdmin ? "/admin" : "/dashboard";
				setTimeout(() => navigate(redirectPath), 500);
			} else {
				setResponse({ success: false, data });
			}
		} catch (error) {
			// Netwerk- of serverfout
			setResponse({
				success: false,
				data: { error: error.message || "Network error - could not reach server" },
			});
		} finally {
			setLoading(false);
		}
	};

	// Bepaal of we in login- of register-modus zitten
	const isLogin = mode === "login";

	return (
		<div className="app">
			<div className="auth-card">
				<div className="auth-toggle">
					<button className={isLogin ? "auth-toggle-btn active" : "auth-toggle-btn"} onClick={() => setMode("login")}>
						Login
					</button>
					<button className={!isLogin ? "auth-toggle-btn active" : "auth-toggle-btn"} onClick={() => setMode("register")}>
						Register
					</button>
				</div>

				<h1 className="auth-title">{isLogin ? "Welcome back" : "Create an account"}</h1>

				<form className="auth-form" onSubmit={handleSubmit}>
					<label className="auth-label">
						Email
						<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="auth-input" required />
					</label>

					<label className="auth-label">
						Password
						<div className="password-input-wrapper">
							<input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className="auth-input" required />
							<button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)} aria-label="Toggle password visibility">
								{showPassword ? "👁️" : "👁️‍🗨️"}
							</button>
						</div>
					</label>

					{!isLogin && (
						<>
							<label className="auth-label">
								Confirm password
								<div className="password-input-wrapper">
									<input type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="auth-input" required />
									<button type="button" className="password-toggle" onClick={() => setShowConfirmPassword(!showConfirmPassword)} aria-label="Toggle confirm password visibility">
										{showConfirmPassword ? "👁️" : "👁️‍🗨️"}
									</button>
								</div>
							</label>

							<label className="auth-checkbox-label">
								<input type="checkbox" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} />
								Admin account?
							</label>
						</>
					)}

					<button type="submit" className="auth-submit" disabled={loading}>
						{loading ? "Loading..." : isLogin ? "Log in" : "Register"}
					</button>
				</form>

				{response && (
					<div className={response.success ? "response-box success" : "response-box error"}>
						<h3>{response.success ? "Success" : "Error"}</h3>
						<pre>{JSON.stringify(response.data, null, 2)}</pre>
					</div>
				)}
			</div>
		</div>
	);
}
