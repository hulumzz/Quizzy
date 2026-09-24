export function PageLoader({ label = 'Menyiapkan halaman...', overlay = false }) {
  return (
    <div className={overlay ? 'qz-page-loader qz-page-loader--overlay' : 'qz-page-loader'} role="status" aria-live="polite">
      <div className="qz-page-loader__panel">
        <svg className="qz-page-loader__clock" viewBox="0 0 100 100" aria-hidden="true">
          <circle className="qz-page-loader__ring qz-page-loader__ring--soft" cx="50" cy="50" r="46" />
          <circle className="qz-page-loader__ring" cx="50" cy="50" r="46" pathLength="100" />
          <circle className="qz-page-loader__hub" cx="50" cy="50" r="5" />
          <line className="qz-page-loader__hand qz-page-loader__hand--fast" x1="50" y1="50" x2="82" y2="50">
            <animateTransform attributeName="transform" dur="1.7s" type="rotate" from="0 50 50" to="360 50 50" repeatCount="indefinite" />
          </line>
          <line className="qz-page-loader__hand qz-page-loader__hand--slow" x1="50" y1="50" x2="50" y2="27">
            <animateTransform attributeName="transform" dur="8s" type="rotate" from="0 50 50" to="360 50 50" repeatCount="indefinite" />
          </line>
        </svg>
        <div className="qz-page-loader__copy"><strong>Nalaro</strong><span>{label}</span></div>
      </div>
    </div>
  );
}

export function ProcessLoader({ size = 22, label = 'Memproses' }) {
  return (
    <span className="qz-process-loader" role="status" aria-label={label} style={{ '--qz-process-loader-size': `${size}px` }}>
      <svg viewBox="0 0 57 60" aria-hidden="true">
        <g fill="none" fillRule="evenodd" transform="translate(1 1)">
          <circle cx="5" cy="50" r="4.3">
            <animate attributeName="cy" begin="0s" dur="1.9s" values="50;6;50;50" calcMode="spline" keySplines=".45 0 .55 1;.45 0 .55 1;.45 0 .55 1" repeatCount="indefinite" />
            <animate attributeName="cx" begin="0s" dur="1.9s" values="5;27;49;5" calcMode="spline" keySplines=".45 0 .55 1;.45 0 .55 1;.45 0 .55 1" repeatCount="indefinite" />
          </circle>
          <circle cx="27" cy="5" r="4.3">
            <animate attributeName="cy" begin="0s" dur="1.9s" values="5;50;50;5" calcMode="spline" keySplines=".45 0 .55 1;.45 0 .55 1;.45 0 .55 1" repeatCount="indefinite" />
            <animate attributeName="cx" begin="0s" dur="1.9s" values="27;49;5;27" calcMode="spline" keySplines=".45 0 .55 1;.45 0 .55 1;.45 0 .55 1" repeatCount="indefinite" />
          </circle>
          <circle cx="49" cy="50" r="4.3">
            <animate attributeName="cy" begin="0s" dur="1.9s" values="50;50;5;50" calcMode="spline" keySplines=".45 0 .55 1;.45 0 .55 1;.45 0 .55 1" repeatCount="indefinite" />
            <animate attributeName="cx" begin="0s" dur="1.9s" values="49;5;27;49" calcMode="spline" keySplines=".45 0 .55 1;.45 0 .55 1;.45 0 .55 1" repeatCount="indefinite" />
          </circle>
        </g>
      </svg>
      <span className="qz-sr-only">{label}</span>
    </span>
  );
}
