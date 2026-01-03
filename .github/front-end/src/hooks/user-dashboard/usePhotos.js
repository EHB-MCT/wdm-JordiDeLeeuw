import { useCallback, useEffect, useRef, useState } from "react";

// Basis-URL voor API calls (leeg = zelfde origin)
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
			// Haal de afbeelding als blob op en maak een object URL
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
		// Haal alle foto's van de gebruiker op
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

				// Prefetch blobs voor foto's die nog geen URL hebben
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
		// Eerste load van foto's
		fetchPhotos();
		// NOTE: do NOT auto-fetch analysis on mount.
	}, [fetchPhotos]);

	useEffect(() => {
		// Houd refs in sync en ruim oude object URLs op
		imageUrlsRef.current = imageUrls;

		const prev = prevImageUrlsRef.current || {};
		for (const key of Object.keys(prev)) {
			if (!imageUrls[key] && prev[key]) {
				URL.revokeObjectURL(prev[key]);
			}
		}
		prevImageUrlsRef.current = imageUrls;

		return () => {
			// Cleanup bij unmount
			const current = prevImageUrlsRef.current || {};
			Object.values(current).forEach((url) => {
				if (url) URL.revokeObjectURL(url);
			});
		};
	}, [imageUrls]);

	const handleFileChange = (e) => {
		// Update geselecteerde bestanden
		setFiles(Array.from(e.target.files));
		setResponse(null);
	};

	const clearSelectedFiles = () => {
		// Verwijder de huidige selectie en reset input
		setFiles([]);
		setResponse(null);
		const input = document.getElementById("file-input");
		if (input) input.value = "";
	};

	const handleUpload = async (e) => {
		// Upload bestanden naar de backend
		e.preventDefault();

		if (files.length === 0) {
			setResponse({ success: false, data: { error: "Select at least one file" } });
			return;
		}

		setUploading(true);
		setResponse(null);

		try {
			// Bouw multipart form-data op
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
				// Parse response als JSON indien mogelijk
				data = JSON.parse(responseText);
			} catch (error) {
				console.error("Failed to parse JSON:", error);
				data = { error: `Invalid response from server (not JSON). Status: ${res.status}. Body: ${responseText.substring(0, 200)}` };
			}

			if (res.ok) {
				// Succes: reset selectie en refresh foto's
				setResponse(null);
				setFiles([]);
				const input = document.getElementById("file-input");
				if (input) input.value = "";
				fetchPhotos();
			} else {
				setResponse({ success: false, data });
			}
		} catch (error) {
			// Netwerkfout
			setResponse({
				success: false,
				data: { error: error.message || "Network error - could not reach server" },
			});
		} finally {
			setUploading(false);
		}
	};

	const clearAllPhotos = async () => {
		// Verwijder alle foto's van de gebruiker
		try {
			const res = await fetch(`${API_BASE}/api/photos`, {
				method: "DELETE",
				headers: {
					"X-User-Id": user.userId,
				},
			});

			if (res.ok) {
				// Ruim object URLs op en reset state
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
		clearSelectedFiles,
		clearAllPhotos,
	};
}
