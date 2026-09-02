import React from 'react';
import { weatherCondition } from './weatherService';

// ============================================================================
// WeatherIcon — icon thời tiết SVG nhiều lớp: mặt trời (ngày) / trăng khuyết
// (đêm) + đám mây + mưa/tuyết/sấm, theo đúng điều kiện thời tiết.
// Ngày: mặt trời (vàng); Đêm: trăng khuyết (sáng dịu). Trời quang → không mây
// hoặc rất ít; nhiều mây → thêm mây; mưa → mây + giọt mưa; dông → + tia sét.
// ============================================================================

const W = 64;
const H = 64;

// Mặt trời với tia (tia xoay chậm)
function Sun({ cx, cy, r }) {
  const rays = [];
  const n = 8;
  const inner = r + 3;
  const outer = r + 7;
  for (let i = 0; i < n; i++) {
    const a = (i * 2 * Math.PI) / n;
    rays.push(
      <line
        key={i}
        x1={cx + inner * Math.cos(a)} y1={cy + inner * Math.sin(a)}
        x2={cx + outer * Math.cos(a)} y2={cy + outer * Math.sin(a)}
        stroke="#FFD54F" strokeWidth="2.5" strokeLinecap="round"
      />
    );
  }
  return (
    <g>
      <g className="wx-spin" style={{ transformOrigin: `${cx}px ${cy}px` }}><g>{rays}</g></g>
      <circle cx={cx} cy={cy} r={r} fill="#FFD54F" />
    </g>
  );
}

// Trăng khuyết (crescent) — dùng mask để cắt hình liềm, không phụ thuộc nền
function Moon({ cx, cy, r }) {
  const maskId = `moonmask-${cx}-${cy}-${r}`;
  return (
    <g>
      <mask id={maskId}>
        <rect x="-8" y="-8" width="80" height="80" fill="white" />
        <circle cx={cx + r * 0.55} cy={cy - r * 0.4} r={r * 0.92} fill="black" />
      </mask>
      <circle cx={cx} cy={cy} r={r} fill="#E8EAF6" mask={`url(#${maskId})`} />
    </g>
  );
}

// Đám mây — nhóm vài hình tròn + đế tròn bo. Có `drift` để mây trôi nhẹ.
function Cloud({ x, y, scale = 1, opacity = 1, drift = false }) {
  const s = scale;
  return (
    <g transform={`translate(${x},${y}) scale(${s})`}>
      <g className={drift ? 'wx-drift' : undefined} opacity={opacity}>
        <g fill="#ffffff">
          <circle cx="0" cy="0" r="9" />
          <circle cx="11" cy="-5" r="11" />
          <circle cx="23" cy="-2" r="9" />
          <circle cx="31" cy="1" r="7" />
          <rect x="-2" y="-1" width="36" height="10" rx="5" />
        </g>
      </g>
    </g>
  );
}

// Giọt mưa (3 giọt nhỏ) — `fall` để giọt rơi nhẹ
function RainDrops({ x, y, color = '#29B6F6', fall = false }) {
  return (
    <g className={fall ? 'wx-rain' : undefined} fill={color}>
      <ellipse cx={x} cy={y} rx="2.2" ry="3.6" />
      <ellipse cx={x + 10} cy={y} rx="2.2" ry="3.6" />
      <ellipse cx={x + 20} cy={y} rx="2.2" ry="3.6" />
    </g>
  );
}

// Tia sét — `flash` để nhấp nháy
function Bolt({ x, y }) {
  return (
    <path className="wx-bolt" d={`M ${x} ${y} l 5 -8 h -6 l 8 -12 h 4 l -5 9 h 6 z`} fill="#FFEB3B" />
  );
}

// Bông tuyết nhỏ (chấm)
function SnowDots({ x, y }) {
  return (
    <g fill="#E3F2FD">
      <circle cx={x} cy={y} r="2" />
      <circle cx={x + 9} cy={y + 2} r="2" />
      <circle cx={x + 18} cy={y} r="2" />
    </g>
  );
}

export default function WeatherIcon({ code, isDay = true, size = 52 }) {
  const cond = weatherCondition(code);
  const scale = size / 64;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      {/* Nền tròn mờ phía sau để mây trắng nổi rõ trên nền widget */}
      <circle cx={W / 2} cy={H / 2} r={30} fill={isDay ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.10)'} />
      <g transform={`scale(${scale})`}>
        {/* Trời quang: chỉ mặt trời / trăng */}
        {cond === 'clear' && (isDay ? <Sun cx={32} cy={32} r={12} /> : <Moon cx={30} cy={30} r={12} />)}

        {/* Có mây (partly): mặt trời/trăng nhỏ lộ ra + 1 đám mây */}
        {cond === 'partly' && (
          <g>
            {isDay ? <Sun cx={26} cy={24} r={10} /> : <Moon cx={26} cy={23} r={10} />}
            <Cloud x={16} y={26} scale={1.0} drift />
          </g>
        )}

        {/* Nhiều mây: 2 đám mây chồng */}
        {cond === 'cloudy' && (
          <g>
            <Cloud x={12} y={22} scale={1.0} opacity={0.7} drift />
            <Cloud x={10} y={28} scale={1.1} drift />
          </g>
        )}

        {/* Mưa: mây + giọt mưa */}
        {cond === 'rain' && (
          <g>
            <Cloud x={12} y={22} scale={1.05} drift />
            <RainDrops x={22} y={44} fall />
          </g>
        )}

        {/* Dông: mây + giọt + sét */}
        {cond === 'thunder' && (
          <g>
            <Cloud x={12} y={20} scale={1.05} drift />
            <Bolt x={30} y={32} />
            <RainDrops x={22} y={48} fall />
          </g>
        )}

        {/* Tuyết */}
        {cond === 'snow' && (
          <g>
            <Cloud x={12} y={22} scale={1.05} drift />
            <SnowDots x={22} y={44} />
          </g>
        )}

        {/* Sương mù: mây mờ + vệt sương */}
        {cond === 'fog' && (
          <g>
            <Cloud x={12} y={24} scale={1.0} opacity={0.55} drift />
            <g stroke="#CFD8DC" strokeWidth="3" strokeLinecap="round">
              <line x1="14" y1="46" x2="50" y2="46" />
              <line x1="18" y1="53" x2="46" y2="53" />
            </g>
          </g>
        )}
      </g>
    </svg>
  );
}
