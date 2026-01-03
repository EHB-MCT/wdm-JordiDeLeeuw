import { useAuth } from "../context/AuthContext";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import "../styles/AdminDashboard.css";
import { AdminDashboardNav } from "../components/admin-dashboard/AdminDashboardNav";
import { AdminSummary } from "../components/admin-dashboard/AdminSummary";
import { ChartCard } from "../components/admin-dashboard/ChartCard";
import { useAdminData } from "../hooks/admin-dashboard/useAdminData";
import { chartColors, chartMargin, xAxisCommon } from "../utils/adminDashboardData";

export function AdminDashboard() {
	const { user, logout } = useAuth();
	const {
		error,
		isVerifiedAdmin,
		liabilitySignalsData,
		loading,
		locationLeakageData,
		modeLabel,
		setUseLiveMode,
		socialContextData,
		timestampHeatmapData,
		totals,
		useLiveMode,
	} = useAdminData(user);

	if (loading) {
		return (
			<div className="dashboard page">
				<AdminDashboardNav
					email={user?.email}
					modeLabel={modeLabel}
					useLiveMode={useLiveMode}
					onSetLiveMode={setUseLiveMode}
					onLogout={logout}
				/>

				<AdminSummary totals={totals} />

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
				<AdminDashboardNav
					email={user?.email}
					modeLabel={modeLabel}
					useLiveMode={useLiveMode}
					onSetLiveMode={setUseLiveMode}
					onLogout={logout}
				/>

				<AdminSummary totals={totals} />

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
				<AdminDashboardNav
					email={user?.email}
					modeLabel={modeLabel}
					useLiveMode={useLiveMode}
					onSetLiveMode={setUseLiveMode}
					onLogout={logout}
				/>

				<AdminSummary totals={totals} />

				<div className="status-panel error">
					<div className="status-title">Access denied</div>
					<div className="status-subtitle">Admin privileges required.</div>
				</div>
			</div>
		);
	}

	return (
		<div className="dashboard page">
			<AdminDashboardNav
				email={user?.email}
				modeLabel={modeLabel}
				useLiveMode={useLiveMode}
				onSetLiveMode={setUseLiveMode}
				onLogout={logout}
			/>

			<AdminSummary totals={totals} />

			<div className="charts-grid">
				<ChartCard
					title="Timestamp Leakage"
					subtitle="How often time-like stamps appear in OCR text"
					note={useLiveMode ? "Live aggregated data across all analyses" : "Demo data"}
				>
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
				</ChartCard>

				<ChartCard
					title="Social Context Leakage"
					subtitle="Identifiers detected in OCR text"
					note="Higher counts indicate more exposure risk if shared publicly."
				>
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
				</ChartCard>

				<ChartCard
					title="Professional Liability Signals"
					subtitle="Heuristic signals derived from OCR content"
					note="This is a risk indicator, not a judgment."
					extra={
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
					}
				>
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
				</ChartCard>

				<ChartCard
					title="Location Leakage Signals"
					subtitle="Location context inferred from OCR text"
					note="Transit words, station names, routes can leak location indirectly."
				>
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
				</ChartCard>
			</div>
		</div>
	);
}
