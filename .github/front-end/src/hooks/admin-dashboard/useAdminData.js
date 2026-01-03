import { useCallback, useEffect, useMemo, useState } from "react";
import { demoData, prettyLabel, safeArray24, safeSignals } from "../../utils/adminDashboardData";

const API_BASE = "";

export function useAdminData(user) {
	const [stats, setStats] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [isVerifiedAdmin, setIsVerifiedAdmin] = useState(false);
	const [useLiveMode, setUseLiveMode] = useState(true);

	const verifyAdminAndFetchStats = useCallback(async () => {
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
	}, [useLiveMode, user]);

	useEffect(() => {
		if (user) verifyAdminAndFetchStats();
		else {
			setLoading(false);
			setIsVerifiedAdmin(false);
			setStats(null);
		}
	}, [user, useLiveMode, verifyAdminAndFetchStats]);

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
