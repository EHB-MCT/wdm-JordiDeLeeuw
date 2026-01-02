import { useState, useEffect, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import "../styles/AdminDashboard.css";

const API_BASE = "";

const demoData = {
	totalUsers: 156,
	totalPhotos: 1247,
	timestampLeakage: Array.from({ length: 24 }, (_, i) => ({
		hour: i,
		count: Math.floor(Math.random() * 50) + 10,
	})),
	socialContextLeakage: {
		relationshipLabels: 23,
		handles: 45,
		emails: 18,
		phonePatterns: 12,
		nameEntities: 34,
	},
	professionalLiabilitySignals: [
		{ name: "Aggression Hits", count: 14 },
		{ name: "Profanity Hits", count: 9 },
		{ name: "Shouting Hits", count: 22 },
	],
	locationLeakageSignals: [
		{ name: "Explicit location keywords", count: 18 },
		{ name: "Travel/route context", count: 27 },
		{ name: "No location signals", count: 5 },
	],
};

const chartColors = {
	timestamp: "#38bdf8",
	social: "#a78bfa",
	liability: "#f59e0b",
	location: "#22c55e",
};

function prettyLabel(key) {
	return key
		.replace(/([A-Z])/g, " $1")
		.replace(/^./, (c) => c.toUpperCase())
		.replace("Iban", "IBAN");
}

function safeArray24(arr) {
	if (Array.isArray(arr) && arr.length === 24) return arr;
	return Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0 }));
}

function safeSignals(arr, fallback) {
	if (Array.isArray(arr) && arr.length) return arr;
	return fallback;
}

