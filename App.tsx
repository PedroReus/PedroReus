import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header.tsx';
import { ComparisonTable } from './components/ComparisonTable.tsx';
import { SpinnerIcon } from './components/icons/SpinnerIcon.tsx';
import { SparklesIcon } from './components/icons/SparklesIcon.tsx';
import { ExpandIcon } from './components/icons/ExpandIcon.tsx';
import { DocumentTypeSelector } from './components/DocumentTypeSelector.tsx';
import { TextareaModal } from './components/TextareaModal.tsx';
import { FeedbackModal } from './components/FeedbackModal.tsx';
import { formatTextWithAI, compareDocumentsWithAI } from './lib/gemini.ts';
import { saveFeedback, saveFormattingFeedback } from './lib/feedbackStore.ts';
import type { ComparisonResultItem, LegalDocType, ComparisonChange, FeedbackModalState } from './types.ts';
import { TrashIcon } from './components/icons/TrashIcon.tsx';
import { CloseIcon } from './components/icons/CloseIcon.tsx';
import { CheckIcon } from './components/icons/CheckIcon.tsx';
import { ThumbUpIcon } from './components/icons/ThumbUpIcon.tsx';
import { ThumbDownIcon } from './components/icons/ThumbDownIcon.tsx';
import { UndoIcon } from './components/icons/UndoIcon.tsx';

