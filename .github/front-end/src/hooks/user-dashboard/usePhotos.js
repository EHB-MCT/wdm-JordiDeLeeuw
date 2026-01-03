import { useCallback, useEffect, useRef, useState } from "react";

const API_BASE = "";

export function usePhotos({ user }) {
	const [files, setFiles] = useState([]);
	const [uploading, setUploading] = useState(false);
	const [response, setResponse] = useState(null);
	const [photos, setPhotos] = useState([]);
	const [loadingPhotos, setLoadingPhotos] = useState(true);
	const [imageUrls, setImageUrls] = useState({});
	const [locationOptIn, setLocationOptIn] = useState(false);

	const imageUrlsRef = useRef({});
	const prevImageUrlsRef = useRef({});

	const fetchImageBlob = useCallback(
		async (photoId) => {
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
		},
		[user]
	);

	const fetchPhotos = useCallback(async () => {
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
					}
					console.log("Photos state NOT updated - no changes");
					return prev;
				});

				for (const photo of photosList) {
					if (!imageUrlsRef.current[photo.id]) {
						fetchImageBlob(photo.id);
					}
				}
			}
		} catch (error) {
			console.error("Failed to fetch photos:", error);
		} finally {
			setLoadingPhotos(false);
		}
	}, [user, fetchImageBlob]);

	useEffect(() => {
		fetchPhotos();
		// NOTE: do NOT auto-fetch analysis on mount.
	}, [fetchPhotos]);

	useEffect(() => {
		imageUrlsRef.current = imageUrls;

		const prev = prevImageUrlsRef.current || {};
		for (const key of Object.keys(prev)) {
			if (!imageUrls[key] && prev[key]) {
				URL.revokeObjectURL(prev[key]);
			}
		}
		prevImageUrlsRef.current = imageUrls;

		return () => {
			const current = prevImageUrlsRef.current || {};
			Object.values(current).forEach((url) => {
				if (url) URL.revokeObjectURL(url);
			});
		};
	}, [imageUrls]);

	const handleFileChange = (e) => {
		setFiles(Array.from(e.target.files));
		setResponse(null);
	};

	const handleUpload = async (e) => {
		e.preventDefault();

		if (files.length === 0) {
			setResponse({ success: false, data: { error: "Select at least one file" } });
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
			} catch (error) {
				console.error("Failed to parse JSON:", error);
				data = { error: `Invalid response from server (not JSON). Status: ${res.status}. Body: ${responseText.substring(0, 200)}` };
			}

			if (res.ok) {
				setResponse(null);
				setFiles([]);
				const input = document.getElementById("file-input");
				if (input) input.value = "";
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

	const clearAllPhotos = async () => {
		try {
			const res = await fetch(`${API_BASE}/api/photos`, {
				method: "DELETE",
				headers: {
					"X-User-Id": user.userId,
				},
			});

			if (res.ok) {
				Object.values(imageUrlsRef.current).forEach((url) => URL.revokeObjectURL(url));
				setImageUrls({});
				setPhotos([]);
				return { ok: true };
			}

			const data = await res.json();
			return { ok: false, error: data.error || "Unknown error" };
		} catch (error) {
			return { ok: false, error: error.message };
		}
	};

	return {
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
	};
}
