declare module 'pdf-poppler' {
  export interface PdfPopperOptions {
    format?: string;
    out_dir?: string;
    out_prefix?: string;
    page?: number | null;
    scale?: number;
    resolution?: number;
  }

  export function convert(pdfPath: string, options: PdfPopperOptions): Promise<void>;
} 