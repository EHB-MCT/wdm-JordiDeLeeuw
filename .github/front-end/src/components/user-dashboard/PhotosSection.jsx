export function PhotosSection({
	photos,
	loadingPhotos,
	imageUrls,
	processing,
	analyzing,
	canAnalyze,
	analysisTotalForUi,
	analysisProcessedForUi,
	analysisPctForUi,
	onProcessAll,
	onAnalyze,
	onClearAll,
	getStatusBadgeClass,
	getStatusLabel,
	showAnalysis,
	analysisResults,
	userShortSummary,
}) {
	return (
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
							{imageUrls[photo.id] ? (
								<img src={imageUrls[photo.id]} alt={photo.filename} className="photo-thumbnail" />
							) : (
								<div className="photo-thumbnail-loading">Laden...</div>
							)}
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
				<button className="next-btn" onClick={onProcessAll} disabled={processing || photos.length === 0}>
					{processing ? "Extracting..." : "Extract"}
				</button>

				<button className="analyze-btn" onClick={onAnalyze} disabled={analyzing || !canAnalyze}>
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

				<button className="clear-btn" onClick={onClearAll} disabled={processing || photos.length === 0}>
					Clear all
				</button>
			</div>

			{!canAnalyze && !analyzing && photos.length > 0 && (
				<div style={{ marginTop: "0.5rem", fontSize: "0.85rem", color: "#ff9800" }}>
					⚠️ Analysis requires photos to have completed text extraction (status: "✓ Done"). Click "Extract" to process photos first.
				</div>
			)}

			{!canAnalyze && !analyzing && photos.length === 0 && (
				<div style={{ marginTop: "0.5rem", fontSize: "0.85rem", color: "#888" }}>Upload photos and click "Extract" to enable analysis.</div>
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
						</>
					)}
				</div>
			)}
		</div>
	);
}
