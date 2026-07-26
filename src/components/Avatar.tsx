// The seven illustrated bust avatars from the design — identity is always
// a face, never a letter. Ported 1:1 from the SVG symbols in Venn.dc.html.

import React from 'react';
import Svg, { Circle, ClipPath, Defs, G, Path, Rect } from 'react-native-svg';

function Bust1() {
  return (
    <>
      <Circle cx={32} cy={32} r={32} fill="#ffe1d0" />
      <Path d="M8 64c0-13.5 10.7-22 24-22s24 8.5 24 22z" fill="#7a8a5e" />
      <Circle cx={32} cy={29} r={13.5} fill="#f2c9a0" />
      <Path d="M20 21a12 12 0 0 1 24 0z" fill="#c67139" />
      <Rect x={16.5} y={20} width={31} height={4.2} rx={2.1} fill="#8c491a" />
      <Circle cx={26.5} cy={30} r={1.9} fill="#2e2b25" />
      <Circle cx={37.5} cy={30} r={1.9} fill="#2e2b25" />
      <Path d="M26.5 35.6q5.5 4.4 11 0" stroke="#2e2b25" strokeWidth={1.8} fill="none" strokeLinecap="round" />
    </>
  );
}

function Bust2() {
  return (
    <>
      <Circle cx={32} cy={32} r={32} fill="#f0fae1" />
      <Path d="M8 64c0-13.5 10.7-22 24-22s24 8.5 24 22z" fill="#c67139" />
      <Circle cx={21} cy={21} r={8.4} fill="#3a2a1f" />
      <Circle cx={32} cy={15.5} r={9} fill="#3a2a1f" />
      <Circle cx={43} cy={21} r={8.4} fill="#3a2a1f" />
      <Circle cx={32} cy={29} r={13.5} fill="#d99a6c" />
      <Path d="M19 24a13 13 0 0 1 26 0z" fill="#3a2a1f" />
      <Circle cx={46} cy={33} r={2.6} fill="none" stroke="#c67139" strokeWidth={1.6} />
      <Circle cx={26.5} cy={30} r={1.9} fill="#2e2b25" />
      <Circle cx={37.5} cy={30} r={1.9} fill="#2e2b25" />
      <Path d="M26.5 35.6q5.5 4.4 11 0" stroke="#2e2b25" strokeWidth={1.8} fill="none" strokeLinecap="round" />
    </>
  );
}

function Bust3() {
  return (
    <>
      <Circle cx={32} cy={32} r={32} fill="#dcd3c4" />
      <Path d="M8 64c0-13.5 10.7-22 24-22s24 8.5 24 22z" fill="#56633f" />
      <Circle cx={32} cy={29} r={13.5} fill="#f6d3b0" />
      <Path d="M19.5 22a12.5 12.5 0 0 1 25 0z" fill="#c67139" />
      <Rect x={18} y={21} width={28} height={4} rx={2} fill="#8c491a" />
      <Circle cx={26} cy={30.5} r={4.6} fill="none" stroke="#2e2b25" strokeWidth={1.5} />
      <Circle cx={38} cy={30.5} r={4.6} fill="none" stroke="#2e2b25" strokeWidth={1.5} />
      <Path d="M30.6 30.5h2.8" stroke="#2e2b25" strokeWidth={1.5} />
      <Path d="M27 37.4q5 3.4 10 0" stroke="#2e2b25" strokeWidth={1.8} fill="none" strokeLinecap="round" />
    </>
  );
}

function Bust4() {
  return (
    <>
      <Circle cx={32} cy={32} r={32} fill="#ffc6a5" />
      <Path d="M8 64c0-13.5 10.7-22 24-22s24 8.5 24 22z" fill="#2e2b25" />
      <Circle cx={32} cy={29} r={13.5} fill="#8d5a3b" />
      <Path d="M20 24a12 12 0 0 1 24 0z" fill="#241a12" />
      <Path d="M18 31v-4a14 14 0 0 1 28 0v4" stroke="#201e1d" strokeWidth={2.6} fill="none" strokeLinecap="round" />
      <Rect x={14.6} y={28.5} width={6.4} height={10} rx={3.2} fill="#201e1d" />
      <Rect x={43} y={28.5} width={6.4} height={10} rx={3.2} fill="#201e1d" />
      <Circle cx={26.5} cy={30} r={1.9} fill="#f9f4ed" />
      <Circle cx={37.5} cy={30} r={1.9} fill="#f9f4ed" />
      <Path d="M26 34.8q6 5.6 12 0" stroke="#f9f4ed" strokeWidth={1.8} fill="none" strokeLinecap="round" />
    </>
  );
}

