export interface DocDetails {
  name: string;
}

export interface DocumentSection {
  identifier: string;
  content: string;
}

export interface ComparisonChange {
  id: string; // ID único para cada cambio
  section_identifier: string;
  comment: string;
  merged_content: string; // Vista con cambios integrados
  content_a: string | null;
  content_b: string | null;
  feedback: 'up' | 'down' | null; // Feedback del usuario
}

export interface ComparisonResultItem {
  docBDetails: DocDetails;
  changes: ComparisonChange[];
}

export type LegalDocType = 'oguc' | 'lguc';

export interface FeedbackItem {
  id: string;
  content_a: string | null;
  content_b: string | null;
  user_approved_comment: string; 
  feedback_type: 'up' | 'down';
  feedback_comment?: string; // Comentario detallado del usuario
}

export interface FormattingFeedbackItem {
    original_text: string;
    formatted_text: string;
    feedback_type: 'up' | 'down';
    feedback_comment: string;
}

export interface FeedbackModalState {
    isOpen: boolean;
    type?: 'comparison' | 'formatting';
    targetId?: string;
    feedbackType?: 'up' | 'down';
}