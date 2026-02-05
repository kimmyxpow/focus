import { useState, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { useSession } from 'modelence/client';
import { modelenceMutation } from '@modelence/react-query';
import toast from 'react-hot-toast';
import Page from '@/client/components/page';
import { cn } from '@/client/lib/utils';

const DIFFICULTY_OPTIONS = [
  { id: 'beginner', label: 'Beginner', description: 'Basic concepts' },
  { id: 'intermediate', label: 'Intermediate', description: 'Standard difficulty' },
  { id: 'advanced', label: 'Advanced', description: 'Complex topics' },
];

const CARD_COUNT_OPTIONS = [
  { value: 10, label: '10 cards', description: 'Quick set' },
  { value: 20, label: '20 cards', description: 'Standard' },
  { value: 30, label: '30 cards', description: 'Comprehensive' },
  { value: 50, label: '50 cards', description: 'Complete coverage' },
];

const MAX_CONTENT_LENGTH = 100000;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
  });
}

function getFileType(file: File): 'txt' | 'pdf' | 'docx' | 'md' | null {
  const name = file.name.toLowerCase();
  if (name.endsWith('.txt') || file.type === 'text/plain') return 'txt';
  if (name.endsWith('.pdf') || file.type === 'application/pdf') return 'pdf';
  if (name.endsWith('.docx') || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx';
  if (name.endsWith('.md') || file.type === 'text/markdown' || file.type === 'text/x-markdown') return 'md';
  return null;
}

export default function CreateFlashcardPage() {
  const navigate = useNavigate();
  const { user } = useSession();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [inputType, setInputType] = useState<'text' | 'file'>('text');
  const [textContent, setTextContent] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const [difficulty, setDifficulty] = useState<'beginner' | 'intermediate' | 'advanced'>('intermediate');
  const [maxCards, setMaxCards] = useState(20);

  const canSubmit = inputType === 'text' 
    ? textContent.length >= 50 && textContent.length <= MAX_CONTENT_LENGTH 
    : !!file;

  const { mutate: generateFlashcards, isPending } = useMutation({
    ...modelenceMutation<{ setId: string; title: string; cardCount: number }>('flashcard.generateFlashcards'),
    onSuccess: (data) => {
      toast.success(`Created ${data.cardCount} flashcards!`);
      navigate(`/flashcards/${data.setId}/study`);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to generate flashcards');
    },
  });

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const type = getFileType(selectedFile);
    if (!type) {
      toast.error('Please upload a .txt, .docx, or .pdf file');
      return;
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    setFile(selectedFile);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) {
      toast.error('Please provide content or upload a file');
      return;
    }

    if (inputType === 'text') {
      generateFlashcards({
        content: textContent,
        sourceType: 'text',
        maxCards,
        difficulty,
      });
    } else if (file) {
      const fileType = getFileType(file);
      if (!fileType) {
        toast.error('Invalid file type');
        return;
      }

      try {
        const base64 = await fileToBase64(file);
        generateFlashcards({
          fileContent: base64,
          sourceType: fileType,
          sourceFileName: file.name,
          maxCards,
          difficulty,
        });
      } catch {
        toast.error('Failed to read file');
      }
    }
  }, [canSubmit, inputType, textContent, file, maxCards, difficulty, generateFlashcards]);

  if (!user) {
    return (
      <Page variant="dark">
        <div className="container-sm">
          <div className="text-center py-12 fade-in">
            <div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center mx-auto mb-5">
              <svg className="w-7 h-7 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h2 className="text-display-sm text-white mb-2">Let's get you set up</h2>
            <p className="text-white/50 text-sm mb-6">
              Sign in to create AI-powered flashcards from your study material.
            </p>
            <Link to={`/login?_redirect=${encodeURIComponent('/create-flashcard')}`} className="btn-light">
              Sign In
            </Link>
          </div>
        </div>
      </Page>
    );
  }

  if (isPending) {
    return (
      <Page variant="dark">
        <div className="container-sm">
          <div className="text-center py-16 fade-in">
            <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-white animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
              </svg>
            </div>
            <h3 className="text-display-sm text-white mb-2">Generating Flashcards...</h3>
            <p className="text-white/50 text-sm max-w-sm mx-auto">
              AI is analyzing your material and creating study cards. This may take a few moments.
            </p>
          </div>
        </div>
      </Page>
    );
  }

  return (
    <Page variant="dark">
      <div className="container-md">
        <div className="text-center mb-8">
          <h1 className="text-display-md text-white mb-2">Create Flashcards</h1>
          <p className="text-white/50 text-sm">Paste your study material and let AI generate flashcards for you</p>
        </div>

        <div className="py-6 fade-in space-y-8">
          <div>
            <label className="text-label text-white/60 mb-2 block">Input Method</label>
            <div className="flex items-center gap-1 p-1 bg-white/5 rounded-lg w-fit">
              <button
                type="button"
                onClick={() => setInputType('text')}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                  inputType === 'text'
                    ? "bg-white text-stone-900"
                    : "text-white/50 hover:text-white hover:bg-white/10"
                )}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
                Paste Text
              </button>
              <button
                type="button"
                onClick={() => setInputType('file')}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                  inputType === 'file'
                    ? "bg-white text-stone-900"
                    : "text-white/50 hover:text-white hover:bg-white/10"
                )}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                Upload File
              </button>
            </div>
          </div>

          {inputType === 'text' && (
            <div>
              <label htmlFor="content-input" className="text-label text-white/60 mb-2 block">Study Material *</label>
              <textarea
                id="content-input"
                placeholder="Paste your study material, notes, textbook content, or any text you want to learn from..."
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                maxLength={MAX_CONTENT_LENGTH}
                className="w-full px-3 py-2.5 rounded-md text-sm bg-white/5 text-white placeholder:text-white/30 focus:outline-none min-h-[200px] resize-none shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)] focus:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2),0_0_0_3px_rgba(255,255,255,0.05)]"
              />
              <div className="flex items-center justify-between mt-2 text-xs">
                <span className={cn(
                  "transition-colors",
                  textContent.length < 50 ? "text-white/40" : "text-white/60"
                )}>
                  {textContent.length < 50 
                    ? `Need ${50 - textContent.length} more characters` 
                    : textContent.length >= MAX_CONTENT_LENGTH 
                      ? 'Character limit reached'
                      : 'Ready to generate!'}
                </span>
                <span className={cn(
                  "transition-colors",
                  textContent.length >= MAX_CONTENT_LENGTH ? "text-amber-400" : "text-white/40"
                )}>
                  {textContent.length.toLocaleString()} / {MAX_CONTENT_LENGTH.toLocaleString()}
                </span>
              </div>
            </div>
          )}

          {inputType === 'file' && (
            <div>
              <label className="text-label text-white/60 mb-2 block">Upload File *</label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "w-full min-h-[200px] border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all",
                  file 
                    ? "border-white/40 bg-white/10" 
                    : "border-white/20 hover:border-white/40 hover:bg-white/5"
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.pdf,.docx,.md"
                  onChange={handleFileChange}
                  className="hidden"
                />
                {file ? (
                  <>
                    <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-white font-medium mt-2">{file.name}</p>
                    <p className="text-white/50 text-sm mt-1">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
                      }}
                      className="mt-3 text-xs text-white/40 hover:text-white transition-colors"
                    >
                      Remove file
                    </button>
                  </>
                ) : (
                  <>
                    <svg className="w-8 h-8 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                    <p className="text-white/60 mt-2">Click to upload .txt, .docx, or .pdf file</p>
                    <p className="text-white/40 text-sm mt-1">Max 5MB</p>
                  </>
                )}
              </div>
            </div>
          )}

          <div className="border-t border-white/10" />

          <div className="space-y-6">
            <h3 className="text-label text-white/60">Customize Your Flashcards</h3>

            <fieldset>
              <legend className="text-sm text-white/50 mb-2 block">Difficulty Level</legend>
              <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Select difficulty">
                {DIFFICULTY_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={difficulty === option.id}
                    onClick={() => setDifficulty(option.id as typeof difficulty)}
                    className={cn(
                      "p-3 rounded-lg text-center transition-all",
                      difficulty === option.id
                        ? "bg-white text-stone-900 shadow-sm"
                        : "bg-white/5 hover:bg-white/10 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]"
                    )}
                  >
                    <span className={cn(
                      "text-sm font-medium block",
                      difficulty === option.id ? "text-stone-900" : "text-white"
                    )}>
                      {option.label}
                    </span>
                    <span className={cn(
                      "text-xs block mt-0.5",
                      difficulty === option.id ? "text-stone-500" : "text-white/50"
                    )}>
                      {option.description}
                    </span>
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-sm text-white/50 mb-2 block">Number of Cards</legend>
              <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Select card count">
                {CARD_COUNT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={maxCards === option.value}
                    onClick={() => setMaxCards(option.value)}
                    className={cn(
                      "p-3 rounded-lg text-center transition-all",
                      maxCards === option.value
                        ? "bg-white text-stone-900 shadow-sm"
                        : "bg-white/5 hover:bg-white/10 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]"
                    )}
                  >
                    <span className={cn(
                      "text-lg font-semibold block",
                      maxCards === option.value ? "text-stone-900" : "text-white"
                    )}>
                      {option.value}
                    </span>
                    <span className={cn(
                      "text-xs block",
                      maxCards === option.value ? "text-stone-500" : "text-white/50"
                    )}>
                      {option.description}
                    </span>
                  </button>
                ))}
              </div>
            </fieldset>
          </div>

          {canSubmit && (
            <div className="p-4 bg-white/5 rounded-lg scale-in">
              <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Summary</p>
              {inputType === 'text' ? (
                <p className="text-white text-sm mb-3 line-clamp-2">
                  {textContent.substring(0, 150)}{textContent.length > 150 ? '...' : ''}
                </p>
              ) : file && (
                <p className="text-white text-sm mb-3">
                  File: {file.name} ({(file.size / 1024).toFixed(1)} KB)
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <span className="chip bg-white/10 text-white/70">{difficulty}</span>
                <span className="chip bg-white/10 text-white/70">{maxCards} cards max</span>
                {inputType === 'text' && (
                  <span className="text-sm text-white/50">{textContent.length} characters</span>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              className="btn-ghost-light flex-1 sm:flex-none"
              onClick={() => navigate('/my-flashcards')}
              type="button"
            >
              Cancel
            </button>
            <button
              className="btn-light flex-1 sm:flex-auto"
              onClick={handleSubmit}
              disabled={isPending || !canSubmit}
              type="button"
            >
              Generate Flashcards
            </button>
          </div>
        </div>
      </div>
    </Page>
  );
}
