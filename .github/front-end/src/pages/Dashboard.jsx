import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/UserDashboard.css";
import { UserDashboardNav } from "../components/user-dashboard/UserDashboardNav";
import { ProcessingModal } from "../components/user-dashboard/ProcessingModal";
import { AnalysisModal } from "../components/user-dashboard/AnalysisModal";
import { UploadCard } from "../components/user-dashboard/UploadCard";
import { PhotosSection } from "../components/user-dashboard/PhotosSection";
import { usePhotos } from "../hooks/user-dashboard/usePhotos";
import { useProcessing } from "../hooks/user-dashboard/useProcessing";
import { useAnalysis } from "../hooks/user-dashboard/useAnalysis";
import { getPhotoStatusBadgeClass, getPhotoStatusLabel, getAnalysisStatusClass, getAnalysisStatusLabel } from "../utils/userDashboardStatus";
// OBOE_EDIT_TEST: connectivity check (write test 2)

export function Dashboard() {
	const { user, logout } = useAuth();
	const navigate = useNavigate();

	// Redirect admins to admin dashboard
	useEffect(() => {
		if (user?.isAdmin) {
			navigate("/admin", { replace: true });
		}
	}, [user, navigate]);
	const {
		// Upload + foto state en handlers
		files,
		uploading,
		response,
		photos,
		loadingPhotos,
		imageUrls,
		locationOptIn,
		setLocationOptIn,
		fetchPhotos,
		handleFileChange,
		handleUpload,
		clearAllPhotos,
	} = usePhotos({ user });

	const { processing, showProcessingModal, processingStatus, handleProcessAll, getProgressPercentage } = useProcessing({
		// OCR-verwerking status en handlers
		user,
		onComplete: fetchPhotos,
	});

	const {
		// Analyse state en handlers
		analyzing,
		showAnalysisModal,
		analysisResults,
		showAnalysis,
		analysisProgress,
		analysisDetails,
		analysisCounters,
		analysisTotalForUi,
		analysisProcessedForUi,
		analysisPctForUi,
		userShortSummary,
		handleAnalyze,
		resetAnalysisState,
	} = useAnalysis({ user });

	const handleLogout = () => {
		// Uitloggen en terug naar login
		logout();
		navigate("/");
	};

	const handleClearAll = async () => {
		// Verwijder alle foto's na bevestiging
		const confirmed = window.confirm("Are you sure you want to delete all uploaded photos?");
		if (!confirmed) return;
		const result = await clearAllPhotos();
		if (!result.ok) {
			alert(`Delete failed: ${result.error || "Unknown error"}`);
			return;
		}
		resetAnalysisState();
	};

	// Alleen analyseren als alle foto's OCR "done" hebben
	const canAnalyze = photos.length > 0 && photos.every((photo) => photo.status === "done");

	return (
		<div className="dashboard">
			<ProcessingModal
				open={showProcessingModal}
				progressPercent={getProgressPercentage()}
				processingStatus={processingStatus}
				getStatusBadgeClass={getPhotoStatusBadgeClass}
				getStatusLabel={getPhotoStatusLabel}
			/>
			<AnalysisModal
				open={showAnalysisModal}
				progressPercent={analysisPctForUi}
				analysisDetails={analysisDetails}
				analysisCounters={analysisCounters}
				analysisProgress={analysisProgress}
				getAnalysisStatusClass={getAnalysisStatusClass}
				getAnalysisStatusLabel={getAnalysisStatusLabel}
			/>
			<UserDashboardNav email={user?.email} onLogout={handleLogout} />

			<div className="dashboard-columns">
				<UploadCard
					files={files}
					uploading={uploading}
					response={response}
					locationOptIn={locationOptIn}
					onFileChange={handleFileChange}
					onUpload={handleUpload}
					onLocationOptInChange={(e) => setLocationOptIn(e.target.checked)}
				/>
				<PhotosSection
					photos={photos}
					loadingPhotos={loadingPhotos}
					imageUrls={imageUrls}
					processing={processing}
					analyzing={analyzing}
					canAnalyze={canAnalyze}
					analysisTotalForUi={analysisTotalForUi}
					analysisProcessedForUi={analysisProcessedForUi}
					analysisPctForUi={analysisPctForUi}
					onProcessAll={handleProcessAll}
					onAnalyze={handleAnalyze}
					onClearAll={handleClearAll}
					getStatusBadgeClass={getPhotoStatusBadgeClass}
					getStatusLabel={getPhotoStatusLabel}
					showAnalysis={showAnalysis}
					analysisResults={analysisResults}
					userShortSummary={userShortSummary}
				/>
			</div>
		</div>
	);
}
