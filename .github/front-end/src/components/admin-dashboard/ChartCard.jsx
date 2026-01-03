export function ChartCard({ title, subtitle, note, extra, children }) {
	return (
		<div className="chart-card">
			{/* Kaartheader met titel en optionele subtitle */}
			<div className="card-head">
				<div>
					<h2>{title}</h2>
					{subtitle ? <div className="chart-subtitle">{subtitle}</div> : null}
				</div>
			</div>
			{/* Inhoud van de chart */}
			{children}
			{/* Extra content (zoals definities) */}
			{extra}
			{/* Optionele noot onderaan */}
			{note ? <div className="chart-note">{note}</div> : null}
		</div>
	);
}
