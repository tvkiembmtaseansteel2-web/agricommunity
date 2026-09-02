import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import WeatherIcon from '../WeatherIcon.jsx';

describe('WeatherIcon — render điều kiện thời tiết', () => {
  it('trời quang ban ngày: có mặt trời (vàng), không có giọt mưa', () => {
    const { container } = render(<WeatherIcon code={0} isDay={true} />);
    const fill = container.querySelectorAll('circle[fill="#FFD54F"]');
    expect(fill.length).toBeGreaterThan(0); // mặt trời
    expect(container.querySelectorAll('ellipse').length).toBe(0); // không mưa
  });

  it('trời quang ban đêm: có trăng (E8EAF6), không có mặt trời', () => {
    const { container } = render(<WeatherIcon code={0} isDay={false} />);
    expect(container.querySelectorAll('circle[fill="#E8EAF6"]').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('circle[fill="#FFD54F"]').length).toBe(0);
  });

  it('mưa: đám mây trắng + giọt mưa xanh', () => {
    const { container } = render(<WeatherIcon code={61} isDay={true} />);
    expect(container.querySelectorAll('ellipse').length).toBeGreaterThan(0); // giọt mưa
  });

  it('dông: có tia sét (path #FFEB3B)', () => {
    const { container } = render(<WeatherIcon code={95} isDay={false} />);
    expect(container.querySelectorAll('path[fill="#FFEB3B"]').length).toBeGreaterThan(0);
  });

  it('tuyết: có bông tuyết (g #E3F2FD)', () => {
    const { container } = render(<WeatherIcon code={75} isDay={true} />);
    expect(container.querySelectorAll('g[fill="#E3F2FD"]').length).toBeGreaterThan(0);
  });

  it('luôn có backdrop tròn phía sau', () => {
    const { container } = render(<WeatherIcon code={3} isDay={true} />);
    expect(container.querySelector('circle[fill*="rgba(255,255,255"]')).toBeTruthy();
  });
});
