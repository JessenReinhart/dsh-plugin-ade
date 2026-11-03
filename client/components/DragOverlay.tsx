import * as React from 'react';
import { computeDropZone } from '../../src/layout/engine.js';
import type { Rect, DropPreview } from './types.js';

/**
 * Pure-math drop preview. Converts the engine's client-space zone rect into a
 * stage-relative rect and yields the zone label for the overlay.
 */
export function computeDropPreview(
  targetClientRect: Rect,
  pointerClientX: number,
  pointerClientY: number,
  containerClientRect: Rect,
): DropPreview {
  const zone = computeDropZone(targetClientRect, pointerClientX, pointerClientY);
  return {
    rect: {
      left: zone.rect.left - containerClientRect.left,
      top: zone.rect.top - containerClientRect.top,
      width: zone.rect.width,
      height: zone.rect.height,
    },
    label: zone.label,
  };
}

export interface DragOverlayProps {
  preview: DropPreview | null;
}

export function DragOverlay({ preview }: DragOverlayProps) {
  if (!preview) {
    return null;
  }

  const style: React.CSSProperties = {
    left: preview.rect.left,
    top: preview.rect.top,
    width: preview.rect.width,
    height: preview.rect.height,
  };

  return (
    <div className="ade-drag-overlay" style={style}>
      <span className="ade-drag-overlay-label">{preview.label}</span>
    </div>
  );
}