import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import "./Dashboard.css";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5050";

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
				setPhotos(photosList);

				for (const photo of photosList) {
					fetchImageBlob(photo.id);
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

			const res = await fetch(`${API_BASE}/api/photos`, {
				method: "POST",
				headers: {
					"X-User-Id": user.userId,
				},
				body: formData,
			});

			let data;
			try {
				data = await res.json();
			} catch {
				data = { error: "Invalid response from server" };
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

	const handleLogout = () => {
		logout();
		navigate("/");
	};

	return (
		<div className="dashboard">
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
								</div>
							</div>
						))}
					</div>
				)}

				<button className="next-btn">Next</button>
			</div>
		</div>
	);
}
