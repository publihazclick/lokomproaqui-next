export interface CursoVideo {
  id: number;
  title: string;
  video_url: string;
  description: string | null;
  sort_order: number;
  parent_id: number | null;
}

export interface CategoriaConVideos extends CursoVideo {
  videos: CursoVideo[];
}
