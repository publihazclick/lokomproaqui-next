// Recorta una imagen a partir del area seleccionada (pixeles reales de la imagen original, ya
// resueltos por react-easy-crop en onCropComplete) y devuelve el resultado como File cuadrado
// (1:1), listo para subir con subirArchivoPublico. Reemplaza al image-cropper de Angular con el
// mismo resultado (foto principal siempre cuadrada).

export interface AreaPixeles {
  x: number;
  y: number;
  width: number;
  height: number;
}

function cargarImagen(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function recortarImagen(imagenSrc: string, area: AreaPixeles, nombreArchivo: string): Promise<File> {
  const imagen = await cargarImagen(imagenSrc);
  const canvas = document.createElement('canvas');
  canvas.width = area.width;
  canvas.height = area.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo procesar la imagen');

  ctx.drawImage(imagen, area.x, area.y, area.width, area.height, 0, 0, area.width, area.height);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
  if (!blob) throw new Error('No se pudo procesar la imagen');

  return new File([blob], nombreArchivo.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
}
