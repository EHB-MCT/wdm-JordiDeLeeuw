export function getPhotoStatusBadgeClass(status) {
	// Bepaal de CSS-klasse voor de foto-status badge
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
}

export function getPhotoStatusLabel(status) {
	// Geef een leesbaar label voor de foto-status
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
}

export function getAnalysisStatusLabel(status) {
	// Geef een leesbaar label voor de analyse-status
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
}

export function getAnalysisStatusClass(status) {
	// Bepaal de CSS-klasse voor de analyse-status
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
}
