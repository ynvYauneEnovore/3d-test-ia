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

import {atom} from 'jotai';
import {
  colors,
  defaultPromptParts,
  defaultPrompts,
  imageOptions,
} from './consts';
import {
  BoundingBox2DType,
  BoundingBox3DType,
  BoundingBoxMaskType,
  DetectTypes,
  PointingType,
} from './Types';

export const ImageSrcAtom = atom<string | null>(imageOptions[0]);

export const ImageSentAtom = atom(false);

export const BoundingBoxes2DAtom = atom<BoundingBox2DType[]>([]);

export const PromptsAtom = atom<Record<DetectTypes, string[]>>({
  ...defaultPromptParts,
});
export const CustomPromptsAtom = atom<Record<DetectTypes, string>>({
  ...defaultPrompts,
});

export const RevealOnHoverModeAtom = atom<boolean>(true);

export const BoundingBoxMasksAtom = atom<BoundingBoxMaskType[]>([]);

export const PointsAtom = atom<PointingType[]>([]);

export const TemperatureAtom = atom<number>(0.5);

export const DrawModeAtom = atom<boolean>(false);

export const DetectTypeAtom = atom<DetectTypes>('2D bounding boxes');

export const BumpSessionAtom = atom(0);

export const InitFinishedAtom = atom(true);

export const IsUploadedImageAtom = atom(false);

export const RequestJsonAtom = atom('');

export const ResponseJsonAtom = atom('');

export const ActiveColorAtom = atom<string>(colors[0]);

export const LinesAtom = atom<[[number, number][], string][]>([]);

export const HoverEnteredAtom = atom(false);

export const SelectedModelAtom = atom('gemini-2.5-flash');

export const HoveredBoxAtom = atom<number | null>(null);

export const IsLoadingAtom = atom(false);

export const IsThinkingEnabledAtom = atom(false);

export const BoundingBoxes3DAtom = atom<BoundingBox3DType[]>([]);
export const FovAtom = atom(75);
