export function UploadCard({
	files,
	uploading,
	response,
	locationOptIn,
	onFileChange,
	onUpload,
	onClearFiles,
	onLocationOptInChange,
}) {
	return (
		<div className="upload-card">
			{/* Upload form voor afbeeldingen */}
			<h2>Upload images</h2>
			<form onSubmit={onUpload} className="upload-form">
				<label className="file-input-label">
					<input id="file-input" type="file" multiple accept="image/*" onChange={onFileChange} className="file-input" />
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

				<div style={{ marginTop: "0.5rem", fontSize: "0.85rem", color: "#888" }}>
					For best summary and fastest results, limit to 3 images at a time max.
				</div>

				<label className="location-optin-label">
					<input type="checkbox" checked={locationOptIn} onChange={onLocationOptInChange} className="location-optin-checkbox" />
					<span>Include GPS location data (if available in photos)</span>
				</label>

				<div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
					<button type="submit" className="upload-btn" disabled={uploading || files.length === 0}>
						{uploading ? "Uploading..." : "Upload"}
					</button>
					<button type="button" className="clear-btn" onClick={onClearFiles} disabled={uploading || files.length === 0}>
						Cancel selection
					</button>
				</div>
			</form>

			{/* Toon foutmelding indien upload faalt */}
			{response && !response.success && (
				<div className="response-box error">
					<h3>Error</h3>
					<pre>{JSON.stringify(response.data, null, 2)}</pre>
				</div>
			)}
		</div>
	);
}
