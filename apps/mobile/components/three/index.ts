// =============================================================================
// Drapnr — 3D Avatar Components Barrel Export
// =============================================================================

export { AvatarScene, USE_3D } from './AvatarScene';
export type { AvatarSceneProps } from './AvatarScene';

export { Avatar } from './Avatar';
export type { AvatarProps } from './Avatar';

export {
  TextureSwapper,
  useTexture,
  disposeTexture,
  clearTextureCache,
  preloadTextures,
  getFallbackTexture,
} from './TextureSwapper';
export type { TextureState } from './TextureSwapper';

export { SceneControls } from './SceneControls';
export type {
  SceneControlsProps,
  SceneControlState,
  UseSceneControlsReturn,
} from './SceneControls';

export { LoadingAvatar } from './LoadingAvatar';
export type { LoadingAvatarProps } from './LoadingAvatar';

export { AvatarScreenshot } from './AvatarScreenshot';
export type { AvatarScreenshotHandle, AvatarScreenshotProps } from './AvatarScreenshot';

export { GarmentPicker } from './GarmentPicker';
export type { GarmentPickerProps } from './GarmentPicker';
