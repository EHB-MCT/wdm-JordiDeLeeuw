export function ProcessingModal({ open, progressPercent, processingStatus, getStatusBadgeClass, getStatusLabel }) {
	// Render niets als de modal niet open is
	if (!open) return null;

	return (
		<div className="processing-modal-overlay">
			<div className="processing-modal">
				<h2>Processing photos</h2>
				{/* Progress bar */}
				<div className="progress-container">
					<div className="progress-bar">
						<div className="progress-fill" style={{ width: `${progressPercent}%` }}></div>
					</div>
					<div className="progress-text">{progressPercent}%</div>
				</div>
				{/* Statuslijst per foto */}
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
	);
}