const App: React.FC = () => {
  const [docType, setDocType] = useState<LegalDocType | null>(null);
  // State for current text content
  const [textA, setTextA] = useState<string>('');
  const [textB, setTextB] = useState<string>('');
  // State to hold pre-formatted content for undo
  const [originalTextA, setOriginalTextA] = useState<string>('');
  const [originalTextB, setOriginalTextB] = useState<string>('');
  // State to track if content is formatted
  const [isFormattedA, setIsFormattedA] = useState<boolean>(false);
  const [isFormattedB, setIsFormattedB] = useState<boolean>(false);
  const [comparisonResult, setComparisonResult] = useState<ComparisonResultItem | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [formattingTarget, setFormattingTarget] = useState<'A' | 'B' | null>(null);
  const [expandedTextarea, setExpandedTextarea] = useState<'A' | 'B' | null>(null);
  const [feedbackModalState, setFeedbackModalState] = useState<FeedbackModalState>({ isOpen: false });
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  
  const initialLoadRef = useRef(true);
  const saveTimeoutRef = useRef<number | null>(null);

  // Load drafts from localStorage on initial render
  useEffect(() => {
    const savedTextA = localStorage.getItem('draft_text_a');
    const savedTextB = localStorage.getItem('draft_text_b');
    if (savedTextA) setTextA(savedTextA);
    if (savedTextB) setTextB(savedTextB);
    setTimeout(() => { initialLoadRef.current = false; }, 100);
  }, []);

  // Autosave drafts to localStorage with visual feedback
  useEffect(() => {
    if (initialLoadRef.current) return;

    setSaveStatus('saving');

    if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = window.setTimeout(() => {
        localStorage.setItem('draft_text_a', textA);
        localStorage.setItem('draft_text_b', textB);
        setSaveStatus('saved');

        saveTimeoutRef.current = window.setTimeout(() => {
            setSaveStatus('idle');
        }, 2000);
    }, 1000);

    return () => {
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }
    };
  }, [textA, textB]);


  const isActionInProgress = isLoading || !!formattingTarget;
  const isCompareDisabled = !textA.trim() || !textB.trim() || isActionInProgress;

  const handleResetSelection = () => {
      setDocType(null);
      handleClearAll();
  };

  const handleClearAll = () => {
    setTextA('');
    setTextB('');
    setOriginalTextA('');
    setOriginalTextB('');
    setIsFormattedA(false);
    setIsFormattedB(false);
    setComparisonResult(null);
    setApiError(null);
  };

  const handleClearSingleInput = (target: 'A' | 'B') => {
      if (target === 'A') {
          setTextA('');
          setOriginalTextA('');
          setIsFormattedA(false);
      } else {
          setTextB('');
          setOriginalTextB('');
          setIsFormattedB(false);
      }
      setComparisonResult(null);
      setApiError(null);
  };
  
  const handleFormatText = async (target: 'A' | 'B') => {
      setFormattingTarget(target);
      setApiError(null);
      const textToFormat = target === 'A' ? textA : textB;
      const setOriginalText = target === 'A' ? setOriginalTextA : setOriginalTextB;
      const setFormattedFlag = target === 'A' ? setIsFormattedA : setIsFormattedB;

      if (!textToFormat.trim()) {
          setFormattingTarget(null);
          return;
      }
      
      try {
          // Save pre-formatted state for undo
          setOriginalText(textToFormat);
          const formattedText = await formatTextWithAI(textToFormat);
          if (target === 'A') {
              setTextA(formattedText);
          } else {
              setTextB(formattedText);
          }
          setFormattedFlag(true);
      } catch (error) {
          console.error("Error formateando el texto:", error);
          const errorMessage = error instanceof Error ? error.message : "Ocurrió un error al contactar el servicio de IA.";
          setApiError(errorMessage);
          setFormattedFlag(false);
      } finally {
          setFormattingTarget(null);
      }
  };

  const handleUndoFormat = (target: 'A' | 'B') => {
    if (target === 'A' && originalTextA) {
        setTextA(originalTextA);
        setIsFormattedA(false);
    }
    if (target === 'B' && originalTextB) {
        setTextB(originalTextB);
        setIsFormattedB(false);
    }
  };

  const handleCompare = async () => {
    if (isCompareDisabled || !docType) return;

    setIsLoading(true);
    setComparisonResult(null);
    setApiError(null);

    try {
      const result = await compareDocumentsWithAI(textA, textB, docType);
       if (result.changes.length === 0) {
        setApiError("No se encontró contenido analizable en los textos proporcionados. Por favor, asegúrate de que los artículos comiencen con la palabra 'Artículo'.");
        setIsLoading(false);
        return;
      }
      const changesWithIds = result.changes.map((change, index) => ({
        ...change,
        id: `${change.section_identifier}-${Date.now()}-${index}`,
        feedback: null,
      }));
      setComparisonResult({ ...result, changes: changesWithIds });

    } catch (error) {
      console.error("Error comparando documentos:", error);
      const errorMessage = error instanceof Error ? error.message : "Ocurrió un error al contactar el servicio de IA.";
      setApiError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCommentUpdate = (changeId: string, newComment: string) => {
    setComparisonResult(prev => {
        if (!prev) return null;
        const updatedChanges = prev.changes.map(change => 
            change.id === changeId ? { ...change, comment: newComment } : change
        );
        return { ...prev, changes: updatedChanges };
    });
  };
  
  const openFeedbackModal = (type: 'comparison' | 'formatting', targetId: string, feedbackType: 'up' | 'down') => {
    setFeedbackModalState({ isOpen: true, type, targetId, feedbackType });
  };

  const handleFeedbackSubmit = (comment: string) => {
    const { type, targetId, feedbackType } = feedbackModalState;
    if (!type || !targetId || !feedbackType) return;

    if (type === 'comparison') {
        let changeToSave: ComparisonChange | undefined;
        setComparisonResult(prev => {
            if (!prev) return null;
            const updatedChanges = prev.changes.map(change => {
                if (change.id === targetId) {
                    const updatedChange = { ...change, feedback: feedbackType };
                    changeToSave = updatedChange;
                    return updatedChange;
                }
                return change;
            });
            return { ...prev, changes: updatedChanges };
        });
        
        if (changeToSave) {
            saveFeedback({
                id: changeToSave.id,
                content_a: changeToSave.content_a,
                content_b: changeToSave.content_b,
                user_approved_comment: changeToSave.comment || '',
                feedback_type: feedbackType,
                feedback_comment: comment,
            });
        }
    } else if (type === 'formatting') {
        const textBefore = targetId === 'A' ? originalTextA : originalTextB;
        const textAfter = targetId === 'A' ? textA : textB;
        saveFormattingFeedback({
            original_text: textBefore,
            formatted_text: textAfter,
            feedback_type: feedbackType,
            feedback_comment: comment,
        });
    }

    setFeedbackModalState({ isOpen: false }); // Close modal
  };

  const SaveStatusIndicator: React.FC = () => {
    switch (saveStatus) {
        case 'saving':
            return (
                <div className="flex items-center space-x-2 text-sm text-gray-500 transition-opacity duration-300">
                    <SpinnerIcon className="animate-spin h-4 w-4" />
                    <span>Guardando...</span>
                </div>
            );
        case 'saved':
            return (
                <div className="flex items-center space-x-2 text-sm text-green-600 transition-opacity duration-300">
                    <CheckIcon className="h-4 w-4" />
                    <span>Guardado</span>
                </div>
            );
        default:
            return <div className="h-5 w-24"></div>; // Placeholder to prevent layout shift
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <Header />
      <main className="flex-grow container mx-auto p-4 md:p-8">
        
        {!docType ? (
            <DocumentTypeSelector onSelect={setDocType} />
        ) : (
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 mb-8">
                <div className="flex justify-between items-start mb-6 gap-4">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800 mb-1">Paso 2: Comparar Textos ({docType.toUpperCase()})</h2>
                        <p className="text-gray-600">Pega el contenido de los documentos original y propuesto.</p>
                    </div>
                    <div className="flex items-center space-x-4 flex-shrink-0">
                        <SaveStatusIndicator />
                        <div className="flex items-center space-x-2">
                            <button
                                onClick={handleClearAll}
                                disabled={isActionInProgress}
                                className="bg-red-100 hover:bg-red-200 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed text-red-700 font-semibold py-2 px-4 rounded-lg text-sm transition-colors inline-flex items-center space-x-2"
                                title="Limpiar ambos campos de texto y los resultados"
                            >
                                <TrashIcon className="h-5 w-5" />
                                <span>Limpiar Todo</span>
                            </button>
                            <button 
                                onClick={handleResetSelection}
                                disabled={isActionInProgress}
                                className="bg-gray-200 hover:bg-gray-300 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed text-gray-700 font-semibold py-2 px-4 rounded-lg text-sm transition-colors"
                            >
                                Cambiar Tipo
                            </button>
                        </div>
                    </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label htmlFor="text-a" className="block text-sm font-medium text-gray-700 mb-2">Texto Original (A)</label>
                        <div className="relative">
                            <textarea
                                id="text-a"
                                value={textA}
                                onChange={(e) => {
                                  setTextA(e.target.value);
                                  setIsFormattedA(false);
                                }}
                                placeholder={`Pega el texto original de la ${docType.toUpperCase()} aquí...`}
                                className="w-full h-80 p-3 pr-10 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                                aria-label={`Texto Original (A) - ${docType.toUpperCase()}`}
                            />
                            {textA.trim() && (
                                <button
                                    onClick={() => handleClearSingleInput('A')}
                                    className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
                                    title="Limpiar este campo"
                                    aria-label="Limpiar Texto Original"
                                >
                                    <CloseIcon className="h-5 w-5" />
                                </button>
                            )}
                        </div>
                         <div className="mt-2 flex justify-between items-center">
                            <div className="flex items-center space-x-1">
                                <span className="text-xs text-gray-500">¿Te gustó el formato?</span>
                                <button onClick={() => openFeedbackModal('formatting', 'A', 'up')} title="Buen formato" className="p-1 text-gray-400 hover:text-green-600 transition-colors"><ThumbUpIcon className="w-4 h-4" /></button>
                                <button onClick={() => openFeedbackModal('formatting', 'A', 'down')} title="Mal formato" className="p-1 text-gray-400 hover:text-red-600 transition-colors"><ThumbDownIcon className="w-4 h-4" /></button>
                            </div>
                            <div className="flex items-center space-x-2">
                                {isFormattedA && <button onClick={() => handleUndoFormat('A')} className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-2 px-3 rounded-lg text-sm transition-colors inline-flex items-center space-x-2" title="Deshacer formato"><UndoIcon className="h-5 w-5" /></button>}
                                <button onClick={() => setExpandedTextarea('A')} disabled={isActionInProgress} className="bg-gray-200 hover:bg-gray-300 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed text-gray-700 font-semibold py-2 px-4 rounded-lg text-sm transition-colors inline-flex items-center space-x-2" title="Expandir para editar"><ExpandIcon className="h-5 w-5" /><span>Expandir</span></button>
                                <button onClick={() => handleFormatText('A')} disabled={isActionInProgress || !textA.trim() || isFormattedA} className={`font-semibold py-2 px-4 rounded-lg text-sm transition-colors inline-flex items-center space-x-2 ${isFormattedA ? 'bg-green-100 text-green-700 cursor-default' : 'bg-purple-100 hover:bg-purple-200 text-purple-700'} disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed`}>
                                    {formattingTarget === 'A' ? <SpinnerIcon className="animate-spin h-5 w-5 text-purple-700" /> : isFormattedA ? <CheckIcon className="h-5 w-5" /> : <SparklesIcon className="h-5 w-5" />}
                                    <span>{formattingTarget === 'A' ? 'Formateando...' : isFormattedA ? 'Formateado ✓' : 'Formatear'}</span>
                                </button>
                            </div>
                         </div>
                    </div>
                     <div>
                        <label htmlFor="text-b" className="block text-sm font-medium text-gray-700 mb-2">Texto Propuesto (B)</label>
                        <div className="relative">
                            <textarea
                                id="text-b"
                                value={textB}
                                onChange={(e) => {
                                  setTextB(e.target.value);
                                  setIsFormattedB(false);
                                }}
                                placeholder={`Pega el texto propuesto de la ${docType.toUpperCase()} aquí...`}
                                className="w-full h-80 p-3 pr-10 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                                aria-label={`Texto Propuesto (B) - ${docType.toUpperCase()}`}
                            />
                            {textB.trim() && (
                                <button onClick={() => handleClearSingleInput('B')} className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600 transition-colors" title="Limpiar este campo" aria-label="Limpiar Texto Propuesto">
                                    <CloseIcon className="h-5 w-5" />
                                </button>
                            )}
                        </div>
                         <div className="mt-2 flex justify-between items-center">
                            <div className="flex items-center space-x-1">
                                <span className="text-xs text-gray-500">¿Te gustó el formato?</span>
                                <button onClick={() => openFeedbackModal('formatting', 'B', 'up')} title="Buen formato" className="p-1 text-gray-400 hover:text-green-600 transition-colors"><ThumbUpIcon className="w-4 h-4" /></button>
                                <button onClick={() => openFeedbackModal('formatting', 'B', 'down')} title="Mal formato" className="p-1 text-gray-400 hover:text-red-600 transition-colors"><ThumbDownIcon className="w-4 h-4" /></button>
                            </div>
                             <div className="flex items-center space-x-2">
                                {isFormattedB && <button onClick={() => handleUndoFormat('B')} className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-2 px-3 rounded-lg text-sm transition-colors inline-flex items-center space-x-2" title="Deshacer formato"><UndoIcon className="h-5 w-5" /></button>}
                                <button onClick={() => setExpandedTextarea('B')} disabled={isActionInProgress} className="bg-gray-200 hover:bg-gray-300 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed text-gray-700 font-semibold py-2 px-4 rounded-lg text-sm transition-colors inline-flex items-center space-x-2" title="Expandir para editar"><ExpandIcon className="h-5 w-5" /><span>Expandir</span></button>
                                <button onClick={() => handleFormatText('B')} disabled={isActionInProgress || !textB.trim() || isFormattedB} className={`font-semibold py-2 px-4 rounded-lg text-sm transition-colors inline-flex items-center space-x-2 ${isFormattedB ? 'bg-green-100 text-green-700 cursor-default' : 'bg-purple-100 hover:bg-purple-200 text-purple-700'} disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed`}>
                                    {formattingTarget === 'B' ? <SpinnerIcon className="animate-spin h-5 w-5 text-purple-700" /> : isFormattedB ? <CheckIcon className="h-5 w-5" /> : <SparklesIcon className="h-5 w-5" />}
                                    <span>{formattingTarget === 'B' ? 'Formateando...' : isFormattedB ? 'Formateado ✓' : 'Formatear'}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-8 text-center">
                     <button
                        onClick={handleCompare}
                        disabled={isCompareDisabled}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-bold py-3 px-10 rounded-lg shadow-lg transition-transform transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-blue-300 w-full md:w-auto flex items-center justify-center"
                        >
                        {isLoading && <SpinnerIcon className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />}
                        {isLoading ? 'Comparando...' : 'Comparar Textos'}
                    </button>
                </div>
            </div>
        )}
        
        {apiError && (
            <div className="mt-8 bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md" role="alert">
                <p className="font-bold">Error</p>
                <p>{apiError}</p>
            </div>
        )}

        {comparisonResult && docType && (
          <div className="mt-10">
            <ComparisonTable 
              docADetails={{ name: `Texto Original (A) - ${docType.toUpperCase()}` }}
              comparisonResult={comparisonResult}
              onCommentUpdate={handleCommentUpdate}
              onFeedback={(changeId, feedbackType) => openFeedbackModal('comparison', changeId, feedbackType)}
            />
          </div>
        )}

        {expandedTextarea && (
            <TextareaModal
                isOpen={!!expandedTextarea}
                onClose={() => setExpandedTextarea(null)}
                onSave={(newContent) => {
                    if (expandedTextarea === 'A') {
                        setTextA(newContent);
                        setIsFormattedA(false);
                    } else {
                        setTextB(newContent);
                        setIsFormattedB(false);
                    }
                }}
                initialContent={expandedTextarea === 'A' ? textA : textB}
                title={`Editor de ${expandedTextarea === 'A' ? 'Texto Original (A)' : 'Texto Propuesto (B)'}`}
            />
        )}

        <FeedbackModal 
            state={feedbackModalState}
            onClose={() => setFeedbackModalState({ isOpen: false })}
            onSubmit={handleFeedbackSubmit}
        />
      </main>
      <footer className="text-center p-4 text-gray-500 text-sm">
        © {new Date().getFullYear()} Comparador de Textos Legales. Todos los derechos reservados.
      </footer>
    </div>
  );
};

export default App;
