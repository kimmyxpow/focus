import { useState, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { useSession } from 'modelence/client';
import { modelenceMutation } from '@modelence/react-query';
import toast from 'react-hot-toast';
import Page from '@/client/components/Page';
import { cn } from '@/client/lib/utils';

const DIFFICULTY_OPTIONS = [
  { id: 'beginner', label: 'Beginner', description: 'Basic concepts' },
  { id: 'intermediate', label: 'Intermediate', description: 'Standard difficulty' },
  { id: 'advanced', label: 'Advanced', description: 'Complex topics' },
];

const QUESTION_COUNT_OPTIONS = [
  { value: 10, label: '10', description: 'Quick' },
  { value: 15, label: '15', description: 'Standard' },
  { value: 20, label: '20', description: 'Comprehensive' },
  { value: 30, label: '30', description: 'Full' },
];

const QUESTION_TYPE_OPTIONS = [
  { id: 'mixed', label: 'Mixed', description: 'All types' },
  { id: 'multiple_choice', label: 'Multiple Choice', description: 'A, B, C, D' },
  { id: 'true_false', label: 'True/False', description: 'Binary' },
  { id: 'fill_blank', label: 'Fill Blank', description: 'Type answer' },
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

function getFileType(file: File): 'txt' | 'pdf' | 'docx' | null {
  const name = file.name.toLowerCase();
  if (name.endsWith('.txt') || file.type === 'text/plain') return 'txt';
  if (name.endsWith('.pdf') || file.type === 'application/pdf') return 'pdf';
  if (name.endsWith('.docx') || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx';
  return null;
}

export default function CreateQuizPage() {
  const navigate = useNavigate();
  const { user } = useSession();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [inputType, setInputType] = useState<'text' | 'file'>('text');
  const [textContent, setTextContent] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const [difficulty, setDifficulty] = useState<'beginner' | 'intermediate' | 'advanced'>('intermediate');
  const [maxQuestions, setMaxQuestions] = useState(15);
  const [questionTypes, setQuestionTypes] = useState<'multiple_choice' | 'true_false' | 'fill_blank' | 'mixed'>('mixed');

  const canSubmit = inputType === 'text' 
    ? textContent.length >= 50 && textContent.length <= MAX_CONTENT_LENGTH 
    : !!file;

  const { mutate: generateQuiz, isPending } = useMutation({
    ...modelenceMutation<{ quizId: string; title: string; questionCount: number }>('quiz.generateQuiz'),
    onSuccess: (data) => {
      toast.success(`Created quiz with ${data.questionCount} questions!`);
      navigate(`/quiz/${data.quizId}`);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to generate quiz');
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
      generateQuiz({
        content: textContent,
        sourceType: 'text',
        maxQuestions,
        difficulty,
        questionTypes,
      });
    } else if (file) {
      const fileType = getFileType(file);
      if (!fileType) {
        toast.error('Invalid file type');
        return;
      }

      try {
        const base64 = await fileToBase64(file);
        generateQuiz({
          fileContent: base64,
          sourceType: fileType,
          sourceFileName: file.name,
          maxQuestions,
          difficulty,
          questionTypes,
        });
      } catch {
        toast.error('Failed to read file');
      }
    }
  }, [canSubmit, inputType, textContent, file, maxQuestions, difficulty, questionTypes, generateQuiz]);

  if (!user) {
    return (
      <Page variant="dark">
        <div className="container-sm">
          <div className="text-center py-12 fade-in">
            <div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center mx-auto mb-5">
              <svg className="w-7 h-7 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h2 className="text-display-sm text-white mb-2">Let's get you set up</h2>
            <p className="text-white/50 text-sm mb-6">
              Sign in to create AI-powered quizzes from your study material.
            </p>
            <Link to={`/login?_redirect=${encodeURIComponent('/create-quiz')}`} className="btn-light">
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
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
            </div>
            <h3 className="text-display-sm text-white mb-2">Generating Quiz...</h3>
            <p className="text-white/50 text-sm max-w-sm mx-auto">
              AI is analyzing your material and creating quiz questions. This may take a few moments.
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
          <h1 className="text-display-md text-white mb-2">Create Quiz</h1>
          <p className="text-white/50 text-sm">Paste your study material and let AI generate quiz questions</p>
        </div>

        <div className="py-6 fade-in space-y-8">
          {/* Input Type Toggle */}
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

          {/* Text Input */}
          {inputType === 'text' && (
            <div>
              <label htmlFor="content-input" className="text-label text-white/60 mb-2 block">Study Material *</label>
              <textarea
                id="content-input"
                placeholder="Paste your study material, notes, textbook content..."
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
                    : 'Ready to generate!'}
                </span>
                <span className="text-white/40">
                  {textContent.length.toLocaleString()} / {MAX_CONTENT_LENGTH.toLocaleString()}
                </span>
              </div>
            </div>
          )}

          {/* File Upload */}
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
                  accept=".txt,.pdf,.docx"
                  onChange={handleFileChange}
                  className="hidden"
                />
                {file ? (
                  <>
                    <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-white font-medium mt-2">{file.name}</p>
                    <p className="text-white/50 text-sm mt-1">{(file.size / 1024).toFixed(1)} KB</p>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setFile(null); }}
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

          {/* Settings */}
          <div className="space-y-6">
            <h3 className="text-label text-white/60">Quiz Settings</h3>

            {/* Question Types */}
            <fieldset>
              <legend className="text-sm text-white/50 mb-2 block">Question Types</legend>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {QUESTION_TYPE_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setQuestionTypes(option.id as typeof questionTypes)}
                    className={cn(
                      "p-3 rounded-lg text-center transition-all",
                      questionTypes === option.id
                        ? "bg-white text-stone-900 shadow-sm"
                        : "bg-white/5 hover:bg-white/10 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]"
                    )}
                  >
                    <span className={cn(
                      "text-sm font-medium block",
                      questionTypes === option.id ? "text-stone-900" : "text-white"
                    )}>
                      {option.label}
                    </span>
                    <span className={cn(
                      "text-xs block mt-0.5",
                      questionTypes === option.id ? "text-stone-500" : "text-white/50"
                    )}>
                      {option.description}
                    </span>
                  </button>
                ))}
              </div>
            </fieldset>

            {/* Difficulty */}
            <fieldset>
              <legend className="text-sm text-white/50 mb-2 block">Difficulty Level</legend>
              <div className="grid grid-cols-3 gap-2">
                {DIFFICULTY_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
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
                  </button>
                ))}
              </div>
            </fieldset>

            {/* Question Count */}
            <fieldset>
              <legend className="text-sm text-white/50 mb-2 block">Number of Questions</legend>
              <div className="grid grid-cols-4 gap-2">
                {QUESTION_COUNT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setMaxQuestions(option.value)}
                    className={cn(
                      "p-3 rounded-lg text-center transition-all",
                      maxQuestions === option.value
                        ? "bg-white text-stone-900 shadow-sm"
                        : "bg-white/5 hover:bg-white/10 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]"
                    )}
                  >
                    <span className={cn(
                      "text-lg font-semibold block",
                      maxQuestions === option.value ? "text-stone-900" : "text-white"
                    )}>
                      {option.value}
                    </span>
                    <span className={cn(
                      "text-xs block",
                      maxQuestions === option.value ? "text-stone-500" : "text-white/50"
                    )}>
                      {option.description}
                    </span>
                  </button>
                ))}
              </div>
            </fieldset>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              className="btn-ghost-light flex-1 sm:flex-none"
              onClick={() => navigate('/my-quizzes')}
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
              Generate Quiz
            </button>
          </div>
        </div>
      </div>
    </Page>
  );
}
