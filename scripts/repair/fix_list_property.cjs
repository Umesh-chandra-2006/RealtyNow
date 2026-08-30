const fs = require('fs');
let content = fs.readFileSync('src/pages/portal/list-property.tsx', 'utf-8');

// 1. Update imports
content = content.replace(
  /PlayCircle,\n  AlertCircle,\n} from 'lucide-react';/,
  `PlayCircle,
  AlertCircle,
  Images,
  Trash2,
  RefreshCw,
} from 'lucide-react';`
);

// 2. Constants
content = content.replace(
  'const MAX_MEDIA_FILE_SIZE = 5 * 1024 * 1024; // 5MB',
  `const MAX_IMAGE_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_VIDEO_FILE_SIZE = 20 * 1024 * 1024; // 20MB`
);

// 3. States
content = content.replace(
  /const \[previewItem, setPreviewItem\] = useState<MediaItem \| null>\(null\);/,
  `const [previewItem, setPreviewItem] = useState<MediaItem | null>(null);
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [coverImageUploading, setCoverImageUploading] = useState(false);`
);

// 4. Handlers
const handlers = `
  const handleCoverImageUpload = async (rawFile: File) => {
    if (!ACCEPTED_MEDIA_TYPES.includes(rawFile.type) || rawFile.type.startsWith('video/')) {
      toast.addToast('error', 'Please select a valid image file (JPG, PNG, WEBP)');
      return;
    }
    setCoverImageUploading(true);
    try {
      const file = await compressImage(rawFile);
      if (file.size > MAX_IMAGE_FILE_SIZE) {
        toast.addToast('error', \`\${rawFile.name}: exceeds 5MB limit\`);
        return;
      }
      const { url, error } = await uploadFile('property-images', file);
      if (error) {
        toast.addToast('error', error);
      } else if (url) {
        setCoverImageUrl(url);
      }
    } finally {
      setCoverImageUploading(false);
    }
  };

  const handleMediaFiles = async (rawFiles: File[]) => {
    const room = MAX_MEDIA_FILES - mediaItems.length;
    if (room <= 0) {
      toast.addToast('error', \`Maximum \${MAX_MEDIA_FILES} files allowed\`);
      return;
    }
    for (const rawFile of rawFiles.slice(0, room)) {
      if (!ACCEPTED_MEDIA_TYPES.includes(rawFile.type)) {
        toast.addToast('error', \`\${rawFile.name}: unsupported file type\`);
        continue;
      }
      const isVideo = rawFile.type.startsWith('video/');
      if (isVideo && rawFile.size > MAX_VIDEO_FILE_SIZE) {
        toast.addToast('error', \`\${rawFile.name}: exceeds 20MB limit\`);
        continue;
      }
      const file = isVideo ? rawFile : await compressImage(rawFile);
      if (!isVideo && file.size > MAX_IMAGE_FILE_SIZE) {
        toast.addToast('error', \`\${rawFile.name}: still exceeds 5MB after compression\`);
        continue;
      }

      const bucket: StorageBucket = isVideo ? 'property-videos' : 'property-images';
`;

