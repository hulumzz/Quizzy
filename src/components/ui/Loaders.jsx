export function ProcessLoader({ size = 22, label = 'Memproses' }) {
  return (
    <span className="qz-process-loader" role="status" aria-label={label} style={{ '--qz-process-loader-size': `${size}px` }}>
      <svg viewBox="0 0 57 60" aria-hidden="true">
        <g fill="none" fillRule="evenodd" transform="translate(1 1)">
          <path className="qz-process-loader__track" d="M5 50L27 5L49 50Z" />
          <circle className="qz-process-loader__ball qz-process-loader__ball--one" cx="5" cy="50" r="4.3">
            <animate attributeName="cy" begin="0s" dur="1.9s" values="50;6;50;50" calcMode="spline" keySplines=".45 0 .55 1;.45 0 .55 1;.45 0 .55 1" repeatCount="indefinite" />
            <animate attributeName="cx" begin="0s" dur="1.9s" values="5;27;49;5" calcMode="spline" keySplines=".45 0 .55 1;.45 0 .55 1;.45 0 .55 1" repeatCount="indefinite" />
          </circle>
          <circle className="qz-process-loader__ball qz-process-loader__ball--two" cx="27" cy="5" r="4.3">
            <animate attributeName="cy" begin="0s" dur="1.9s" values="5;50;50;5" calcMode="spline" keySplines=".45 0 .55 1;.45 0 .55 1;.45 0 .55 1" repeatCount="indefinite" />
            <animate attributeName="cx" begin="0s" dur="1.9s" values="27;49;5;27" calcMode="spline" keySplines=".45 0 .55 1;.45 0 .55 1;.45 0 .55 1" repeatCount="indefinite" />
          </circle>
          <circle className="qz-process-loader__ball qz-process-loader__ball--three" cx="49" cy="50" r="4.3">
            <animate attributeName="cy" begin="0s" dur="1.9s" values="50;50;5;50" calcMode="spline" keySplines=".45 0 .55 1;.45 0 .55 1;.45 0 .55 1" repeatCount="indefinite" />
            <animate attributeName="cx" begin="0s" dur="1.9s" values="49;5;27;49" calcMode="spline" keySplines=".45 0 .55 1;.45 0 .55 1;.45 0 .55 1" repeatCount="indefinite" />
          </circle>
        </g>
      </svg>
      <span className="qz-sr-only">{label}</span>
    </span>
  );
}

export function PageLoader({ label = 'Menyiapkan halaman...', overlay = false }) {
  return (
    <div className={overlay ? 'qz-page-loader qz-page-loader--overlay' : 'qz-page-loader'} role="status" aria-live="polite" aria-busy="true">
      <div className="qz-page-loader__panel">
        <ProcessLoader size={46} label={label} />
        <div className="qz-page-loader__copy"><strong>Nalaro Class</strong><span>{label}</span></div>
      </div>
    </div>
  );
}
