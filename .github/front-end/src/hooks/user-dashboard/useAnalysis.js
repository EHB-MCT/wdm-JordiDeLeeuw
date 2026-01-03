import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const API_BASE = "";

const emptyCounters = {
	photos_found: 0,
	photos_started: 0,
	photos_completed: 0,
	photos_failed: 0,
	photos_fallback: 0,
	photos_queued: 0,
};

export function useAnalysis({ user }) {
	const [analyzing, setAnalyzing] = useState(false);
	const [showAnalysisModal, setShowAnalysisModal] = useState(false);
	const [analysisResults, setAnalysisResults] = useState(null);
	const [showAnalysis, setShowAnalysis] = useState(false);
	const [analysisProgress, setAnalysisProgress] = useState({ currentPhoto: 0, totalPhotos: 0, status: "idle" });
	const [analysisDetails, setAnalysisDetails] = useState([]);
	const [analysisCounters, setAnalysisCounters] = useState(emptyCounters);
	const analysisPollIntervalRef = useRef(null);

	const stopAnalysisPolling = useCallback(() => {
		if (analysisPollIntervalRef.current) {
			console.log("Clearing analysis polling interval");
			clearInterval(analysisPollIntervalRef.current);
			analysisPollIntervalRef.current = null;
		}
	}, []);

	const fetchAnalysisProgress = useCallback(async () => {
		try {
			const res = await fetch(`${API_BASE}/api/photos/analysis-progress`, {
				headers: {
					"X-User-Id": user.userId,
				},
			});

			if (res.ok) {
				const data = await res.json();
				setAnalysisDetails(data.photos || []);
				setAnalysisCounters(data.counters || {});

				const counters = data.counters || {};
				const started = Number(counters.photos_started || 0);
				const processed = Number(counters.photos_completed || 0) + Number(counters.photos_failed || 0) + Number(counters.photos_fallback || 0);

				setAnalysisProgress((prev) => {
					const nextStatus = started > 0 && processed >= started ? "finalizing" : "analyzing";
					return {
						...prev,
						currentPhoto: processed,
						totalPhotos: started || prev.totalPhotos || 0,
						status: prev.status === "complete" || prev.status === "error" ? prev.status : nextStatus,
					};
				});

				if (started > 0 && processed >= started) {
					console.log("All photos processed - waiting for final JSON (finalizing)");
				}
			}
		} catch (error) {
			console.error("Failed to fetch analysis progress:", error);
		}
	}, [user]);

	const startAnalysisPolling = useCallback(() => {
		console.log("Starting analysis progress polling");
		fetchAnalysisProgress();
		analysisPollIntervalRef.current = setInterval(fetchAnalysisProgress, 2000);
	}, [fetchAnalysisProgress]);

	const resetAnalysisState = useCallback((closeModal = false) => {
		setAnalysisResults(null);
		setShowAnalysis(false);
		setAnalysisProgress({ currentPhoto: 0, totalPhotos: 0, status: "idle" });
		setAnalysisDetails([]);
		setAnalysisCounters(emptyCounters);
		if (closeModal) setShowAnalysisModal(false);
	}, []);

	const handleAnalyze = useCallback(async () => {
		if (analyzing) {
			console.log("Analysis already in progress, ignoring click");
			return;
		}

		setAnalyzing(true);
		setShowAnalysisModal(true);
		setAnalysisResults(null);
		setAnalysisProgress({ currentPhoto: 0, totalPhotos: 0, status: "analyzing" });
		setAnalysisDetails([]);
		setAnalysisCounters(emptyCounters);

		startAnalysisPolling();

		try {
			console.log("Starting analysis request...");
			const res = await fetch(`${API_BASE}/api/photos/analyze`, {
				method: "POST",
				headers: {
					"X-User-Id": user.userId,
				},
			});

			const data = await res.json();

			console.log("Raw LLM response:", data);
			console.log("Analysis summary:", data.summary);
			console.log("Analysis details:", data.details);
			console.log("Progress counters:", data.progress);
			console.log("Photos analyzed:", data.analyzedPhotos);

			if (res.ok) {
				setAnalysisResults(data);
				setShowAnalysis(true);
				setAnalysisProgress({ currentPhoto: data.analyzedPhotos, totalPhotos: data.analyzedPhotos, status: "complete" });
				stopAnalysisPolling();
				setShowAnalysisModal(false);

				if (data.progress) {
					setAnalysisCounters(data.progress);
				}
			} else {
				setAnalysisProgress({ currentPhoto: 0, totalPhotos: 0, status: "error" });
				stopAnalysisPolling();
				setShowAnalysisModal(false);
				if (res.status === 429) {
					alert(`Please wait: ${data.error || "Analysis already in progress"}`);
				} else if (res.status === 400) {
					if (data.error && data.error.includes("No photos with completed OCR")) {
						alert("No photos with extracted text found. Please make sure photos have been processed (Extract button) before analyzing.");
					} else {
						alert(`Analysis failed: ${data.error || "Unknown error"}`);
					}
				} else {
					alert(`Analysis failed: ${data.error || "Unknown error"}`);
				}
			}
		} catch (error) {
			console.error("Failed to fetch analysis:", error);
			setAnalysisProgress({ currentPhoto: 0, totalPhotos: 0, status: "error" });
			stopAnalysisPolling();
			setShowAnalysisModal(false);
			alert(`Network error: ${error.message}`);
		} finally {
			setAnalyzing(false);
		}
	}, [analyzing, user, startAnalysisPolling, stopAnalysisPolling]);

	useEffect(() => {
		if (!analysisResults) return;
		if (analysisResults?.error) return;
		const payload = analysisResults?.details ?? analysisResults;
		console.log("[ANALYSIS RESULT JSON]", payload);
	}, [analysisResults]);

	useEffect(() => {
		return () => {
			stopAnalysisPolling();
		};
	}, [stopAnalysisPolling]);

	const analysisPctForUi = useMemo(() => {
		const stageScore = (status) => {
			switch (status) {
				case "pending":
					return 0.0;
				case "queued":
					return 0.25;
				case "processing":
					return 0.25;
				case "sent_to_llm":
					return 0.5;
				case "finalizing":
					return 0.75;
				case "completed":
				case "fallback_used":
				case "llm_failed":
				case "error":
					return 1.0;
				default:
					return 0.0;
			}
		};

		if (Array.isArray(analysisDetails) && analysisDetails.length > 0) {
			const total = analysisDetails.length;
			let sum = 0;
			for (const p of analysisDetails) {
				sum += stageScore(p?.analysisStatus);
			}
			const pct = Math.round((sum / total) * 100);
			return Math.max(0, Math.min(100, pct));
		}

		const found = Number(analysisCounters?.photos_found || 0);
		const started = Number(analysisCounters?.photos_started || 0);
		const total = found || started || 0;
		if (!total) return 0;

		const processed = Number(analysisCounters?.photos_completed || 0) + Number(analysisCounters?.photos_failed || 0) + Number(analysisCounters?.photos_fallback || 0);

		if (started > 0 && processed === 0) {
			return 20;
		}

		return Math.max(0, Math.min(100, Math.round((processed / total) * 100)));
	}, [analysisDetails, analysisCounters]);

	const analysisTotalForUi = useMemo(() => {
		const analysisStarted = Number(analysisCounters?.photos_started || 0);
		const analysisFound = Number(analysisCounters?.photos_found || 0);
		return analysisFound || analysisStarted || (Array.isArray(analysisDetails) ? analysisDetails.length : 0) || 0;
	}, [analysisCounters, analysisDetails]);

	const analysisProcessedForUi = useMemo(() => {
		return Number(analysisCounters?.photos_completed || 0) + Number(analysisCounters?.photos_failed || 0) + Number(analysisCounters?.photos_fallback || 0);
	}, [analysisCounters]);

	const userShortSummary = useMemo(() => {
		const details = analysisResults?.details || null;
		return analysisResults?.summary || details?.user?.short_summary || details?.short_summary || "";
	}, [analysisResults]);

	return {
		analyzing,
		showAnalysisModal,
		analysisResults,
		showAnalysis,
		analysisProgress,
		analysisDetails,
		analysisCounters,
		analysisTotalForUi,
		analysisProcessedForUi,
		analysisPctForUi,
		userShortSummary,
		handleAnalyze,
		resetAnalysisState,
	};
}
