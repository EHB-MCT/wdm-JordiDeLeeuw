export function AdminSummary({ totals }) {
	return (
		<div className="admin-summary">
			{/* Samenvatting van totale aantallen */}
			Users: {totals.totalUsers} • Photos: {totals.totalPhotos}
		</div>
	);
}
