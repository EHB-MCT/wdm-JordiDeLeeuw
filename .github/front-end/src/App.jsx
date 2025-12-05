import { useState } from "react";
import "./App.css";

function App() {
	const [mode, setMode] = useState("login"); //"login" of "register"
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");

	const handleSubmit = (e) => {
		e.preventDefault();

		if (mode === "register" && password !== confirmPassword) {
			alert("wachtwoorden komen niet overeen");
			return;
		}

		//wordt later de api calls
		console.log("mode:", mode);
		console.log("email:", email);
		console.log("password:", password);

		alert(mode === "login" ? "login formulier verzonden (nog geen echte backend)" : "register formulier verzonden");
	};

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

				<h1 className="auth-title">{isLogin ? "Welkom terug" : "Maak een account"}</h1>

				<form className="auth-form" onSubmit={handleSubmit}>
					<label className="auth-label">
						E-mail
						<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="auth-input" required />
					</label>

					<label className="auth-label">
						Wachtwoord
						<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="auth-input" required />
					</label>

					{!isLogin && (
						<label className="auth-label">
							Herhaal wachtwoord
							<input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="auth-input" required />
						</label>
					)}

					<button type="submit" className="auth-submit">
						{isLogin ? "Inloggen" : "Registreren"}
					</button>
				</form>
			</div>
		</div>
	);
}

export default App;
