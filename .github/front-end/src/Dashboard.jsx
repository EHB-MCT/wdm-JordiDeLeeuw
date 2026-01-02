import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import "./Dashboard.css";

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
	const [showProfileMenu, setShowProfileMenu] = useState(false);
	const [photos, setPhotos] = useState([]);
	const [loadingPhotos, setLoadingPhotos] = useState(true);
	const [imageUrls, setImageUrls] = useState({});
	const [processing, setProcessing] = useState(false);
	const [processResults, setProcessResults] = useState(null);
	const [showProcessingModal, setShowProcessingModal] = useState(false);
	const [processingStatus, setProcessingStatus] = useState([]);
	const [isProcessing, setIsProcessing] = useState(false);
	const [locationOptIn, setLocationOptIn] = useState(false);
	const [analyzing, setAnalyzing] = useState(false);
	const [analysisResults, setAnalysisResults] = useState(null);
	const [showAnalysis, setShowAnalysis] = useState(false);
	const [analysisProgress, setAnalysisProgress] = useState({ currentPhoto: 0, totalPhotos: 0, status: 'idle' });
	const [analysisDetails, setAnalysisDetails] = useState([]);
	const [analysisCounters, setAnalysisCounters] = useState({ photos_found: 0, photos_started: 0, photos_completed: 0, photos_failed: 0, photos_fallback: 0, photos_queued: 0 });
	const pollIntervalRef = useRef(null);
	const analysisPollIntervalRef = useRef(null);
	const renderCountRef = useRef(0);

	renderCountRef.current += 1;
	console.log(`Dashboard render #${renderCountRef.current}`, { isProcessing, processingStatusLength: processingStatus.length });

	useEffect(() => {
		fetchPhotos();
		fetchAnalysis();
		return () => {
			Object.values(imageUrls).forEach((url) => URL.revokeObjectURL(url));
		};
	}, []);

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
					setImageUrls((prev) => {
						if (!prev[photo.id]) {
							fetchImageBlob(photo.id);
						}
						return prev;
					});
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
			setResponse({ success: false, data: { error: "Selecteer minstens één bestand" } });
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
				setResponse({ success: true, data });
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
		setIsProcessing(true);
		setProcessResults(null);
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
				const data = await res.json();
				console.log("Processing started, beginning to poll");
				startPolling();
			} else if (res.status === 400) {
				const data = await res.json();
				setProcessResults({ error: data.error || "Geen foto's om te verwerken" });
				setProcessing(false);
				setIsProcessing(false);
				setShowProcessingModal(false);
			} else {
				const data = await res.json();
				setProcessResults({ error: data.error || "Processing failed" });
				setProcessing(false);
				setIsProcessing(false);
				setShowProcessingModal(false);
			}
		} catch (error) {
			setProcessResults({ error: error.message || "Network error" });
			setProcessing(false);
			setIsProcessing(false);
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
					setIsProcessing(false);
					setShowProcessingModal(false);
					setProcessResults({
						processedCount: newStatus.length,
						successCount: newStatus.filter((p) => p.status === "done").length,
						errorCount: newStatus.filter((p) => p.status === "error").length,
						results: newStatus.map((p) => ({
							photoId: p.id,
							filename: p.filename,
							status: p.status,
							extractedText: p.extractedText,
							errorMessage: p.errorMessage,
						})),
					});
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
		const confirmed = window.confirm("Weet je zeker dat je alle geüploade foto's wilt verwijderen?");
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
				setProcessResults(null);
				setProcessingStatus([]);
                setAnalysisResults(null);
                setShowAnalysis(false);
                setAnalysisProgress({ currentPhoto: 0, totalPhotos: 0, status: 'idle' });
                setAnalysisDetails([]);
                setAnalysisCounters({ photos_found: 0, photos_started: 0, photos_completed: 0, photos_failed: 0, photos_fallback: 0, photos_queued: 0 });
			} else {
				const data = await res.json();
				alert(`Fout bij verwijderen: ${data.error || "Onbekende fout"}`);
			}
		} catch (error) {
			alert(`Netwerkfout: ${error.message}`);
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
				return "✓ Klaar";
			case "error":
				return "✗ Fout";
			case "processing":
				return "⏳ Verwerken...";
			case "extracting":
				return "🔍 Tekst extraheren...";
			case "received":
				return "📨 Ontvangen";
			default:
				return "📤 Geüpload";
		}
	};

	const getProgressPercentage = () => {
		if (processingStatus.length === 0) return 0;
		const completed = processingStatus.filter((p) => p.status === "done" || p.status === "error").length;
		return Math.round((completed / processingStatus.length) * 100);
	};

	const getAnalysisStatusLabel = (status) => {
		switch (status) {
			case "completed":
				return "✓ Completed";
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

	const fetchAnalysis = async () => {
		try {
			const res = await fetch(`${API_BASE}/api/photos/summary`, {
				headers: {
					"X-User-Id": user.userId,
				},
			});

			if (res.ok) {
				const data = await res.json();
				setAnalysisResults(data);
				setShowAnalysis(true);
			} else if (res.status !== 404) {
				console.error("Failed to fetch analysis");
			}
		} catch (error) {
			console.error("Failed to fetch analysis:", error);
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
				
				// Auto-stop polling when all photos are processed
				const totalProcessed = data.counters.photos_completed + data.counters.photos_failed + data.counters.photos_fallback;
				if (totalProcessed > 0 && totalProcessed === data.counters.photos_started) {
					console.log("Analysis complete - stopping polling");
					stopAnalysisPolling();
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
		setAnalysisResults(null);
		setAnalysisProgress({ currentPhoto: 0, totalPhotos: photos.length, status: 'analyzing' });
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
				setAnalysisProgress({ currentPhoto: data.analyzedPhotos, totalPhotos: data.analyzedPhotos, status: 'complete' });
				
				// Update counters from final response
				if (data.progress) {
					setAnalysisCounters(data.progress);
				}
			} else {
				setAnalysisProgress({ currentPhoto: 0, totalPhotos: 0, status: 'error' });
				stopAnalysisPolling();
				if (res.status === 429) {
					alert(`Please wait: ${data.error || "Analysis already in progress"}`);
				} else if (res.status === 400) {
					// More specific error for no photos
					if (data.error && data.error.includes("No photos with completed OCR")) {
						alert("No photos with extracted text found. Please make sure photos have been processed (Next button) before analyzing.");
					} else {
						alert(`Analyse mislukt: ${data.error || "Onbekende fout"}`);
					}
				} else {
					alert(`Analyse mislukt: ${data.error || "Onbekende fout"}`);
				}
			}
		} catch (error) {
			console.error("Failed to fetch analysis:", error);
			setAnalysisProgress({ currentPhoto: 0, totalPhotos: 0, status: 'error' });
			stopAnalysisPolling();
			alert(`Netwerkfout: ${error.message}`);
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
	const userShortSummary =
		analysisResults?.summary ||
		details?.user?.short_summary ||
		details?.short_summary ||
		"";

	return (
		<div className="dashboard">
			{showProcessingModal && (
				<div className="processing-modal-overlay">
					<div className="processing-modal">
						<h2>Foto&apos;s verwerken</h2>
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
										Foto {index + 1}: {photo.originalFilename}
									</span>
									<span className={getStatusBadgeClass(photo.status)}>{getStatusLabel(photo.status)}</span>
								</div>
							))}
						</div>
					</div>
				</div>
			)}

			<div className="dashboard-header">
				<h1>User Dashboard</h1>
				<div className="profile-menu">
					{user?.isAdmin && (
						<button 
							className="admin-link-btn" 
							onClick={() => navigate("/admin")}
							title="Admin Dashboard"
						>
							🛡️ Admin
						</button>
					)}
					<button className="profile-icon" onClick={() => setShowProfileMenu(!showProfileMenu)}>
						👤
					</button>
					{showProfileMenu && (
						<div className="profile-dropdown">
							<div className="profile-email">{user?.email}</div>
							<button className="logout-btn" onClick={handleLogout}>
								Uitloggen
							</button>
						</div>
					)}
				</div>
			</div>

			<div className="upload-card">
				<h2>Upload afbeeldingen</h2>
				<form onSubmit={handleUpload} className="upload-form">
					<label className="file-input-label">
						<input id="file-input" type="file" multiple accept="image/*" onChange={handleFileChange} className="file-input" />
						<span className="file-input-text">{files.length > 0 ? `${files.length} bestand(en) geselecteerd` : "Kies bestanden"}</span>
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
						{uploading ? "Uploaden..." : "Upload"}
					</button>
				</form>

				{response && (
					<div className={response.success ? "response-box success" : "response-box error"}>
						<h3>{response.success ? "Success" : "Error"}</h3>
						<pre>{JSON.stringify(response.data, null, 2)}</pre>
					</div>
				)}
			</div>

			<div className="photos-section">
				<h2>Je foto&apos;s ({photos.length})</h2>
				{loadingPhotos ? (
					<div className="loading-photos">Laden...</div>
				) : photos.length === 0 ? (
					<div className="no-photos">Nog geen foto&apos;s geüpload</div>
				) : (
					<div className="photos-grid">
						{photos.map((photo) => (
							<div key={photo.id} className="photo-card">
								{imageUrls[photo.id] ? <img src={imageUrls[photo.id]} alt={photo.filename} className="photo-thumbnail" /> : <div className="photo-thumbnail-loading">Laden...</div>}
								<div className="photo-info">
									<div className="photo-filename">{photo.originalFilename}</div>
									<div className="photo-size">{(photo.size / 1024).toFixed(1)} KB</div>
									<div className={getStatusBadgeClass(photo.status)}>{getStatusLabel(photo.status)}</div>
									{photo.extractedText && (
										<div className="photo-extracted-text">
											<strong>Gevonden tekst:</strong> {photo.extractedText}
										</div>
									)}
									{photo.errorMessage && (
										<div className="photo-error-message">
											<strong>Fout:</strong> {photo.errorMessage}
										</div>
									)}
								</div>
							</div>
						))}
					</div>
				)}

				<button className="next-btn" onClick={handleProcessAll} disabled={processing || photos.length === 0}>
					{processing ? "Verwerken..." : "Next"}
				</button>

				<button className="analyze-btn" onClick={handleAnalyze} disabled={analyzing || !canAnalyze}>
					{analyzing ? (
						<>
							<span className="loading-spinner">⟳</span>
							<span>Analyzing... {analysisProgress.status === 'analyzing' ? `(${analysisProgress.currentPhoto}/${analysisProgress.totalPhotos})` : ''}</span>
						</>
					) : "Analyze"}
				</button>

				{/* Explanation for why analyze is disabled */}
				{!canAnalyze && !analyzing && photos.length > 0 && (
					<div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#ff9800' }}>
						⚠️ Analysis requires photos to have completed text extraction (status: "✓ Klaar"). 
						Click "Next" to process photos first.
					</div>
				)}

				{!canAnalyze && !analyzing && photos.length === 0 && (
					<div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#888' }}>
						Upload photos and click "Next" to enable analysis.
					</div>
				)}

				{/* Analysis progress explanation */}
				{canAnalyze && !analyzing && (
					<div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#888' }}>
						Analysis may take time. Progress is shown per photo below.
					</div>
				)}
				
				{analysisProgress.status !== 'idle' && (
					<div className="analysis-progress" style={{ marginTop: '1rem', padding: '1rem', background: '#1a1a1a', borderRadius: '8px' }}>
						<h4>📸 Analysis Progress</h4>
						
						{/* Progress counters */}
						<div style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>
							<div><strong>{analysisCounters.photos_found} photos found</strong></div>
							<div>{analysisCounters.photos_started} photos started</div>
							<div style={{ color: '#4CAF50' }}>{analysisCounters.photos_completed} completed</div>
							<div style={{ color: '#ff9800' }}>{analysisCounters.photos_fallback} fallback</div>
							<div style={{ color: '#f44336' }}>{analysisCounters.photos_failed} failed</div>
							{analysisCounters.photos_queued > 0 && <div style={{ color: '#888' }}>{analysisCounters.photos_queued} queued</div>}
						</div>
						
						<div style={{ marginBottom: '0.5rem', fontSize: '0.9rem' }}>
							Status: <span style={{ 
								color: analysisProgress.status === 'complete' ? '#4CAF50' : 
										analysisProgress.status === 'error' ? '#f44336' : '#ff9800',
								fontWeight: 'bold'
							}}>
								{analysisProgress.status === 'analyzing' ? `Analyzing photo ${analysisProgress.currentPhoto} of ${analysisProgress.totalPhotos}...` :
								 analysisProgress.status === 'complete' ? 'Analysis complete!' :
									analysisProgress.status === 'error' ? 'Analysis failed' : 'Processing...'}
							</span>
						</div>
						
						{/* Progress bar */}
						{analysisProgress.status === 'analyzing' && analysisCounters.photos_started > 0 && (
							<div style={{ 
								marginTop: '1rem', 
								height: '4px', 
								background: '#333', 
								borderRadius: '2px',
								width: `${((analysisCounters.photos_completed + analysisCounters.photos_failed + analysisCounters.photos_fallback) / analysisCounters.photos_started) * 100}%`
							}} />
						)}

						{/* Per-photo status list */}
						{analysisDetails.length > 0 && (
							<div style={{ marginTop: '1rem' }}>
								<h5 style={{ marginBottom: '0.5rem', fontSize: '0.9rem' }}>Per-Photo Status:</h5>
								<div style={{ maxHeight: '200px', overflowY: 'auto' }}>
									{analysisDetails.map((photo, index) => (
										<div key={photo.id} style={{ 
											display: 'flex', 
											justifyContent: 'space-between', 
											alignItems: 'center',
											padding: '0.25rem 0',
											fontSize: '0.8rem',
											borderBottom: '1px solid #333'
										}}>
											<span style={{ color: '#ccc', marginRight: '0.5rem' }}>
												{photo.filename || `Photo ${index + 1}`}
											</span>
											<span className={getAnalysisStatusClass(photo.analysisStatus)} style={{
												fontSize: '0.75rem',
												padding: '2px 6px',
												borderRadius: '4px',
												background: photo.analysisStatus === 'completed' ? '#4CAF50' :
															 photo.analysisStatus === 'llm_failed' ? '#f44336' :
															 photo.analysisStatus === 'fallback_used' ? '#ff9800' :
															 photo.analysisStatus === 'processing' ? '#2196F3' :
															 photo.analysisStatus === 'sent_to_llm' ? '#9C27B0' :
															 photo.analysisStatus === 'queued' ? '#607D8B' : '#666'
											}}>
												{getAnalysisStatusLabel(photo.analysisStatus)}
											</span>
										</div>
									))}
								</div>
							</div>
						)}
					</div>
				)}

				{/* Analysis completion message */}
				{analysisProgress.status === 'complete' && (
					<div style={{ 
						marginTop: '1rem', 
						padding: '1rem', 
						background: '#1a3d1a', 
						border: '1px solid #4CAF50', 
						borderRadius: '8px',
						fontSize: '0.9rem'
					}}>
						{analysisCounters.photos_fallback > 0 || analysisCounters.photos_failed > 0 ? (
							<div>
								<strong>Analysis completed with issues:</strong> The system attempted analysis but 
								{analysisCounters.photos_fallback > 0 && ` ${analysisCounters.photos_fallback} photo(s) used fallback logic`}
								{analysisCounters.photos_fallback > 0 && analysisCounters.photos_failed > 0 && ' and'}
								{analysisCounters.photos_failed > 0 && ` ${analysisCounters.photos_failed} photo(s) failed`}.
								{analysisCounters.photos_fallback > 0 && (
									<div style={{ marginTop: '0.5rem', fontStyle: 'italic' }}>
										<strong>Important:</strong> The system attempted analysis but the model did not respond in time for some photos.
									</div>
								)}
							</div>
						) : (
							<div>
								<strong>Analysis completed successfully!</strong> All {analysisCounters.photos_completed} photos were processed without issues.
							</div>
						)}
					</div>
				)}

				<button className="clear-btn" onClick={handleClearAll} disabled={processing || photos.length === 0}>
					Clear list
				</button>

				{processResults && (
					<div className="process-results">
						<h3>Verwerkingsresultaten</h3>
						{processResults.error ? (
							<div className="error-message">{processResults.error}</div>
						) : (
							<>
								<div className="process-summary">
									<span>Verwerkt: {processResults.processedCount}</span>
									<span>Succes: {processResults.successCount}</span>
									<span>Fouten: {processResults.errorCount}</span>
								</div>
								<div className="results-list">
									{processResults.results.map((result, index) => (
										<div key={index} className={`result-item ${result.status}`}>
											<div className="result-filename">📄 {result.filename}</div>
											{result.extractedText && (
												<div className="result-text">
													<strong>Tekst:</strong> {result.extractedText}
												</div>
											)}
											{result.errorMessage && (
												<div className="result-error">
													<strong>Fout:</strong> {result.errorMessage}
												</div>
											)}
										</div>
									))}
								</div>
							</>
						)}
					</div>
				)}

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
								{/* Full JSON output for debugging */}
								<div className="detail-section">
									<h4>🔍 Complete Analysis Data</h4>
									<div
										style={{
											maxHeight: "400px",
											overflowY: "auto",
											background: "#1a1a1a",
											border: "1px solid #333",
											borderRadius: "8px",
											padding: "1rem",
											marginTop: "1rem",
										}}
									>
										<pre
											style={{
												color: "#fff",
												fontSize: "0.9rem",
												lineHeight: "1.4",
												margin: 0,
												whiteSpace: "pre-wrap",
												wordBreak: "break-word",
											}}
										>
											{JSON.stringify(details || analysisResults, null, 2)}
										</pre>
									</div>
								</div>
							</>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
