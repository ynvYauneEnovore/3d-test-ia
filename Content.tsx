/* tslint:disable */
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
// Copyright 2025 Google LLC

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at

//     https://www.apache.org/licenses/LICENSE-2.0

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import {useAtom} from 'jotai';
import getStroke from 'perfect-freehand';
// Fix: Import React to make the React namespace available for type annotations.
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {ResizePayload, useResizeDetector} from 'react-resize-detector';
import {
  ActiveColorAtom,
  BoundingBoxes2DAtom,
  BoundingBoxes3DAtom,
  BoundingBoxMasksAtom,
  DetectTypeAtom,
  DrawModeAtom,
  FovAtom,
  ImageSentAtom,
  ImageSrcAtom,
  LinesAtom,
  PointsAtom,
  RevealOnHoverModeAtom,
} from './atoms';
import {lineOptions, segmentationColorsRgb} from './consts';
import {getSvgPathFromStroke} from './utils';

export function Content() {
  const [imageSrc] = useAtom(ImageSrcAtom);
  const [boundingBoxes2D] = useAtom(BoundingBoxes2DAtom);
  const [boundingBoxMasks] = useAtom(BoundingBoxMasksAtom);
  const [boundingBoxes3D] = useAtom(BoundingBoxes3DAtom);
  const [fov] = useAtom(FovAtom);
  const [detectType] = useAtom(DetectTypeAtom);
  const [, setImageSent] = useAtom(ImageSentAtom);
  const [points] = useAtom(PointsAtom);
  const [revealOnHover] = useAtom(RevealOnHoverModeAtom);
  const [hoverEntered, setHoverEntered] = useState(false);
  const [hoveredBox, _setHoveredBox] = useState<number | null>(null);
  const [drawMode] = useAtom(DrawModeAtom);
  const [lines, setLines] = useAtom(LinesAtom);
  const [activeColor] = useAtom(ActiveColorAtom);

  const boundingBoxContainerRef = useRef<HTMLDivElement | null>(null);
  const [containerDims, setContainerDims] = useState({
    width: 0,
    height: 0,
  });
  const [activeMediaDimensions, setActiveMediaDimensions] = useState({
    width: 1,
    height: 1,
  });

  const onResize = useCallback((el: ResizePayload) => {
    if (el.width && el.height) {
      setContainerDims({
        width: el.width,
        height: el.height,
      });
    }
  }, []);

  const {ref: containerRef} = useResizeDetector({onResize});

  const boundingBoxContainer = useMemo(() => {
    const {width, height} = activeMediaDimensions;
    const aspectRatio = width / height;
    const containerAspectRatio = containerDims.width / containerDims.height;
    if (aspectRatio < containerAspectRatio) {
      return {
        height: containerDims.height,
        width: containerDims.height * aspectRatio,
      };
    } else {
      return {
        width: containerDims.width,
        height: containerDims.width / aspectRatio,
      };
    }
  }, [containerDims, activeMediaDimensions]);

  const projected3DBoxes = useMemo(() => {
    if (detectType !== '3D bounding boxes' || !activeMediaDimensions.width) {
      return [];
    }
    const {width: imageWidth, height: imageHeight} = activeMediaDimensions;

    return boundingBoxes3D.map((box) => {
      const {center, dimensions, yaw, label} = box;
      const [cx, cy, cz] = center;
      const [dx, dy, dz] = dimensions;
      const l = dx / 2;
      const w = dy / 2;
      const h = dz / 2;

      // Object-space corners
      const corners3DObject = [
        [-l, -w, -h],
        [l, -w, -h],
        [l, w, -h],
        [-l, w, -h], // bottom
        [-l, -w, h],
        [l, -w, h],
        [l, w, h],
        [-l, w, h], // top
      ];

      const cosYaw = Math.cos(yaw);
      const sinYaw = Math.sin(yaw);

      const corners3DWorld = corners3DObject.map(([x, y, z]) => {
        const rotatedX = x * cosYaw + z * sinYaw;
        const rotatedY = y;
        const rotatedZ = -x * sinYaw + z * cosYaw;
        return [rotatedX + cx, rotatedY + cy, rotatedZ + cz];
      });

      const fovRad = fov * (Math.PI / 180);
      const f = imageHeight / (2 * Math.tan(fovRad / 2));

      const corners2D = corners3DWorld.map(([x, y, z]) => {
        if (z <= 0) return null; // Behind camera
        const screenX = (f * x) / z + imageWidth / 2;
        const screenY = -(f * y) / z + imageHeight / 2;
        return {x: screenX, y: screenY};
      });

      if (corners2D.some((c) => c === null)) {
        return {edges: [], label: '', topPoint: null};
      }

      const validCorners = corners2D as {x: number; y: number}[];

      const edgesIndices = [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 0], // bottom
        [4, 5],
        [5, 6],
        [6, 7],
        [7, 4], // top
        [0, 4],
        [1, 5],
        [2, 6],
        [3, 7], // sides
      ];

      const edges = edgesIndices.map(([startIdx, endIdx]) => ({
        p1: validCorners[startIdx],
        p2: validCorners[endIdx],
      }));

      const topPoint = validCorners.reduce(
        (min, p) => (p.y < min.y ? p : min),
        validCorners[0],
      );

      return {edges, label, topPoint};
    });
  }, [boundingBoxes3D, detectType, activeMediaDimensions, fov]);

  function setHoveredBox(e: React.PointerEvent) {
    const boxes = document.querySelectorAll('.bbox');
    const dimensionsAndIndex = Array.from(boxes).map((box, i) => {
      const {top, left, width, height} = box.getBoundingClientRect();
      return {
        top,
        left,
        width,
        height,
        index: i,
      };
    });

    // Sort smallest to largest
    const sorted = dimensionsAndIndex.sort(
      (a, b) => a.width * a.height - b.width * b.height,
    );

    // Find the smallest box that contains the mouse
    const {clientX, clientY} = e;
    const found = sorted.find(({top, left, width, height}) => {
      return (
        clientX > left &&
        clientX < left + width &&
        clientY > top &&
        clientY < top + height
      );
    });
    if (found) {
      _setHoveredBox(found.index);
    } else {
      _setHoveredBox(null);
    }
  }

  const downRef = useRef<Boolean>(false);

  return (
    <div ref={containerRef} className="w-1/2 h-full relative">
      {imageSrc ? (
        <img
          src={imageSrc}
          className="absolute top-0 left-0 w-full h-full object-contain"
          alt="Uploaded image"
          onLoad={(e) => {
            setActiveMediaDimensions({
              width: e.currentTarget.naturalWidth,
              height: e.currentTarget.naturalHeight,
            });
          }}
        />
      ) : null}
      <div
        className={`absolute w-full h-full left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 ${hoverEntered ? 'hide-box' : ''} ${drawMode ? 'cursor-crosshair' : ''}`}
        ref={boundingBoxContainerRef}
        onPointerEnter={(e) => {
          if (revealOnHover && !drawMode) {
            setHoverEntered(true);
            setHoveredBox(e);
          }
        }}
        onPointerMove={(e) => {
          if (revealOnHover && !drawMode) {
            setHoverEntered(true);
            setHoveredBox(e);
          }
          if (downRef.current) {
            const parentBounds =
              boundingBoxContainerRef.current!.getBoundingClientRect();
            setLines((prev) => [
              ...prev.slice(0, prev.length - 1),
              [
                [
                  ...prev[prev.length - 1][0],
                  [
                    (e.clientX - parentBounds.left) /
                      boundingBoxContainer!.width,
                    (e.clientY - parentBounds.top) /
                      boundingBoxContainer!.height,
                  ],
                ],
                prev[prev.length - 1][1],
              ],
            ]);
          }
        }}
        onPointerLeave={(e) => {
          if (revealOnHover && !drawMode) {
            setHoverEntered(false);
            setHoveredBox(e);
          }
        }}
        onPointerDown={(e) => {
          if (drawMode) {
            setImageSent(false);
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            downRef.current = true;
            const parentBounds =
              boundingBoxContainerRef.current!.getBoundingClientRect();
            setLines((prev) => [
              ...prev,
              [
                [
                  [
                    (e.clientX - parentBounds.left) /
                      boundingBoxContainer!.width,
                    (e.clientY - parentBounds.top) /
                      boundingBoxContainer!.height,
                  ],
                ],
                activeColor,
              ],
            ]);
          }
        }}
        onPointerUp={(e) => {
          if (drawMode) {
            (e.target as HTMLElement).releasePointerCapture(e.pointerId);
            downRef.current = false;
          }
        }}
        style={{
          width: boundingBoxContainer.width,
          height: boundingBoxContainer.height,
        }}>
        {lines.length > 0 && (
          <svg
            className="absolute top-0 left-0 w-full h-full"
            style={{
              pointerEvents: 'none',
              width: boundingBoxContainer?.width,
              height: boundingBoxContainer?.height,
            }}>
            {lines.map(([points, color], i) => (
              <path
                key={i}
                d={getSvgPathFromStroke(
                  getStroke(
                    points.map(([x, y]) => [
                      x * boundingBoxContainer!.width,
                      y * boundingBoxContainer!.height,
                      0.5,
                    ]),
                    lineOptions,
                  ),
                )}
                fill={color}
              />
            ))}
          </svg>
        )}
        {detectType === '2D bounding boxes' &&
          boundingBoxes2D.map((box, i) => (
            <div
              key={i}
              className={`absolute bbox border-2 border-[#3B68FF] ${i === hoveredBox ? 'reveal' : ''}`}
              style={{
                transformOrigin: '0 0',
                top: box.y * 100 + '%',
                left: box.x * 100 + '%',
                width: box.width * 100 + '%',
                height: box.height * 100 + '%',
              }}>
              <div className="bg-[#3B68FF] text-white absolute left-0 top-0 text-sm px-1">
                {box.label}
              </div>
            </div>
          ))}
        {detectType === 'Segmentation masks' &&
          boundingBoxMasks.map((box, i) => (
            <div
              key={i}
              className={`absolute bbox border-2 border-[#3B68FF] ${i === hoveredBox ? 'reveal' : ''}`}
              style={{
                transformOrigin: '0 0',
                top: box.y * 100 + '%',
                left: box.x * 100 + '%',
                width: box.width * 100 + '%',
                height: box.height * 100 + '%',
              }}>
              <BoxMask box={box} index={i} />
              <div className="w-full top-0 h-0 absolute">
                <div className="bg-[#3B68FF] text-white absolute -left-[2px] bottom-0 text-sm px-1">
                  {box.label}
                </div>
              </div>
            </div>
          ))}

        {detectType === 'Points' &&
          points.map((point, i) => {
            return (
              <div
                key={i}
                className="absolute bg-red"
                style={{
                  left: `${point.point.x * 100}%`,
                  top: `${point.point.y * 100}%`,
                }}>
                <div className="absolute bg-[#3B68FF] text-center text-white text-xs px-1 bottom-4 rounded-sm -translate-x-1/2 left-1/2">
                  {point.label}
                </div>
                <div className="absolute w-4 h-4 bg-[#3B68FF] rounded-full border-white border-[2px] -translate-x-1/2 -translate-y-1/2"></div>
              </div>
            );
          })}
        {detectType === '3D bounding boxes' && (
          <>
            <svg
              className="absolute top-0 left-0 w-full h-full"
              style={{pointerEvents: 'none'}}>
              {projected3DBoxes.map(({edges}, i) => (
                <g key={i}>
                  {edges.map(({p1, p2}, j) => (
                    <line
                      key={j}
                      x1={`${(p1.x / activeMediaDimensions.width) * 100}%`}
                      y1={`${(p1.y / activeMediaDimensions.height) * 100}%`}
                      x2={`${(p2.x / activeMediaDimensions.width) * 100}%`}
                      y2={`${(p2.y / activeMediaDimensions.height) * 100}%`}
                      stroke="#3B68FF"
                      strokeWidth="2"
                    />
                  ))}
                </g>
              ))}
            </svg>
            {projected3DBoxes.map(({label, topPoint}, i) =>
              topPoint ? (
                <div
                  key={i}
                  className="absolute bg-[#3B68FF] text-white text-sm px-1"
                  style={{
                    left: `${(topPoint.x / activeMediaDimensions.width) * 100}%`,
                    top: `${(topPoint.y / activeMediaDimensions.height) * 100}%`,
                    transform: 'translate(-50%, -100%)',
                    pointerEvents: 'none',
                  }}>
                  {label}
                </div>
              ) : null,
            )}
          </>
        )}
      </div>
    </div>
  );
}

function BoxMask({
  box,
  index,
}: {
  box: {
    x: number;
    y: number;
    width: number;
    height: number;
    label: string;
    imageData: string;
  };
  index: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rgb = segmentationColorsRgb[index % segmentationColorsRgb.length];

  useEffect(() => {
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        const image = new Image();
        image.src = box.imageData;
        image.onload = () => {
          canvasRef.current!.width = image.width;
          canvasRef.current!.height = image.height;
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(image, 0, 0);
          const pixels = ctx.getImageData(0, 0, image.width, image.height);
          const data = pixels.data;
          for (let i = 0; i < data.length; i += 4) {
            // alpha from mask
            data[i + 3] = data[i];
            // color from palette
            data[i] = rgb[0];
            data[i + 1] = rgb[1];
            data[i + 2] = rgb[2];
          }
          ctx.putImageData(pixels, 0, 0);
        };
      }
    }
  }, [canvasRef, box.imageData, rgb]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute top-0 left-0 w-full h-full"
      style={{opacity: 0.5}}
    />
  );
}
