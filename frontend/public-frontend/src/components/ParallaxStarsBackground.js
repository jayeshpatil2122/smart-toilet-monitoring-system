import React, { useMemo } from "react";
import "./ParallaxStarsBackground.css";

const STAR_FIELD_SIZE = 2000;

const generateBoxShadows = (count) => {
  if (count <= 0) return "";
  const points = [];
  for (let i = 0; i < count; i += 1) {
    points.push(
      `${Math.floor(Math.random() * STAR_FIELD_SIZE)}px ${Math.floor(
        Math.random() * STAR_FIELD_SIZE
      )}px #FFFFFF`
    );
  }
  return points.join(", ");
};

function ParallaxStarsBackground({
  title = "",
  children,
  className = "",
  speed = 1,
}) {
  const safeSpeed = Math.max(0.1, Number(speed) || 1);
  const shadowsSmall = useMemo(() => generateBoxShadows(700), []);
  const shadowsMedium = useMemo(() => generateBoxShadows(200), []);
  const shadowsBig = useMemo(() => generateBoxShadows(100), []);
  const titleLines = String(title || "")
    .split("\n")
    .filter(Boolean);

  return (
    <div className={`parallax-stars ${className}`.trim()}>
      <div className="parallax-stars-atmosphere"></div>

      <div
        className="parallax-stars-layer parallax-stars-layer-small"
        style={{ boxShadow: shadowsSmall, animationDuration: `${50 / safeSpeed}s` }}
      >
        <div className="parallax-stars-layer-copy" style={{ boxShadow: shadowsSmall }}></div>
      </div>

      <div
        className="parallax-stars-layer parallax-stars-layer-medium"
        style={{ boxShadow: shadowsMedium, animationDuration: `${100 / safeSpeed}s` }}
      >
        <div className="parallax-stars-layer-copy" style={{ boxShadow: shadowsMedium }}></div>
      </div>

      <div
        className="parallax-stars-layer parallax-stars-layer-big"
        style={{ boxShadow: shadowsBig, animationDuration: `${150 / safeSpeed}s` }}
      >
        <div className="parallax-stars-layer-copy" style={{ boxShadow: shadowsBig }}></div>
      </div>

      {titleLines.length > 0 && (
        <div className="parallax-stars-title">
          {titleLines.map((line, index) => (
            <React.Fragment key={`${line}-${index}`}>
              <span>{line}</span>
              {index < titleLines.length - 1 && <br />}
            </React.Fragment>
          ))}
        </div>
      )}

      {children && <div className="parallax-stars-content">{children}</div>}
    </div>
  );
}

export default ParallaxStarsBackground;
