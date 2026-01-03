export function AnalysisModal({
	open,
	progressPercent,
	analysisDetails,
	analysisCounters,
	analysisProgress,
	getAnalysisStatusClass,
	getAnalysisStatusLabel,
}) {
	if (!open) return null;

	return (
		<div className="processing-modal-overlay">
			<div className="processing-modal">
				<h2>Run analysis</h2>

				<div className="progress-container">
					<div className="progress-bar">
						<div className="progress-fill" style={{ width: `${progressPercent}%` }}></div>
					</div>
					<div className="progress-text">{progressPercent}%</div>
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

						const list = Array.isArray(analysisDetails) ? analysisDetails : [];
						const statuses = list.map((p) => p?.analysisStatus).filter(Boolean);

						const total = list.length > 0 ? list.length : started || found || 0;
						if (!total) return "Starting…";

						const doneCountFromStatuses = statuses.filter((s) => ["completed", "fallback_used", "llm_failed", "error"].includes(s)).length;
						const inProgressCountFromStatuses = statuses.filter((s) => ["queued", "processing", "sent_to_llm", "finalizing"].includes(s)).length;

						const doneCount = statuses.length ? doneCountFromStatuses : processedFromCounters;
						const activeCount = statuses.length ? doneCountFromStatuses + inProgressCountFromStatuses : processedFromCounters;

						const hasFinalizing =
							analysisProgress.status === "finalizing" || statuses.includes("finalizing") || (started > 0 && processedFromCounters >= started);

						const phase = hasFinalizing
							? "Finalizing"
							: statuses.includes("sent_to_llm")
								? "Sent to LLM"
								: statuses.includes("processing")
									? "Processing"
									: statuses.includes("queued")
										? "Queued"
										: started > 0
											? "Processing"
											: "Starting";

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
	);
}
