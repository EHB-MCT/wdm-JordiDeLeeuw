import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import "./Dashboard.css";

const API_BASE = "";

export function Dashboard() {
	const { user, logout } = useAuth();
	const navigate = useNavigate();
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
	const pollIntervalRef = useRef(null);
	const renderCountRef = useRef(0);

	renderCountRef.current += 1;
	console.log(`Dashboard render #${renderCountRef.current}`, { isProcessing, processingStatusLength: processingStatus.length });

	useEffect(() => {
		fetchPhotos();
		return () => {
			Object.values(imageUrls).forEach(url => URL.revokeObjectURL(url));
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
				
				setPhotos(prev => {
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
					setImageUrls(prev => {
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
				setImageUrls(prev => ({ ...prev, [photoId]: url }));
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
				
				setProcessingStatus(prev => {
					const prevStatusString = JSON.stringify(prev);
					const newStatusString = JSON.stringify(newStatus);
					
					if (prevStatusString !== newStatusString) {
						console.log("Processing status updated");
						return newStatus;
					}
					return prev;
				});

				const allDone = newStatus.every(p => p.status === "done" || p.status === "error");
				const hasProcessing = newStatus.some(p => p.status === "received" || p.status === "extracting");

				console.log("Poll check:", { allDone, hasProcessing, total: newStatus.length });

				if (allDone && !hasProcessing) {
					console.log("All photos complete - stopping polling");
					stopPolling();
					setProcessing(false);
					setIsProcessing(false);
					setShowProcessingModal(false);
					setProcessResults({
						processedCount: newStatus.length,
						successCount: newStatus.filter(p => p.status === "done").length,
						errorCount: newStatus.filter(p => p.status === "error").length,
						results: newStatus.map(p => ({
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
				
				Object.values(imageUrls).forEach(url => URL.revokeObjectURL(url));
				setImageUrls({});
				setPhotos([]);
				setProcessResults(null);
				setProcessingStatus([]);
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
			case "done": return "status-badge done";
			case "error": return "status-badge error";
			case "processing": return "status-badge processing";
			case "extracting": return "status-badge extracting";
			case "received": return "status-badge received";
			default: return "status-badge uploaded";
		}
	};

	const getStatusLabel = (status) => {
		switch (status) {
			case "done": return "✓ Klaar";
			case "error": return "✗ Fout";
			case "processing": return "⏳ Verwerken...";
			case "extracting": return "🔍 Tekst extraheren...";
			case "received": return "📨 Ontvangen";
			default: return "📤 Geüpload";
		}
	};

	const getProgressPercentage = () => {
		if (processingStatus.length === 0) return 0;
		const completed = processingStatus.filter(p => p.status === "done" || p.status === "error").length;
		return Math.round((completed / processingStatus.length) * 100);
	};

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
									<span className="status-filename">Foto {index + 1}: {photo.filename}</span>
									<span className={getStatusBadgeClass(photo.status)}>
										{getStatusLabel(photo.status)}
									</span>
								</div>
							))}
						</div>
					</div>
				</div>
			)}

			<div className="dashboard-header">
				<h1>User Dashboard</h1>
				<div className="profile-menu">
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
						<input
							id="file-input"
							type="file"
							multiple
							accept="image/*"
							onChange={handleFileChange}
							className="file-input"
						/>
						<span className="file-input-text">
							{files.length > 0 ? `${files.length} bestand(en) geselecteerd` : "Kies bestanden"}
						</span>
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
						<input 
							type="checkbox" 
							checked={locationOptIn} 
							onChange={(e) => setLocationOptIn(e.target.checked)}
							className="location-optin-checkbox"
						/>
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
								{imageUrls[photo.id] ? (
									<img
										src={imageUrls[photo.id]}
										alt={photo.filename}
										className="photo-thumbnail"
									/>
								) : (
									<div className="photo-thumbnail-loading">Laden...</div>
								)}
								<div className="photo-info">
									<div className="photo-filename">{photo.filename}</div>
									<div className="photo-size">{(photo.size / 1024).toFixed(1)} KB</div>
									<div className={getStatusBadgeClass(photo.status)}>
										{getStatusLabel(photo.status)}
									</div>
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

				<button 
					className="clear-btn" 
					onClick={handleClearAll} 
					disabled={processing || photos.length === 0}
				>
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
			</div>
		</div>
	);
}
