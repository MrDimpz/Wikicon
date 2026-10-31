import React, { useRef, useState, useEffect, useCallback } from 'react';
import { GridBoard, GridTargetCard } from '../types';
import { soundFX } from '../utils/sound';

interface KeycapGridProps {
  gridBoard: GridBoard;
  onWordSubmit: (word: string) => void;
  isLightMode?: boolean;
}

export const KeycapGrid: React.FC<KeycapGridProps> = ({
  gridBoard,
  onWordSubmit,
  isLightMode = false,
}) => {
  const { rows, cols, cells, targets } = gridBoard;
  const [activePath, setActivePath] = useState<number[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [flashedIndices, setFlashedIndices] = useState<Set<number>>(new Set());
  const gridRef = useRef<HTMLDivElement>(null);

  // Flash revealed target paths when targets update
  const prevRevealedCountRef = useRef<number>(0);
  useEffect(() => {
    const revealedTargets = targets.filter((t) => t.revealed && t.path && t.path.length > 0);
    if (revealedTargets.length > prevRevealedCountRef.current) {
      const latest = revealedTargets[revealedTargets.length - 1];
      if (latest && latest.path) {
        const nextSet = new Set(latest.path);
        setFlashedIndices(nextSet);
        const timer = setTimeout(() => setFlashedIndices(new Set()), 900);
        prevRevealedCountRef.current = revealedTargets.length;
        return () => clearTimeout(timer);
      }
    }
    prevRevealedCountRef.current = revealedTargets.length;
  }, [targets]);

  const areNeighbors = (idxA: number, idxB: number) => {
    const rA = Math.floor(idxA / cols);
    const cA = idxA % cols;
    const rB = Math.floor(idxB / cols);
    const cB = idxB % cols;
    return Math.abs(rA - rB) <= 1 && Math.abs(cA - cB) <= 1 && idxA !== idxB;
  };

  const handleCellEnter = useCallback(
    (idx: number) => {
      setActivePath((prev) => {
        if (prev.length === 0) return [idx];
        const last = prev[prev.length - 1];
        if (last === idx) return prev;
        // Allow backtracking one step if user drags back to second-to-last tile
        if (prev.length >= 2 && prev[prev.length - 2] === idx) {
          soundFX.playKeycapTap(prev.length - 2);
          return prev.slice(0, -1);
        }
        if (prev.includes(idx)) return prev;
        if (areNeighbors(last, idx)) {
          soundFX.playKeycapTap(prev.length);
          return [...prev, idx];
        }
        return prev;
      });
    },
    [cols]
  );

  const finishSwipe = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    if (activePath.length >= 2) {
      const formedWord = activePath.map((i) => cells[i]).join('');
      onWordSubmit(formedWord);
    }
    setActivePath([]);
  }, [isDragging, activePath, cells, onWordSubmit]);

  useEffect(() => {
    const handleGlobalPointerUp = () => {
      if (isDragging) finishSwipe();
    };
    window.addEventListener('pointerup', handleGlobalPointerUp);
    return () => window.removeEventListener('pointerup', handleGlobalPointerUp);
  }, [isDragging, finishSwipe]);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const elem = document.elementFromPoint(e.clientX, e.clientY);
    if (!elem) return;
    const cellEl = elem.closest('[data-cell-idx]') as HTMLElement | null;
    if (cellEl && cellEl.dataset.cellIdx !== undefined) {
      const idx = parseInt(cellEl.dataset.cellIdx, 10);
      if (!isNaN(idx)) {
        handleCellEnter(idx);
      }
    }
  };

  // Compute SVG polyline coordinates for active swipe path
  const getCellCenterPercent = (idx: number) => {
    const r = Math.floor(idx / cols);
    const c = idx % cols;
    const x = ((c + 0.5) / cols) * 100;
    const y = ((r + 0.5) / rows) * 100;
    return { x, y };
  };

  const currentWordPreview = activePath.map((i) => cells[i]).join('');

  // Group targets into Title targets and Pyramid rows (1 top, 2 middle, 3 bottom)
  const pyramidRow1 = targets.filter((t) => t.tier === 'PYRAMID_1');
  const pyramidRow2 = targets.filter((t) => t.tier === 'PYRAMID_2');
  const pyramidRow3 = targets.filter((t) => t.tier === 'PYRAMID_3');

  const renderTargetCard = (t: GridTargetCard, heightClass: string, textClass: string) => {
    const isRevealed = t.revealed;
    const fillPct = isRevealed ? 100 : t.closeness;
    const hue = isRevealed ? 135 : Math.round(25 + (t.closeness / 100) * 95);

    return (
      <div
        key={t.id}
        className={`relative flex-1 min-w-0 ${heightClass} rounded-xl overflow-hidden border transition-all ${
          isRevealed
            ? 'border-[#9eea3a] bg-[#112a18] shadow-[0_0_16px_rgba(158,234,58,0.28)]'
            : 'border-[#2a4a5f] bg-[#152734] dark:bg-[#061c3d]'
        }`}
      >
        {/* Closeness / Revealed Fill Bar */}
        <div
          className="absolute inset-y-0 left-0 transition-all duration-300 pointer-events-none"
          style={{
            width: `${fillPct}%`,
            background: isRevealed
              ? 'linear-gradient(90deg, rgba(158,234,58,0.35), rgba(95,180,20,0.2))'
              : `linear-gradient(90deg, hsla(${hue}, 88%, 50%, 0.35), transparent)`,
          }}
        />
        <div className="relative z-10 h-full px-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className={`font-bold tracking-wider truncate ${textClass} ${
                isRevealed ? 'text-[#9eea3a]' : 'text-[#eaf3f7]'
              }`}
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {isRevealed
                ? t.word
                : t.hintLetters
                    .map((l) => l || '•')
                    .join(' ')}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 text-xs font-mono tabular-nums text-[#96b8dd]">
            {isRevealed && t.finder ? (
              <span className="text-[#9eea3a] font-semibold truncate max-w-[90px]">
                {t.finder.displayName}
              </span>
            ) : (
              <span>{t.length}L {t.closeness > 0 ? `· ${t.closeness}%` : ''}</span>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Target-Card Pyramid (1 Large on top, 2 in Middle, 3 on Bottom) */}
      {(pyramidRow1.length > 0 || pyramidRow2.length > 0 || pyramidRow3.length > 0) && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs text-[#96b8dd] px-1">
            <span>Target Article Pyramid · Fill grows green as guesses get closer</span>
            <span className="font-mono tabular-nums">
              {targets.filter((t) => t.revealed).length}/{targets.length} Found
            </span>
          </div>
          {pyramidRow1.length > 0 && (
            <div className="flex gap-2">
              {pyramidRow1.map((t) => renderTargetCard(t, 'h-14', 'text-xl'))}
            </div>
          )}
          {pyramidRow2.length > 0 && (
            <div className="flex gap-2">
              {pyramidRow2.map((t) => renderTargetCard(t, 'h-12', 'text-base'))}
            </div>
          )}
          {pyramidRow3.length > 0 && (
            <div className="flex gap-2">
              {pyramidRow3.map((t) => renderTargetCard(t, 'h-11', 'text-sm'))}
            </div>
          )}
        </div>
      )}

      {/* Active Swipe Word Preview Floating Bar */}
      <div className="h-9 flex items-center justify-center">
        {currentWordPreview ? (
          <div
            className="px-4 py-1 rounded-lg bg-[#ee7a2c] text-white font-bold tracking-widest text-lg shadow-lg"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {currentWordPreview}
          </div>
        ) : (
          <span className="text-xs text-[#96b8dd]">
            Drag across adjacent 8-connected arcade keycaps or type below to discover hidden words
          </span>
        )}
      </div>

      {/* Physical Arcade Keycap Matrix + SVG Swipe Line */}
      <div
        ref={gridRef}
        onPointerMove={handlePointerMove}
        className="relative mx-auto w-full max-w-[460px] p-3.5 rounded-2xl bg-[#0a1620] dark:bg-[#03142f] border-2 border-[#1768b3] shadow-[0_0_24px_rgba(25,228,255,0.14)] select-none touch-none"
      >
        {/* SVG Swipe Connector Overlay */}
        <svg
          className="absolute inset-3.5 w-[calc(100%-28px)] h-[calc(100%-28px)] pointer-events-none z-20"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          {activePath.length > 1 && (
            <polyline
              fill="none"
              stroke="#ee7a2c"
              strokeWidth="2.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={activePath
                .map((idx) => {
                  const { x, y } = getCellCenterPercent(idx);
                  return `${x},${y}`;
                })
                .join(' ')}
            />
          )}
        </svg>

        <div
          className="grid gap-2 relative z-10"
          style={{
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          }}
        >
          {cells.map((letter, idx) => {
            const isSelected = activePath.includes(idx);
            const isFlashed = flashedIndices.has(idx);
            return (
              <button
                key={idx}
                type="button"
                data-cell-idx={idx}
                onPointerDown={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                  soundFX.playKeycapTap(0);
                  setActivePath([idx]);
                }}
                className={`aspect-square rounded-xl flex items-center justify-center text-xl sm:text-2xl font-bold cursor-pointer ${
                  isLightMode ? 'keycap-tile-light' : 'keycap-tile text-[#eaf3f7]'
                } ${isSelected ? 'active-swipe' : ''} ${isFlashed ? 'found-flash' : ''}`}
              >
                {letter}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
