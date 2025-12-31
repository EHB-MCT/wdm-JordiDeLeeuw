import { useState, useEffect, useMemo } from "react";
import { useAuth } from "./AuthContext";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, RadialBarChart, RadialBar } from "recharts";
import "./Dashboard.css";

const API_BASE = "";

// OCR Text Privacy Risk Demo Data - will be replaced by real backend data
const demoData = {
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

export function AdminDashboard() {
	const { user } = useAuth();
	const [stats, setStats] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [isVerifiedAdmin, setIsVerifiedAdmin] = useState(false);
	const [useLiveMode, setUseLiveMode] = useState(false);

	useEffect(() => {
		if (user) {
			verifyAdminAndFetchStats();
		} else {
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
			// Demo mode
			setIsVerifiedAdmin(true);
			setStats(demoData);
			setLoading(false);
			return;
		}

		// Live mode
		try {
			const meRes = await fetch(`${API_BASE}/api/me`, {
				headers: { "X-User-Id": user.userId },
			});

			if (!meRes.ok) {
				let msg = "Admin verification failed";
				try {
					const data = await meRes.json();
					msg = data?.error ? `Admin verification failed: ${data.error}` : msg;
				} catch {
					// JSON parsing failed, use default message
				}
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
				} catch {
					// JSON parsing failed, use default message
				}
				setError(msg);
				setStats(null);
				return;
			}

			const statsData = await statsRes.json();
			setStats(statsData);
			setError(null);
		} catch {
			setError("Network error - could not reach server");
			setIsVerifiedAdmin(false);
			setStats(null);
		} finally {
			setLoading(false);
		}
	};

	// Use stats if present, otherwise fall back to demoData
	const dataSource = stats || demoData;

	const timestampHeatmapData = useMemo(() => {
		return dataSource?.timestampLeakage || demoData.timestampLeakage;
	}, [dataSource]);

	const socialContextData = useMemo(() => {
		const obj = dataSource?.socialContextLeakage || demoData.socialContextLeakage;
		return Object.entries(obj).map(([key, count]) => ({
			category: key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()),
			count,
		}));
	}, [dataSource]);

	const liabilitySignalsData = useMemo(() => {
		return dataSource?.professionalLiabilitySignals || demoData.professionalLiabilitySignals;
	}, [dataSource]);

	const locationLeakageData = useMemo(() => {
		return dataSource?.locationLeakageSignals || demoData.locationLeakageSignals;
	}, [dataSource]);

	if (loading) {
		return (
			<div className="dashboard">
				<div className="dashboard-header">
					<div className="dashboard-header-content">
						<h1>Admin Dashboard</h1>
						<div className="profile-email">{user?.email}</div>
					</div>
				</div>
				<div className="chart-note">Loading…</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="dashboard">
				<div className="dashboard-header">
					<div className="dashboard-header-content">
						<h1>Admin Dashboard</h1>
						<div className="profile-email">{user?.email}</div>

						<div className="data-mode-toggle">
							<button className={`mode-toggle ${useLiveMode ? "active" : ""}`} onClick={() => setUseLiveMode(false)} title="Demo data - will be replaced by live stats">
								Demo
							</button>
							<button className={`mode-toggle ${!useLiveMode ? "active" : ""}`} onClick={() => setUseLiveMode(true)} title="Live data from backend" disabled>
								Live
							</button>
						</div>
					</div>
				</div>

				<div className="chart-note">{error}</div>
			</div>
		);
	}

	if (!isVerifiedAdmin) {
		return (
			<div className="dashboard">
				<div className="dashboard-header">
					<div className="dashboard-header-content">
						<h1>Admin Dashboard</h1>
						<div className="profile-email">{user?.email}</div>
					</div>
				</div>
				<div className="chart-note">Access denied.</div>
			</div>
		);
	}

	return (
		<div className="dashboard">
			<div className="dashboard-header">
				<div className="dashboard-header-content">
					<h1>Admin Dashboard</h1>
					<div className="profile-email">{user?.email}</div>

					<div className="data-mode-toggle">
						<button className={`mode-toggle ${useLiveMode ? "active" : ""}`} onClick={() => setUseLiveMode(false)} title="Demo data - will be replaced by live stats">
							Demo
						</button>
						<button className={`mode-toggle ${!useLiveMode ? "active" : ""}`} onClick={() => setUseLiveMode(true)} title="Live data from backend" disabled>
							Live
						</button>
					</div>
				</div>
			</div>

			<div className="charts-grid">
				{/* Chart 1: Timestamp Leakage Heatmap */}
				<div className="chart-card">
					<h2>Timestamp Leakage Heatmap (00–23h)</h2>
					<div className="chart-subtitle">How often system-clock timestamps appear in OCR text</div>

					<div className="chart-container">
						<ResponsiveContainer width="100%" height={300}>
							<BarChart data={timestampHeatmapData}>
								<CartesianGrid strokeDasharray="1 2" />
								<XAxis dataKey="hour" />
								<YAxis />
								<Tooltip />
								<Legend />
								<Bar dataKey="count" fill="#8884d8" />
							</BarChart>
						</ResponsiveContainer>
					</div>

					<div className="chart-note">Demo data — shows timestamp leakage frequency per hour</div>
				</div>

				{/* Chart 2: Social Context Leakage */}
				<div className="chart-card">
					<h2>Social Context Leakage — identifiers detected</h2>
					<div className="chart-subtitle">Personal identifiers found in OCR text</div>

					<div className="chart-container">
						<ResponsiveContainer width="100%" height={250}>
							<BarChart data={socialContextData}>
								<CartesianGrid strokeDasharray="1 2" />
								<XAxis dataKey="category" />
								<YAxis />
								<Tooltip />
								<Legend />
								<Bar dataKey="count" fill="#82ca9d" />
							</BarChart>
						</ResponsiveContainer>
					</div>

					<div className="chart-note">Higher counts indicate more social context exposure</div>
				</div>

				{/* Chart 3: Professional Liability Signals */}
				<div className="chart-card">
					<h2>Professional Liability Signals</h2>
					<div className="chart-subtitle">Risks detected in OCR text</div>

					<div className="chart-container">
						<ResponsiveContainer width="100%" height={200}>
							<BarChart data={liabilitySignalsData}>
								<CartesianGrid strokeDasharray="1 2" />
								<XAxis dataKey="name" />
								<YAxis />
								<Tooltip />
								<Legend />
								<Bar dataKey="count" fill="#ff7c7c" />
							</BarChart>
						</ResponsiveContainer>
					</div>

					<div className="definition-box">
						<strong>Definitions:</strong><br />
						• <strong>Aggression Hits:</strong> Count of OCR lines containing aggressive verbs/insults (demo rule-based)<br />
						• <strong>Profanity Hits:</strong> Count of OCR lines matching a profanity wordlist (demo rule-based)<br />
						• <strong>Shouting Hits:</strong> Count of OCR lines with ALL CAPS words or excessive exclamation marks (demo rule-based)
					</div>
					<div className="chart-note">Demo-only heuristic. This flags risk if screenshots were shared publicly; it does not judge person.</div>
				</div>

				{/* Chart 4: Location Leakage Signals */}
				<div className="chart-card">
					<h2>Location Leakage Signals in OCR Text</h2>
					<div className="chart-subtitle">Location information detected in OCR content</div>

					<div className="chart-container">
						<ResponsiveContainer width="100%" height={200}>
							<BarChart data={locationLeakageData}>
								<CartesianGrid strokeDasharray="1 2" />
								<XAxis dataKey="name" />
								<YAxis />
								<Tooltip />
								<Legend />
								<Bar dataKey="count" fill="#22d3ee" />
							</BarChart>
						</ResponsiveContainer>
					</div>

					<div className="chart-note">Screenshots can reveal location through stations, routes, and transit context—even without GPS/EXIF.</div>
				</div>
			</div>
		</div>
	);
}
