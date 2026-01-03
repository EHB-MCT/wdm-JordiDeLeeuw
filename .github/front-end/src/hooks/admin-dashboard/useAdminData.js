import { useCallback, useEffect, useMemo, useState } from "react";
import { demoData, prettyLabel, safeArray24, safeSignals } from "../../utils/adminDashboardData";

// Basis-URL voor API calls (leeg = zelfde origin)
const API_BASE = "";

export function useAdminData(user) {
	const [stats, setStats] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [isVerifiedAdmin, setIsVerifiedAdmin] = useState(false);
	const [useLiveMode, setUseLiveMode] = useState(true);

	const verifyAdminAndFetchStats = useCallback(async () => {
		// Valideer admin en haal statistieken op
		setLoading(true);
		setError(null);

		if (!useLiveMode) {
			// Demo-modus: gebruik lokale demo-data
			setIsVerifiedAdmin(true);
			setStats(demoData);
			setLoading(false);
			return;
		}

		try {
			// Controleer adminstatus via /api/me
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

			// Haal live stats op
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
			// Netwerkfout
			setError("Network error - could not reach server");
			setIsVerifiedAdmin(false);
			setStats(null);
		} finally {
			setLoading(false);
		}
	}, [useLiveMode, user]);

	useEffect(() => {
		// Laad data zodra user bekend is of wanneer mode wisselt
		if (user) verifyAdminAndFetchStats();
		else {
			setLoading(false);
			setIsVerifiedAdmin(false);
			setStats(null);
		}
	}, [user, useLiveMode, verifyAdminAndFetchStats]);

	// Kies live data of demo-data
	const dataSource = stats || demoData;

	const totals = useMemo(() => {
		// Veilig fallbacken op demo totals
		const totalUsers = typeof dataSource?.totalUsers === "number" ? dataSource.totalUsers : demoData.totalUsers;
		const totalPhotos = typeof dataSource?.totalPhotos === "number" ? dataSource.totalPhotos : demoData.totalPhotos;
		return { totalUsers, totalPhotos };
	}, [dataSource]);

	const timestampHeatmapData = useMemo(() => {
		// Normaliseer naar 24 items voor de heatmap
		return safeArray24(dataSource?.timestampLeakage);
	}, [dataSource]);

	const socialContextData = useMemo(() => {
		// Zet object om naar chart-vriendelijk array
		const obj = dataSource?.socialContextLeakage || demoData.socialContextLeakage;
		return Object.entries(obj).map(([key, count]) => ({
			category: prettyLabel(key),
			count: Number.isFinite(Number(count)) ? Number(count) : 0,
		}));
	}, [dataSource]);

	const liabilitySignalsData = useMemo(() => {
		// Gebruik fallback bij lege signalen
		return safeSignals(dataSource?.professionalLiabilitySignals, demoData.professionalLiabilitySignals);
	}, [dataSource]);

	const locationLeakageData = useMemo(() => {
		// Gebruik fallback bij lege signalen
		return safeSignals(dataSource?.locationLeakageSignals, demoData.locationLeakageSignals);
	}, [dataSource]);

	// Label voor huidige datamodus
	const modeLabel = useLiveMode ? "Live" : "Demo";

	return {
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
	};
}
