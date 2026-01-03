import { useCallback, useEffect, useRef, useState } from "react";

const API_BASE = "";

export function useProcessing({ user, onComplete }) {
	const [processing, setProcessing] = useState(false);
	const [showProcessingModal, setShowProcessingModal] = useState(false);
	const [processingStatus, setProcessingStatus] = useState([]);
	const pollIntervalRef = useRef(null);

	const stopPolling = useCallback(() => {
		if (pollIntervalRef.current) {
			console.log("Clearing interval:", pollIntervalRef.current);
			clearInterval(pollIntervalRef.current);
			pollIntervalRef.current = null;
		}
	}, []);

	const fetchStatus = useCallback(async () => {
		console.log("Fetching status...");
		try {
			const res = await fetch(`${API_BASE}/api/photos/status`, {
				headers: {
					"X-User-Id": user.userId,
				},
			});

			if (res.ok) {
				const data = await res.json();
				const newStatus = data.photos || [];

				setProcessingStatus((prev) => {
					const prevStatusString = JSON.stringify(prev);
					const newStatusString = JSON.stringify(newStatus);

					if (prevStatusString !== newStatusString) {
						console.log("Processing status updated");
						return newStatus;
					}
					return prev;
				});

				const allDone = newStatus.every((p) => p.status === "done" || p.status === "error");
				const hasProcessing = newStatus.some((p) => p.status === "received" || p.status === "extracting");

				console.log("Poll check:", { allDone, hasProcessing, total: newStatus.length });

				if (allDone && !hasProcessing) {
					console.log("All photos complete - stopping polling");
					stopPolling();
					setProcessing(false);
					setShowProcessingModal(false);
					if (onComplete) onComplete();
				}
			}
		} catch (error) {
			console.error("Failed to fetch status:", error);
		}
	}, [user, onComplete, stopPolling]);

	const startPolling = useCallback(() => {
		console.log("Starting polling");
		fetchStatus();
		pollIntervalRef.current = setInterval(fetchStatus, 1500);
		console.log("Polling interval started:", pollIntervalRef.current);
	}, [fetchStatus]);

	const handleProcessAll = useCallback(async () => {
		setProcessing(true);
		setShowProcessingModal(true);
		setProcessingStatus([]);

		try {
			const res = await fetch(`${API_BASE}/api/photos/process-all`, {
				method: "POST",
				headers: {
					"X-User-Id": user.userId,
				},
			});

			if (res.status === 202) {
				await res.json();
				console.log("Processing started, beginning to poll");
				startPolling();
				return;
			}

			let msg = "Processing failed";
			try {
				const data = await res.json();
				msg = data?.error || msg;
			} catch {
				// ignore
			}
			alert(msg);
			setProcessing(false);
			setShowProcessingModal(false);
		} catch (error) {
			alert(error.message || "Network error");
			setProcessing(false);
			setShowProcessingModal(false);
		}
	}, [user, startPolling]);

	const getProgressPercentage = useCallback(() => {
		if (processingStatus.length === 0) return 0;
		const completed = processingStatus.filter((p) => p.status === "done" || p.status === "error").length;
		return Math.round((completed / processingStatus.length) * 100);
	}, [processingStatus]);

	useEffect(() => {
		return () => {
			console.log("Cleanup - stopping polling");
			stopPolling();
		};
	}, [stopPolling]);

	return {
		processing,
		showProcessingModal,
		processingStatus,
		handleProcessAll,
		getProgressPercentage,
	};
}
