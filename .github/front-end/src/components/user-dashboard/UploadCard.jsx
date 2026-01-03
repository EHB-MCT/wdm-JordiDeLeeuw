export function UploadCard({
	files,
	uploading,
	response,
	locationOptIn,
	onFileChange,
	onUpload,
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

				<label className="location-optin-label">
					<input type="checkbox" checked={locationOptIn} onChange={onLocationOptInChange} className="location-optin-checkbox" />
					<span>Include GPS location data (if available in photos)</span>
				</label>

				<button type="submit" className="upload-btn" disabled={uploading || files.length === 0}>
					{uploading ? "Uploading..." : "Upload"}
				</button>
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
