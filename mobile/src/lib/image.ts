import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

export type PickedPhoto = { image: string; thumb: string };

async function toJpegDataUrl(uri: string, width: number, height: number, maxSize: number, compress: number) {
  const ctx = ImageManipulator.manipulate(uri);
  if (Math.max(width, height) > maxSize) {
    ctx.resize(width >= height ? { width: maxSize } : { height: maxSize });
  }
  const rendered = await ctx.renderAsync();
  const result = await rendered.saveAsync({ format: SaveFormat.JPEG, compress, base64: true });
  return `data:image/jpeg;base64,${result.base64}`;
}

// Take or choose a photo, then shrink it: ~1024px for AI analysis + a small thumbnail for the log.
// Always re-encoded as JPEG, so HEIC photos from iPhones work too.
export async function pickPhoto(source: 'camera' | 'library'): Promise<PickedPhoto | null> {
  const perm =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    throw new Error(
      source === 'camera'
        ? 'Camera access is off. Enable it in Settings to scan food.'
        : 'Photo access is off. Enable it in Settings to choose a photo.'
    );
  }

  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
  const res =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  if (res.canceled || !res.assets?.length) return null;

  const { uri, width, height } = res.assets[0];
  try {
    const [image, thumb] = await Promise.all([
      toJpegDataUrl(uri, width, height, 1024, 0.85),
      toJpegDataUrl(uri, width, height, 240, 0.7),
    ]);
    return { image, thumb };
  } catch {
    throw new Error("Couldn't read that image");
  }
}