function Bust5() {
  return (
    <>
      <Circle cx={32} cy={32} r={32} fill="#e1eecc" />
      <Path d="M8 64c0-13.5 10.7-22 24-22s24 8.5 24 22z" fill="#d67f48" />
      <Circle cx={32} cy={29} r={13.5} fill="#f2c9a0" />
      <Path d="M18 38V28a14 14 0 0 1 28 0v10h-4.5V25.5h-19V38z" fill="#241d1a" />
      <Path d="M19.5 26.5c3.5-4 9-6 12.5-6s9 2 12.5 6z" fill="#241d1a" />
      <Circle cx={26.5} cy={30.5} r={1.9} fill="#2e2b25" />
      <Circle cx={37.5} cy={30.5} r={1.9} fill="#2e2b25" />
      <Path d="M28 36.2q4 2.6 8 0" stroke="#2e2b25" strokeWidth={1.8} fill="none" strokeLinecap="round" />
    </>
  );
}

function Bust6() {
  return (
    <>
      <Circle cx={32} cy={32} r={32} fill="#fff2eb" />
      <Path d="M8 64c0-13.5 10.7-22 24-22s24 8.5 24 22z" fill="#7a8a5e" />
      <Path d="M18 27 21.5 14l4.5 8 4-10.5 4.5 10.5 4.5-8L42.5 14 46 27z" fill="#d67f48" />
      <Circle cx={32} cy={29} r={13.5} fill="#e8b98c" />
      <Path d="M19 24.5a13 13 0 0 1 26 0z" fill="#d67f48" />
      <Circle cx={26.5} cy={30} r={1.9} fill="#2e2b25" />
      <Circle cx={37.5} cy={30} r={1.9} fill="#2e2b25" />
      <Circle cx={22} cy={34} r={2.4} fill="#f6a06b" opacity={0.7} />
      <Circle cx={42} cy={34} r={2.4} fill="#f6a06b" opacity={0.7} />
      <Path d="M26 35q6 5 12 0" stroke="#2e2b25" strokeWidth={1.8} fill="none" strokeLinecap="round" />
    </>
  );
}

function Bust7() {
  return (
    <>
      <Circle cx={32} cy={32} r={32} fill="#eee7db" />
      <Path d="M8 64c0-13.5 10.7-22 24-22s24 8.5 24 22z" fill="#8fa073" />
      <Path d="M17 44V28a15 15 0 0 1 30 0v16h-5V27H22v17z" fill="#2e2b25" />
      <Circle cx={32} cy={29} r={13.5} fill="#b07b52" />
      <Path d="M19 23.5a13 13 0 0 1 26 0z" fill="#56633f" />
      <Rect x={43} y={21.5} width={8} height={4} rx={2} fill="#56633f" />
      <Circle cx={26.5} cy={30} r={1.9} fill="#2e2b25" />
      <Circle cx={37.5} cy={30} r={1.9} fill="#2e2b25" />
      <Path d="M27 35.4q5 4 10 0" stroke="#2e2b25" strokeWidth={1.8} fill="none" strokeLinecap="round" />
    </>
  );
}

const BUSTS = [Bust1, Bust2, Bust3, Bust4, Bust5, Bust6, Bust7];

export function Avatar({ sym, size }: { sym: number; size: number }) {
  const Bust = BUSTS[Math.max(1, Math.min(7, sym)) - 1];
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Defs>
        <ClipPath id="avclip">
          <Circle cx={32} cy={32} r={32} />
        </ClipPath>
      </Defs>
      <G clipPath="url(#avclip)">
        <Bust />
      </G>
    </Svg>
  );
}

export function VennLogo({ width }: { width: number }) {
  const height = (width * 64) / 96;
  return (
    <Svg width={width} height={height} viewBox="0 0 96 64">
      <Circle cx={34} cy={32} r={27} fill="#c67139" opacity={0.9} />
      <Circle cx={62} cy={32} r={27} fill="#7a8a5e" opacity={0.82} />
      <Path d="M48 6.6A27 27 0 0 1 48 57.4 27 27 0 0 1 48 6.6z" fill="#3f4a35" opacity={0.55} />
    </Svg>
  );
}

export function GemmaMark({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 2.6l2.1 5.6 5.6 2.1-5.6 2.1L12 18l-2.1-5.6L4.3 10.3l5.6-2.1z" fill={color} />
      <Circle cx={19} cy={19} r={2.1} fill={color} opacity={0.55} />
    </Svg>
  );
}