export function AdminDashboard() {
	const { user, logout } = useAuth();

	const [stats, setStats] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [isVerifiedAdmin, setIsVerifiedAdmin] = useState(false);
	const [useLiveMode, setUseLiveMode] = useState(true);

	useEffect(() => {
		if (user) verifyAdminAndFetchStats();
		else {
			setLoading(false);
			setIsVerifiedAdmin(false);
			setStats(null);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [user, useLiveMode]);

	const verifyAdminAndFetchStats = async () => {
		setLoading(true);
		setError(null);

		if (!useLiveMode) {
			setIsVerifiedAdmin(true);
			setStats(demoData);
			setLoading(false);
			return;
		}

		try {
			const meRes = await fetch(`${API_BASE}/api/me`, {
				headers: { "X-User-Id": user.userId },
			});

			if (!meRes.ok) {
				let msg = "Admin verification failed";
				try {
					const data = await meRes.json();
					msg = data?.error ? `Admin verification failed: ${data.error}` : msg;
				} catch {}
				setError(msg);
				setIsVerifiedAdmin(false);
				setStats(null);
				return;
			}

			const meData = await meRes.json();
			if (meData?.isAdmin !== true) {
				setError("Access denied: admin privileges required");
				setIsVerifiedAdmin(false);
				setStats(null);
				return;
			}

			setIsVerifiedAdmin(true);

			const statsRes = await fetch(`${API_BASE}/api/admin/stats`, {
				headers: { "X-User-Id": user.userId },
			});

			if (!statsRes.ok) {
				let msg = "Failed to fetch admin statistics";
				try {
					const data = await statsRes.json();
					msg = data?.error || msg;
				} catch {}
				setError(msg);
				setStats(null);
				return;
			}

			const live = await statsRes.json();
			setStats(live);
			setError(null);
		} catch {
			setError("Network error - could not reach server");
			setIsVerifiedAdmin(false);
			setStats(null);
		} finally {
			setLoading(false);
		}
	};

	const dataSource = stats || demoData;

	const totals = useMemo(() => {
		const totalUsers = typeof dataSource?.totalUsers === "number" ? dataSource.totalUsers : demoData.totalUsers;
		const totalPhotos = typeof dataSource?.totalPhotos === "number" ? dataSource.totalPhotos : demoData.totalPhotos;
		return { totalUsers, totalPhotos };
	}, [dataSource]);

	const timestampHeatmapData = useMemo(() => {
		return safeArray24(dataSource?.timestampLeakage);
	}, [dataSource]);

	const socialContextData = useMemo(() => {
		const obj = dataSource?.socialContextLeakage || demoData.socialContextLeakage;
		return Object.entries(obj).map(([key, count]) => ({
			category: prettyLabel(key),
			count: Number.isFinite(Number(count)) ? Number(count) : 0,
		}));
	}, [dataSource]);

	const liabilitySignalsData = useMemo(() => {
		return safeSignals(dataSource?.professionalLiabilitySignals, demoData.professionalLiabilitySignals);
	}, [dataSource]);

	const locationLeakageData = useMemo(() => {
		return safeSignals(dataSource?.locationLeakageSignals, demoData.locationLeakageSignals);
	}, [dataSource]);

	const chartMargin = { top: 12, right: 16, left: 8, bottom: 48 };
	const xAxisCommon = { height: 48, tick: { fontSize: 11 } };

	const modeLabel = useLiveMode ? "Live" : "Demo";

	if (loading) {
		return (
			<div className="dashboard page">
				<div className="admin-nav">
					<div className="admin-nav-left">
						<h1>Admin Dashboard</h1>
						<span className={`pill ${modeLabel.toLowerCase()}`}>{modeLabel}</span>
					</div>
					<div className="admin-nav-middle">
						<div className="user-email">{user?.email || "unknown"}</div>
					</div>
					<div className="admin-nav-right">
						<div className="data-mode-toggle">
							<button className={`mode-toggle ${!useLiveMode ? "active" : ""}`} onClick={() => setUseLiveMode(false)} title="Demo data">
								Demo
							</button>
							<button className={`mode-toggle ${useLiveMode ? "active" : ""}`} onClick={() => setUseLiveMode(true)} title="Live data">
								Live
							</button>
						</div>
						<button className="logout-btn" onClick={logout}>
							Logout
						</button>
					</div>
				</div>

				<div className="admin-summary">
					Users: {totals.totalUsers} • Photos: {totals.totalPhotos}
				</div>

				<div className="status-panel">
					<div className="status-title">Loading</div>
					<div className="status-subtitle">Fetching dashboard data…</div>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="dashboard page">
				<div className="admin-nav">
					<div className="admin-nav-left">
						<h1>Admin Dashboard</h1>
						<span className={`pill ${modeLabel.toLowerCase()}`}>{modeLabel}</span>
					</div>
					<div className="admin-nav-middle">
						<div className="user-email">{user?.email || "unknown"}</div>
					</div>
					<div className="admin-nav-right">
						<div className="data-mode-toggle">
							<button className={`mode-toggle ${!useLiveMode ? "active" : ""}`} onClick={() => setUseLiveMode(false)} title="Demo data">
								Demo
							</button>
							<button className={`mode-toggle ${useLiveMode ? "active" : ""}`} onClick={() => setUseLiveMode(true)} title="Live data">
								Live
							</button>
						</div>
						<button className="logout-btn" onClick={logout}>
							Logout
						</button>
					</div>
				</div>

				<div className="admin-summary">
					Users: {totals.totalUsers} • Photos: {totals.totalPhotos}
				</div>

				<div className="status-panel error">
					<div className="status-title">Error</div>
					<div className="status-subtitle">{error}</div>
					<div className="status-hint">
						If Live fails, verify Vite proxy and that backend registers <code>/api/admin/stats</code>.
					</div>
				</div>
			</div>
		);
	}

	if (!isVerifiedAdmin) {
		return (
			<div className="dashboard page">
				<div className="admin-nav">
					<div className="admin-nav-left">
						<h1>Admin Dashboard</h1>
						<span className={`pill ${modeLabel.toLowerCase()}`}>{modeLabel}</span>
					</div>
					<div className="admin-nav-middle">
						<div className="user-email">{user?.email || "unknown"}</div>
					</div>
					<div className="admin-nav-right">
						<div className="data-mode-toggle">
							<button className={`mode-toggle ${!useLiveMode ? "active" : ""}`} onClick={() => setUseLiveMode(false)} title="Demo data">
								Demo
							</button>
							<button className={`mode-toggle ${useLiveMode ? "active" : ""}`} onClick={() => setUseLiveMode(true)} title="Live data">
								Live
							</button>
						</div>
						<button className="logout-btn" onClick={logout}>
							Logout
						</button>
					</div>
				</div>

				<div className="admin-summary">
					Users: {totals.totalUsers} • Photos: {totals.totalPhotos}
				</div>

				<div className="status-panel error">
					<div className="status-title">Access denied</div>
					<div className="status-subtitle">Admin privileges required.</div>
				</div>
			</div>
		);
	}

	return (
		<div className="dashboard page">
			<div className="admin-nav">
				<div className="admin-nav-left">
					<h1>Admin Dashboard</h1>
					<span className={`pill ${modeLabel.toLowerCase()}`}>{modeLabel}</span>
				</div>
				<div className="admin-nav-middle">
					<div className="user-email">{user?.email || "unknown"}</div>
				</div>
				<div className="admin-nav-right">
					<div className="data-mode-toggle">
						<button className={`mode-toggle ${!useLiveMode ? "active" : ""}`} onClick={() => setUseLiveMode(false)} title="Demo data">
							Demo
						</button>
						<button className={`mode-toggle ${useLiveMode ? "active" : ""}`} onClick={() => setUseLiveMode(true)} title="Live data">
							Live
						</button>
					</div>
					<button className="logout-btn" onClick={logout}>
						Logout
					</button>
				</div>
			</div>

			<div className="admin-summary">
				Users: {totals.totalUsers} • Photos: {totals.totalPhotos}
			</div>

			<div className="charts-grid">
				<div className="chart-card">
					<div className="card-head">
						<div>
							<h2>Timestamp Leakage</h2>
							<div className="chart-subtitle">How often time-like stamps appear in OCR text</div>
						</div>
					</div>

					<div className="chart-container tall">
						<ResponsiveContainer width="100%" height="100%">
							<BarChart data={timestampHeatmapData} margin={chartMargin}>
								<CartesianGrid strokeDasharray="2 3" />
								<XAxis dataKey="hour" {...xAxisCommon} />
								<YAxis tick={{ fontSize: 12 }} />
								<Tooltip />
								<Legend />
								<Bar dataKey="count" fill={chartColors.timestamp} radius={[8, 8, 0, 0]} />
							</BarChart>
						</ResponsiveContainer>
					</div>

					<div className="chart-note">{useLiveMode ? "Live aggregated data across all analyses" : "Demo data"}</div>
				</div>

				<div className="chart-card">
					<div className="card-head">
						<div>
							<h2>Social Context Leakage</h2>
							<div className="chart-subtitle">Identifiers detected in OCR text</div>
						</div>
					</div>

					<div className="chart-container">
						<ResponsiveContainer width="100%" height="100%">
							<BarChart data={socialContextData} margin={chartMargin}>
								<CartesianGrid strokeDasharray="2 3" />
								<XAxis dataKey="category" {...xAxisCommon} interval={0} angle={-18} textAnchor="end" />
								<YAxis tick={{ fontSize: 12 }} />
								<Tooltip />
								<Legend />
								<Bar dataKey="count" fill={chartColors.social} radius={[8, 8, 0, 0]} />
							</BarChart>
						</ResponsiveContainer>
					</div>

					<div className="chart-note">Higher counts indicate more exposure risk if shared publicly.</div>
				</div>

				<div className="chart-card">
					<div className="card-head">
						<div>
							<h2>Professional Liability Signals</h2>
							<div className="chart-subtitle">Heuristic signals derived from OCR content</div>
						</div>
					</div>

					<div className="chart-container">
						<ResponsiveContainer width="100%" height="100%">
							<BarChart data={liabilitySignalsData} margin={chartMargin}>
								<CartesianGrid strokeDasharray="2 3" />
								<XAxis dataKey="name" {...xAxisCommon} />
								<YAxis tick={{ fontSize: 12 }} />
								<Tooltip />
								<Legend />
								<Bar dataKey="count" fill={chartColors.liability} radius={[8, 8, 0, 0]} />
							</BarChart>
						</ResponsiveContainer>
					</div>

					<div className="definition-box">
						<strong>Definitions</strong>
						<div className="def-row">
							<span>Aggression Hits</span>
							<span>Lines containing aggressive verbs or insults</span>
						</div>
						<div className="def-row">
							<span>Profanity Hits</span>
							<span>Matches from a profanity wordlist</span>
						</div>
						<div className="def-row">
							<span>Shouting Hits</span>
							<span>ALL CAPS or excessive exclamation marks</span>
						</div>
					</div>

					<div className="chart-note">This is a risk indicator, not a judgment.</div>
				</div>

				<div className="chart-card">
					<div className="card-head">
						<div>
							<h2>Location Leakage Signals</h2>
							<div className="chart-subtitle">Location context inferred from OCR text</div>
						</div>
					</div>

					<div className="chart-container">
						<ResponsiveContainer width="100%" height="100%">
							<BarChart data={locationLeakageData} margin={chartMargin}>
								<CartesianGrid strokeDasharray="2 3" />
								<XAxis dataKey="name" {...xAxisCommon} />
								<YAxis tick={{ fontSize: 12 }} />
								<Tooltip />
								<Legend />
								<Bar dataKey="count" fill={chartColors.location} radius={[8, 8, 0, 0]} />
							</BarChart>
						</ResponsiveContainer>
					</div>

					<div className="chart-note">Transit words, station names, routes can leak location indirectly.</div>
				</div>
			</div>
		</div>
	);
}
