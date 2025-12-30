import { useState, useEffect, useMemo } from "react";
import { useAuth } from "./AuthContext";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";
import "./Dashboard.css";

const API_BASE = "";

// Demo data - will be replaced by real backend data
const demoData = {
	sensitiveDataTypes: {
		fullNames: 45,
		locations: 23,
		datesTimes: 67,
		financial: 12,
		documents: 8,
		contactInfo: 34,
	},
	riskLevels: {
		score0: 28,
		score1: 19,
		score2: 24,
		score3: 18,
		score4: 8,
		score5: 3,
	},
	exposureSources: {
		technical: {
			exifPresent: 34,
			gpsPresent: 12,
			cameraModels: 8,
		},
		content: {
			ocrPersonal: 45,
			llmEntities: 23,
			detectedPatterns: 19,
		},
	},
	weeklyTrends: {
		uploads: Array.from({ length: 7 }, (_, i) => ({
			day: i + 1,
			count: Math.floor(Math.random() * 15) + 5,
		})),
		ocrProcessed: Array.from({ length: 7 }, (_, i) => ({
			day: i + 1,
			count: Math.floor(Math.random() * 20) + 10,
		})),
		analysesCompleted: Array.from({ length: 7 }, (_, i) => ({
			day: i + 1,
			count: Math.floor(Math.random() * 12) + 3,
		})),
	},
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

			const statsData = await statsRes.json();
			setStats(statsData);
			setError(null);
		} catch (e) {
			setError("Network error - could not reach server");
			setIsVerifiedAdmin(false);
			setStats(null);
		} finally {
			setLoading(false);
		}
	};

	// Use stats if present, otherwise fall back to demoData
	const dataSource = stats || demoData;

	const sensitiveChartData = useMemo(() => {
		const obj = dataSource?.sensitiveDataTypes || demoData.sensitiveDataTypes;
		return Object.entries(obj).map(([key, count]) => ({
			type: key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()),
			count,
		}));
	}, [dataSource]);

	const riskChartData = useMemo(() => {
		const obj = dataSource?.riskLevels || demoData.riskLevels;
		return Object.entries(obj)
			.map(([key, count]) => ({
				score: key.replace("score", ""),
				count,
			}))
			.sort((a, b) => Number(a.score) - Number(b.score));
	}, [dataSource]);

	const exposureChartData = useMemo(() => {
		const tech = dataSource?.exposureSources?.technical || demoData.exposureSources.technical;
		const content = dataSource?.exposureSources?.content || demoData.exposureSources.content;

		return [
			{ name: "EXIF Present", value: tech.exifPresent },
			{ name: "GPS Present", value: tech.gpsPresent },
			{ name: "Camera Models", value: tech.cameraModels },
			{ name: "OCR Personal", value: content.ocrPersonal },
			{ name: "LLM Entities", value: content.llmEntities },
			{ name: "Detected Patterns", value: content.detectedPatterns },
		];
	}, [dataSource]);

	const trendsChartData = useMemo(() => {
		const uploads = dataSource?.weeklyTrends?.uploads || demoData.weeklyTrends.uploads;
		const ocr = dataSource?.weeklyTrends?.ocrProcessed || demoData.weeklyTrends.ocrProcessed;
		const analyses = dataSource?.weeklyTrends?.analysesCompleted || demoData.weeklyTrends.analysesCompleted;

		// Combine by index/day safely
		const len = Math.min(uploads.length, ocr.length, analyses.length);
		return Array.from({ length: len }, (_, i) => ({
			day: uploads[i]?.day ?? i + 1,
			uploads: uploads[i]?.count ?? 0,
			ocrProcessed: ocr[i]?.count ?? 0,
			analysesCompleted: analyses[i]?.count ?? 0,
		}));
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
				{/* Chart 1 */}
				<div className="chart-card">
					<h2>Types of Sensitive Data Detected</h2>
					<div className="chart-subtitle">User uploads containing personal information</div>

					<div className="chart-container">
						<ResponsiveContainer width="100%" height={300}>
							<BarChart data={sensitiveChartData}>
								<CartesianGrid strokeDasharray="1 2" />
								<XAxis dataKey="type" />
								<YAxis />
								<Tooltip />
								<Legend />
								<Bar dataKey="count" />
							</BarChart>
						</ResponsiveContainer>
					</div>

					<div className="chart-note">Demo data — will be replaced by live admin statistics</div>
				</div>

				{/* Chart 2 */}
				<div className="chart-card">
					<h2>User Exposure Risk Distribution</h2>
					<div className="chart-subtitle">Privacy risk scoring based on detected content</div>

					<div className="chart-container">
						<ResponsiveContainer width="100%" height={250}>
							<BarChart data={riskChartData}>
								<CartesianGrid strokeDasharray="1 2" />
								<XAxis dataKey="score" />
								<YAxis />
								<Tooltip />
								<Legend />
								<Bar dataKey="count" />
							</BarChart>
						</ResponsiveContainer>
					</div>

					<div className="chart-note">Lower scores = lower privacy risk</div>
				</div>

				{/* Chart 3 */}
				<div className="chart-card">
					<h2>Unintended Context Leakage</h2>
					<div className="chart-subtitle">Data exposure across different contexts</div>

					<div className="chart-container">
						<ResponsiveContainer width="100%" height={250}>
							<BarChart data={exposureChartData}>
								<CartesianGrid strokeDasharray="1 2" />
								<XAxis dataKey="name" />
								<YAxis />
								<Tooltip />
								<Legend />
								<Bar dataKey="value" />
							</BarChart>
						</ResponsiveContainer>
					</div>

					<div className="chart-note">Higher values indicate more potential exposure</div>
				</div>

				{/* Chart 4 */}
				<div className="chart-card full-width">
					<h2>Weekly Activity Trends</h2>
					<div className="chart-subtitle">Upload and processing activity over the last 7 days</div>

					<div className="chart-container">
						<ResponsiveContainer width="100%" height={220}>
							<LineChart data={trendsChartData}>
								<CartesianGrid strokeDasharray="1 2" />
								<XAxis dataKey="day" />
								<YAxis />
								<Tooltip />
								<Legend />
								<Line type="monotone" dataKey="uploads" dot={false} />
								<Line type="monotone" dataKey="ocrProcessed" dot={false} />
								<Line type="monotone" dataKey="analysesCompleted" dot={false} />
							</LineChart>
						</ResponsiveContainer>
					</div>

					<div className="chart-note">Demo data — will be replaced by live admin statistics</div>
				</div>
			</div>
		</div>
	);
}