content = content.replace(
  /const handleMediaFiles = async \(rawFiles: File\[\]\) => \{[\s\S]*?const bucket: StorageBucket = isVideo \? 'property-videos' : 'property-images';/,
  handlers
);

// 5. Submit Payload
content = content.replace(
  'images: imagesUrls,',
  `images: imagesUrls,
        cover_image_url: coverImageUrl,`
);

content = content.replace(
  /setMediaItems\(restoredMedia\);/,
  `setMediaItems(restoredMedia);
        if (p.cover_image_url) setCoverImageUrl(p.cover_image_url);`
);

// 6. UI
const coverImageUI = `
                        {/* ─── DEDICATED COVER IMAGE SECTION ─── */}
                        <div className="mt-8 pt-8 border-t border-navy-100">
                          <SectionTitle title="Cover Image" sub="Upload a horizontal cover image to represent this property." />
                          
                          {!coverImageUrl ? (
                            <div className="bg-navy-50 rounded-[24px] p-6 border-2 border-navy-100">
                              <div
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={async (e) => {
                                  e.preventDefault();
                                  if (coverImageUploading) return;
                                  const files = Array.from(e.dataTransfer.files);
                                  if (files[0]) handleCoverImageUpload(files[0]);
                                }}
                                className="border-2 border-dashed border-navy-300 rounded-2xl p-8 text-center bg-white hover:bg-navy-50/50 transition-all flex flex-col items-center justify-center min-h-[200px]"
                              >
                                {coverImageUploading ? (
                                  <div className="flex flex-col items-center gap-3">
                                    <div className="h-8 w-8 border-4 border-navy-200 border-t-red-600 rounded-full animate-spin" />
                                    <p className="text-sm font-semibold text-navy-700">Uploading cover image...</p>
                                  </div>
                                ) : (
                                  <>
                                    <Images className="h-10 w-10 text-navy-400 mb-3" />
                                    <p className="text-sm font-semibold text-navy-700 mb-1">Upload Horizontal Cover Image</p>
                                    <p className="text-xs text-navy-500 mb-5">JPG, PNG, WEBP · Recommended 16:9</p>
                                    <label className="cursor-pointer inline-flex items-center gap-2 bg-navy-900 text-white text-sm font-semibold px-6 py-2.5 rounded-xl hover:bg-navy-800 transition-all shadow-md">
                                      <Camera className="h-4 w-4" /> Choose Cover Image
                                      <input
                                        type="file"
                                        accept="image/jpeg,image/png,image/webp"
                                        className="hidden"
                                        onChange={(e) => {
                                          if (e.target.files?.[0]) handleCoverImageUpload(e.target.files[0]);
                                          e.target.value = '';
                                        }}
                                      />
                                    </label>
                                  </>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="bg-navy-50 rounded-[24px] p-6 border-2 border-navy-100">
                              <p className="text-xs font-bold text-navy-600 mb-3 uppercase tracking-widest text-center">
                                Property Cover Image
                              </p>
                              <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-navy-200 shadow-md group">
                                <img src={coverImageUrl} alt="Cover" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-navy-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                                  <label className="cursor-pointer inline-flex items-center gap-2 bg-white text-navy-900 text-sm font-semibold px-4 py-2 rounded-lg hover:bg-navy-50 transition-all">
                                    <RefreshCw className="h-4 w-4" /> Replace
                                    <input
                                      type="file"
                                      accept="image/jpeg,image/png,image/webp"
                                      className="hidden"
                                      onChange={(e) => {
                                        if (e.target.files?.[0]) handleCoverImageUpload(e.target.files[0]);
                                        e.target.value = '';
                                      }}
                                    />
                                  </label>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      if (confirm('Remove this property\\'s cover image?')) {
                                        setCoverImageUrl(null);
                                      }
                                    }}
                                    className="inline-flex items-center gap-2 bg-red-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-red-700 transition-all"
                                  >
                                    <Trash2 className="h-4 w-4" /> Remove
                                  </button>
                                </div>
                                <div className="absolute top-3 left-3 bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5 shadow-md">
                                  <Star className="h-3 w-3 fill-current" /> Active Cover Image
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
`;

content = content.replace(
  /<\/div>\s*}\)\s*}\s*<\/div>\s*<!-- Form Navigation -->/,
  coverImageUI + '\n                      </div>\n                      <!-- Form Navigation -->'
);

content = content.replace(
  /<\/div>\s*}\)\s*}\s*\{\/\* ─── Form Navigation ─── \*\/\}/,
  coverImageUI + '\n                      {/* ─── Form Navigation ─── */}'
);

fs.writeFileSync('src/pages/portal/list-property.tsx', content);
