export function ChartCard({ title, subtitle, note, extra, children }) {
	return (
		<div className="chart-card">
			<div className="card-head">
				<div>
					<h2>{title}</h2>
					{subtitle ? <div className="chart-subtitle">{subtitle}</div> : null}
				</div>
			</div>
			{children}
			{extra}
			{note ? <div className="chart-note">{note}</div> : null}
		</div>
	);
}
