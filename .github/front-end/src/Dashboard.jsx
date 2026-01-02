import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import "./styles/UserDashboard.css";
// OBOE_EDIT_TEST: connectivity check (write test 2)

const API_BASE = "";

export function Dashboard() {
	const { user, logout } = useAuth();
	const navigate = useNavigate();

	// Redirect admins to admin dashboard
	useEffect(() => {
		if (user?.isAdmin) {
			navigate("/admin", { replace: true });
		}
	}, [user, navigate]);
	const [files, setFiles] = useState([]);
	const [uploading, setUploading] = useState(false);
	const [response, setResponse] = useState(null);
	const [photos, setPhotos] = useState([]);
	const [loadingPhotos, setLoadingPhotos] = useState(true);
	const [imageUrls, setImageUrls] = useState({});
	const imageUrlsRef = useRef({});
	const prevImageUrlsRef = useRef({});
	const [processing, setProcessing] = useState(false);
	const [showProcessingModal, setShowProcessingModal] = useState(false);
	const [showAnalysisModal, setShowAnalysisModal] = useState(false);
	const [processingStatus, setProcessingStatus] = useState([]);
	const [locationOptIn, setLocationOptIn] = useState(false);
	const [analyzing, setAnalyzing] = useState(false);
	const [analysisResults, setAnalysisResults] = useState(null);
	const [showAnalysis, setShowAnalysis] = useState(false);
	const [analysisProgress, setAnalysisProgress] = useState({ currentPhoto: 0, totalPhotos: 0, status: "idle" });
	const [analysisDetails, setAnalysisDetails] = useState([]);
	const [analysisCounters, setAnalysisCounters] = useState({ photos_found: 0, photos_started: 0, photos_completed: 0, photos_failed: 0, photos_fallback: 0, photos_queued: 0 });
	const pollIntervalRef = useRef(null);
	const analysisPollIntervalRef = useRef(null);

	useEffect(() => {
		fetchPhotos();
		// NOTE: do NOT auto-fetch analysis on mount.
		// Analysis should be fetched after the user explicitly clicks "Analyze".
	}, []);

	// Keep refs in sync + safely revoke object URLs (avoid stale-closure + leaks)
	useEffect(() => {
		imageUrlsRef.current = imageUrls;

		const prev = prevImageUrlsRef.current || {};
		// Revoke URLs that were removed
		for (const key of Object.keys(prev)) {
			if (!imageUrls[key] && prev[key]) {
				URL.revokeObjectURL(prev[key]);
			}
		}
		prevImageUrlsRef.current = imageUrls;

		// On unmount: revoke everything still present
		return () => {
			const current = prevImageUrlsRef.current || {};
			Object.values(current).forEach((url) => {
				if (url) URL.revokeObjectURL(url);
			});
		};
	}, [imageUrls]);

	// Debug: log full analysis JSON in console (do not show in UI)
	useEffect(() => {
		if (!analysisResults) return;
		if (analysisResults?.error) return;
		const payload = analysisResults?.details ?? analysisResults;
		console.log("[ANALYSIS RESULT JSON]", payload);
	}, [analysisResults]);

	const fetchPhotos = async () => {
		setLoadingPhotos(true);
		try {
			const res = await fetch(`${API_BASE}/api/photos`, {
				headers: {
					"X-User-Id": user.userId,
				},
			});

			if (res.ok) {
				const data = await res.json();
				const photosList = data.photos || [];

				setPhotos((prev) => {
					const prevPhotosString = JSON.stringify(prev);
					const newPhotosString = JSON.stringify(photosList);

					if (prevPhotosString !== newPhotosString) {
						console.log("Photos state updated - data changed");
						return photosList;
					} else {
						console.log("Photos state NOT updated - no changes");
						return prev;
					}
				});

				for (const photo of photosList) {
					if (!imageUrlsRef.current[photo.id]) {
						fetchImageBlob(photo.id);
					}
				}
			}
		} catch (error) {
			console.error("Failed to fetch photos:", error);
		} finally {
			setLoadingPhotos(false);
		}
	};

	const fetchImageBlob = async (photoId) => {
		try {
			const res = await fetch(`${API_BASE}/api/photos/${photoId}/file`, {
				headers: {
					"X-User-Id": user.userId,
				},
			});

			if (res.ok) {
				const blob = await res.blob();
				const url = URL.createObjectURL(blob);
				setImageUrls((prev) => ({ ...prev, [photoId]: url }));
			}
		} catch (error) {
			console.error("Failed to fetch image blob:", error);
		}
	};

	const handleFileChange = (e) => {
		setFiles(Array.from(e.target.files));
		setResponse(null);
	};

	const handleUpload = async (e) => {
		e.preventDefault();

		if (files.length === 0) {
			setResponse({ success: false, data: { error: "Select at least one file" } });
			return;
		}

		setUploading(true);
		setResponse(null);

		try {
			const formData = new FormData();
			files.forEach((file) => {
				formData.append("files", file);
			});
			formData.append("locationOptIn", locationOptIn.toString());

			console.log("Uploading to:", `${API_BASE}/api/photos`);
			console.log("User ID:", user.userId);

			const res = await fetch(`${API_BASE}/api/photos`, {
				method: "POST",
				headers: {
					"X-User-Id": user.userId,
				},
				body: formData,
			});

			console.log("Response status:", res.status, res.statusText);
			console.log("Content-Type:", res.headers.get("content-type"));

			const responseText = await res.text();
			console.log("Response body:", responseText);

			let data;
			try {
				data = JSON.parse(responseText);
			} catch (e) {
				console.error("Failed to parse JSON:", e);
				data = { error: `Invalid response from server (not JSON). Status: ${res.status}. Body: ${responseText.substring(0, 200)}` };
			}

			if (res.ok) {
				// Hide success message; only show errors
				setResponse(null);
				setFiles([]);
				document.getElementById("file-input").value = "";
				fetchPhotos();
			} else {
				setResponse({ success: false, data });
			}
		} catch (error) {
			setResponse({
				success: false,
				data: { error: error.message || "Network error - could not reach server" },
			});
		} finally {
			setUploading(false);
		}
	};

	const handleProcessAll = async () => {
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

			// Any non-202 means we stop and inform the user (no detailed results UI)
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
	};

	const startPolling = () => {
		console.log("Starting polling");
		fetchStatus();
		pollIntervalRef.current = setInterval(fetchStatus, 1500);
		console.log("Polling interval started:", pollIntervalRef.current);
	};

	const fetchStatus = async () => {
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
					fetchPhotos();
				}
			}
		} catch (error) {
			console.error("Failed to fetch status:", error);
		}
	};

	const stopPolling = () => {
		if (pollIntervalRef.current) {
			console.log("Clearing interval:", pollIntervalRef.current);
			clearInterval(pollIntervalRef.current);
			pollIntervalRef.current = null;
		}
	};

	useEffect(() => {
		return () => {
			console.log("Cleanup - stopping polling");
			stopPolling();
			stopAnalysisPolling();
		};
	}, []);

	const handleLogout = () => {
		logout();
		navigate("/");
	};

	const handleClearAll = async () => {
		const confirmed = window.confirm("Are you sure you want to delete all uploaded photos?");
		if (!confirmed) return;

		try {
			const res = await fetch(`${API_BASE}/api/photos`, {
				method: "DELETE",
				headers: {
					"X-User-Id": user.userId,
				},
			});

			if (res.ok) {
				const data = await res.json();

				Object.values(imageUrls).forEach((url) => URL.revokeObjectURL(url));
				setImageUrls({});
				setPhotos([]);
				setProcessingStatus([]);
				setAnalysisResults(null);
				setShowAnalysis(false);
				setAnalysisProgress({ currentPhoto: 0, totalPhotos: 0, status: "idle" });
				setAnalysisDetails([]);
				setAnalysisCounters({ photos_found: 0, photos_started: 0, photos_completed: 0, photos_failed: 0, photos_fallback: 0, photos_queued: 0 });
			} else {
				const data = await res.json();
				alert(`Delete failed: ${data.error || "Unknown error"}`);
			}
		} catch (error) {
			alert(`Network error: ${error.message}`);
		}
	};

	const getStatusBadgeClass = (status) => {
		switch (status) {
			case "done":
				return "status-badge done";
			case "error":
				return "status-badge error";
			case "processing":
				return "status-badge processing";
			case "extracting":
				return "status-badge extracting";
			case "received":
				return "status-badge received";
			default:
				return "status-badge uploaded";
		}
	};

	const getStatusLabel = (status) => {
		switch (status) {
			case "done":
				return "✓ Done";
			case "error":
				return "✗ Error";
			case "processing":
				return "⏳ Processing...";
			case "extracting":
				return "🔍 Extracting text...";
			case "received":
				return "📨 Received";
			default:
				return "📤 Uploaded";
		}
	};

	const getProgressPercentage = () => {
		if (processingStatus.length === 0) return 0;
		const completed = processingStatus.filter((p) => p.status === "done" || p.status === "error").length;
		return Math.round((completed / processingStatus.length) * 100);
	};

	const getAnalysisProgressPercentage = () => {
		// Prefer per-photo statuses for smoother progress (25/50/75 style)
		// We convert each status into a stage score (0..1) and average across photos.
		const stageScore = (status) => {
			switch (status) {
				case "pending":
					return 0.0;
				case "queued":
					return 0.25;
				case "processing":
					return 0.25; // blijft 25 tot we effectief naar llm gaan
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

		// If we have detailed statuses, compute a weighted/continuous progress.
		if (Array.isArray(analysisDetails) && analysisDetails.length > 0) {
			const total = analysisDetails.length;
			let sum = 0;
			for (const p of analysisDetails) {
				sum += stageScore(p?.analysisStatus);
			}
			const pct = Math.round((sum / total) * 100);
			return Math.max(0, Math.min(100, pct));
		}

		// Fallback: if details aren't available yet, use counters.
		const found = Number(analysisCounters?.photos_found || 0);
		const started = Number(analysisCounters?.photos_started || 0);
		const total = found || started || 0;
		if (!total) return 0;

		const processed = Number(analysisCounters?.photos_completed || 0) + Number(analysisCounters?.photos_failed || 0) + Number(analysisCounters?.photos_fallback || 0);

		// If we know analysis started but we don't have details yet, show early progress.
		if (started > 0 && processed === 0) {
			// roughly represents "queued/started" stage
			return 20;
		}

		return Math.max(0, Math.min(100, Math.round((processed / total) * 100)));
	};

	const getAnalysisStatusLabel = (status) => {
		switch (status) {
			case "completed":
				return "✓ Processed";
			case "llm_failed":
				return "✗ LLM failed";
			case "fallback_used":
				return "⚠ Fallback used";
			case "processing":
				return "⏳ Processing...";
			case "sent_to_llm":
				return "🤖 Sent to LLM";
			case "queued":
				return "📋 Queued";
			case "pending":
				return "⏸️ Pending";
			default:
				return "❓ Unknown";
		}
	};

	const getAnalysisStatusClass = (status) => {
		switch (status) {
			case "completed":
				return "analysis-status completed";
			case "llm_failed":
				return "analysis-status failed";
			case "fallback_used":
				return "analysis-status fallback";
			case "processing":
				return "analysis-status processing";
			case "sent_to_llm":
				return "analysis-status sent";
			case "queued":
				return "analysis-status queued";
			case "pending":
				return "analysis-status pending";
			default:
				return "analysis-status unknown";
		}
	};

	const startAnalysisPolling = () => {
		console.log("Starting analysis progress polling");
		fetchAnalysisProgress();
		analysisPollIntervalRef.current = setInterval(fetchAnalysisProgress, 2000);
	};

	const stopAnalysisPolling = () => {
		if (analysisPollIntervalRef.current) {
			console.log("Clearing analysis polling interval");
			clearInterval(analysisPollIntervalRef.current);
			analysisPollIntervalRef.current = null;
		}
	};

	const fetchAnalysisProgress = async () => {
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

				// Keep the top button/label progress in sync with real counters
				setAnalysisProgress((prev) => {
					// If user clicked Analyze, we stay in an "active" state until the final /analyze response returns,
					// but we can show "finalizing" when all photos are processed.
					const nextStatus = started > 0 && processed >= started ? "finalizing" : "analyzing";
					return {
						...prev,
						currentPhoto: processed,
						totalPhotos: started || prev.totalPhotos || 0,
						status: prev.status === "complete" || prev.status === "error" ? prev.status : nextStatus,
					};
				});

				// Keep polling until the final /analyze response comes back.
				// When all photos are processed we switch UI to "finalizing" but we don't stop polling.
				if (started > 0 && processed >= started) {
					console.log("All photos processed - waiting for final JSON (finalizing)");
				}
			}
		} catch (error) {
			console.error("Failed to fetch analysis progress:", error);
		}
	};

	const handleAnalyze = async () => {
		//prevent multiple simultaneous requests
		if (analyzing) {
			console.log("Analysis already in progress, ignoring click");
			return;
		}

		setAnalyzing(true);
		setShowAnalysisModal(true);
		setAnalysisResults(null);
		setAnalysisProgress({ currentPhoto: 0, totalPhotos: 0, status: "analyzing" });
		setAnalysisDetails([]);
		setAnalysisCounters({ photos_found: 0, photos_started: 0, photos_completed: 0, photos_failed: 0, photos_fallback: 0, photos_queued: 0 });

		// Start real-time progress polling
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

			// Debug logging
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

				// Update counters from final response
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
					// More specific error for no photos
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
	};

	const canAnalyze = photos.length > 0 && photos.every((photo) => photo.status === "done");
	// Support both legacy analysis JSON and the new required schema:
	// {
	//   user: { short_summary: string },
	//   admin: { ...dashboard stats... }
	// }
	const details = analysisResults?.details || null;
	const isNewSchema = !!(details && typeof details === "object" && details.user && details.admin);
	const userShortSummary = analysisResults?.summary || details?.user?.short_summary || details?.short_summary || "";
	const analysisStarted = Number(analysisCounters?.photos_started || 0);
	const analysisFound = Number(analysisCounters?.photos_found || 0);
	const analysisTotalForUi = analysisFound || analysisStarted || (Array.isArray(analysisDetails) ? analysisDetails.length : 0) || 0;

	const analysisProcessedForUi = Number(analysisCounters?.photos_completed || 0) + Number(analysisCounters?.photos_failed || 0) + Number(analysisCounters?.photos_fallback || 0);

	const analysisPctForUi = getAnalysisProgressPercentage();

	return (
		<div className="dashboard">
			{showProcessingModal && (
				<div className="processing-modal-overlay">
					<div className="processing-modal">
						<h2>Processing photos</h2>
						<div className="progress-container">
							<div className="progress-bar">
								<div className="progress-fill" style={{ width: `${getProgressPercentage()}%` }}></div>
							</div>
							<div className="progress-text">{getProgressPercentage()}%</div>
						</div>
						<div className="processing-status-list">
							{processingStatus.map((photo, index) => (
								<div key={photo.id} className="processing-status-item">
									<span className="status-filename">
										Photo {index + 1}: {photo.originalFilename}
									</span>
									<span className={getStatusBadgeClass(photo.status)}>{getStatusLabel(photo.status)}</span>
								</div>
							))}
						</div>
					</div>
				</div>
			)}

			{showAnalysisModal && (
				<div className="processing-modal-overlay">
					<div className="processing-modal">
						<h2>Run analysis</h2>

						<div className="progress-container">
							<div className="progress-bar">
								<div className="progress-fill" style={{ width: `${getAnalysisProgressPercentage()}%` }}></div>
							</div>
							<div className="progress-text">{getAnalysisProgressPercentage()}%</div>
						</div>

						<div className="processing-modal-note">Analysis may take time. Progress is shown per photo below.</div>

						<div style={{ marginTop: "0.5rem", fontSize: "0.9rem", color: "#bbb" }}>
							{(() => {
								const started = Number(analysisCounters?.photos_started || 0);
								const found = Number(analysisCounters?.photos_found || 0);
								const completed = Number(analysisCounters?.photos_completed || 0);
								const failed = Number(analysisCounters?.photos_failed || 0);
								const fallback = Number(analysisCounters?.photos_fallback || 0);

								const processedFromCounters = completed + failed + fallback;

								// Prefer per-photo statuses for the UI (more accurate in real time)
								const list = Array.isArray(analysisDetails) ? analysisDetails : [];
								const statuses = list.map((p) => p?.analysisStatus).filter(Boolean);

								const total = list.length > 0 ? list.length : started || found || 0;
								if (!total) return "Starting…";

								const doneCountFromStatuses = statuses.filter((s) => ["completed", "fallback_used", "llm_failed", "error"].includes(s)).length;
								const inProgressCountFromStatuses = statuses.filter((s) => ["queued", "processing", "sent_to_llm", "finalizing"].includes(s)).length;

								// If we have statuses, use them. Otherwise fall back to counters.
								const doneCount = statuses.length ? doneCountFromStatuses : processedFromCounters;
								const activeCount = statuses.length ? doneCountFromStatuses + inProgressCountFromStatuses : processedFromCounters;

								const hasFinalizing = analysisProgress.status === "finalizing" || statuses.includes("finalizing") || (started > 0 && processedFromCounters >= started);

								const phase = hasFinalizing ? "Finalizing" : statuses.includes("sent_to_llm") ? "Sent to LLM" : statuses.includes("processing") ? "Processing" : statuses.includes("queued") ? "Queued" : started > 0 ? "Processing" : "Starting";

								if (hasFinalizing) {
									return `Finalizing result… (${activeCount}/${total})`;
								}

								return `${phase} • ${activeCount}/${total} • done: ${completed} • fallback: ${fallback} • failed: ${failed}`;
							})()}
						</div>

						<div className="processing-status-list" style={{ marginTop: "1rem" }}>
							{(analysisDetails || []).map((photo, index) => (
								<div key={photo.id || index} className="processing-status-item">
									<span className="status-filename">
										Photo {index + 1}: {photo.filename || `Photo ${index + 1}`}
									</span>
									<span className={getAnalysisStatusClass(photo.analysisStatus)}>{getAnalysisStatusLabel(photo.analysisStatus)}</span>
								</div>
							))}
							{(!analysisDetails || analysisDetails.length === 0) && <div style={{ color: "#888", fontSize: "0.9rem" }}>Waiting for analysis progress…</div>}
						</div>
					</div>
				</div>
			)}

			{/* Primary Navigation Bar (same structure as Admin) */}
			<div className="admin-nav">
				<div className="admin-nav-left">
					<h1>User Dashboard</h1>
				</div>

				<div className="admin-nav-middle">
					<div className="user-email">{user?.email || "unknown"}</div>
				</div>

				<div className="admin-nav-right">
					<button className="logout-btn" onClick={handleLogout}>
						Logout
					</button>
				</div>
			</div>

			<div className="dashboard-columns">
				<div className="upload-card">
					<h2>Upload images</h2>
					<form onSubmit={handleUpload} className="upload-form">
						<label className="file-input-label">
							<input id="file-input" type="file" multiple accept="image/*" onChange={handleFileChange} className="file-input" />
							<span className="file-input-text">{files.length > 0 ? `${files.length} file(s) selected` : "Choose files"}</span>
						</label>

						{files.length > 0 && (
							<div className="file-list">
								{files.map((file, index) => (
									<div key={index} className="file-item">
										📄 {file.name}
									</div>
								))}
							</div>
						)}

						<label className="location-optin-label">
							<input type="checkbox" checked={locationOptIn} onChange={(e) => setLocationOptIn(e.target.checked)} className="location-optin-checkbox" />
							<span>Include GPS location data (if available in photos)</span>
						</label>

						<button type="submit" className="upload-btn" disabled={uploading || files.length === 0}>
							{uploading ? "Uploading..." : "Upload"}
						</button>
					</form>

					{response && !response.success && (
						<div className="response-box error">
							<h3>Error</h3>
							<pre>{JSON.stringify(response.data, null, 2)}</pre>
						</div>
					)}
				</div>

				<div className="photos-section">
					<h2>Your photos ({photos.length})</h2>
					{loadingPhotos ? (
						<div className="loading-photos">Loading...</div>
					) : photos.length === 0 ? (
						<div className="no-photos">No photos uploaded yet</div>
					) : (
						<div className="photos-grid">
							{photos.map((photo) => (
								<div key={photo.id} className="photo-card">
									{imageUrls[photo.id] ? <img src={imageUrls[photo.id]} alt={photo.filename} className="photo-thumbnail" /> : <div className="photo-thumbnail-loading">Laden...</div>}
									<div className="photo-info">
										<div className="photo-filename">{photo.originalFilename}</div>
										<div className="photo-size">{(photo.size / 1024).toFixed(1)} KB</div>
										<div className={getStatusBadgeClass(photo.status)}>{getStatusLabel(photo.status)}</div>
										{photo.errorMessage && (
											<div className="photo-error-message">
												<strong>Error:</strong> {photo.errorMessage}
											</div>
										)}
									</div>
								</div>
							))}
						</div>
					)}

					<div className="photos-actions">
						<button className="next-btn" onClick={handleProcessAll} disabled={processing || photos.length === 0}>
							{processing ? "Extracting..." : "Extract"}
						</button>

						<button className="analyze-btn" onClick={handleAnalyze} disabled={analyzing || !canAnalyze}>
							{analyzing ? (
								<>
									<span className="loading-spinner">⟳</span>
									<span>
										Analyzing...
										{analysisTotalForUi ? ` (${analysisProcessedForUi}/${analysisTotalForUi}) • ${analysisPctForUi}%` : ""}
									</span>
								</>
							) : (
								"Analyze"
							)}
						</button>

						<button className="clear-btn" onClick={handleClearAll} disabled={processing || photos.length === 0}>
							Clear all
						</button>
					</div>

					{/* Explanation for why analyze is disabled */}
					{!canAnalyze && !analyzing && photos.length > 0 && (
						<div style={{ marginTop: "0.5rem", fontSize: "0.85rem", color: "#ff9800" }}>⚠️ Analysis requires photos to have completed text extraction (status: "✓ Done"). Click "Extract" to process photos first.</div>
					)}

					{!canAnalyze && !analyzing && photos.length === 0 && <div style={{ marginTop: "0.5rem", fontSize: "0.85rem", color: "#888" }}>Upload photos and click "Extract" to enable analysis.</div>}

					{showAnalysis && analysisResults && (
						<div className="analysis-section">
							{analysisResults.error ? (
								<div className="error-message">
									<h3>❌ Analysis Error</h3>
									<p>{analysisResults.error}</p>
									{analysisResults.details && analysisResults.details.raw_output && (
										<details style={{ marginTop: "1rem" }}>
											<summary>🔍 Raw Model Output</summary>
											<pre
												style={{
													background: "#1a1a1a",
													border: "1px solid #333",
													borderRadius: "8px",
													padding: "1rem",
													marginTop: "0.5rem",
													color: "#fff",
													fontSize: "0.9rem",
													whiteSpace: "pre-wrap",
													overflow: "auto",
													maxHeight: "300px",
												}}
											>
												{analysisResults.details.raw_output}
											</pre>
										</details>
									)}
								</div>
							) : (
								<>
									<h3>Important things to remember</h3>
									<div className="analysis-summary">
										<p className="summary-text">{userShortSummary || "No summary available."}</p>
									</div>
								</>
							)}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
