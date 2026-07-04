import './SkeletonLoader.css';

export function SkeletonCard() {
  return (
    <div className="skeleton-card">
      <div className="skeleton-image"></div>
      <div className="skeleton-content">
        <div className="skeleton-line skeleton-line-brand"></div>
        <div className="skeleton-line skeleton-line-title"></div>
        <div className="skeleton-line skeleton-line-text"></div>
        <div className="skeleton-line skeleton-line-text short"></div>
        <div className="skeleton-footer">
          <div className="skeleton-line skeleton-line-price"></div>
          <div className="skeleton-button"></div>
        </div>
      </div>
    </div>
  );
}

export function SkeletonGrid({ count = 8 }) {
  return (
    <div className="skeleton-grid">
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonCard key={index} />
      ))}
    </div>
  );
}

export function SkeletonText({ lines = 3 }) {
  return (
    <div className="skeleton-text">
      {Array.from({ length: lines }).map((_, index) => (
        <div 
          key={index} 
          className={`skeleton-line ${index === lines - 1 ? 'short' : ''}`}
        ></div>
      ))}
    </div>
  );
}
