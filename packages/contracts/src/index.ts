export type ChatbotKey =
  | "general-coach"
  | "personal-journey-coach";

export type ConversationType =
  | "general-ai"
  | "personal-ai"
  | "advisor";

export type MessageRole =
  | "user"
  | "assistant_general"
  | "assistant_personal"
  | "advisor"
  | "system";

export interface ChatRequest {
  message: string;
  conversationId?: string;
  userId?: string;
  organizationId?: string;
}

export interface SourceReference {
  provider: string;
  externalId: string;
  sourceUrl?: string;
  retrievedAt: string;
  validFrom?: string;
  validUntil?: string;
  version?: string;
}

export interface ChatArtifact {
  type:
    | "link"
    | "suggestion"
    | "phase-proposal"
    | "intake"
    | "route"
    | "appointment";
  label: string;
  payload: Readonly<Record<string, unknown>>;
}

export interface ChatResponse {
  chatbotKey: ChatbotKey;
  message: string;
  artifacts: ChatArtifact[];
  sources: SourceReference[];
  mutations: ProposedMutation[];
}

export interface ProposedMutation {
  type: "profile-slot" | "phase-transition";
  requiresConfirmation: true;
  payload: Readonly<Record<string, unknown>>;
}


export type ResponseMode =
  | "direct"
  | "clarify_batch"
  | "source_check"
  | "handoff";

export type AnswerType =
  | "reproductie"
  | "wegwijs"
  | "verkenning"
  | "empathisch_steunend"
  | "bronplichtig"
  | "handoff_mens";

export interface VerifiedLink {
  label: string;
  href: string;
  sourceKey?: string;
}

export interface IntakeQuestion {
  id: string;
  question: string;
  type: "choice" | "open";
  options?: readonly string[];
  slotKey?: string;
  required?: boolean;
}

export interface IntakeBatch {
  questions: readonly IntakeQuestion[];
  summaryTemplate: string;
}

export interface StructuredResponse {
  mode: ResponseMode;
  answerType: AnswerType;
  directAnswer: string;
  supportingDetail?: string;
  verifiedLinks: readonly VerifiedLink[];
  primaryFollowup?: {
    label: string;
    text?: string;
    href?: string;
  };
  secondaryAction?: {
    label: string;
    href: string;
  };
  intakeBatch?: IntakeBatch;
  collapseRecommended: boolean;
  verificationRequired: boolean;
  reflectionIssues: readonly string[];
}


export type PhaseSystemKeyContract =
  | "phase-4"
  | "phase-5"
  | "phase-9";

export type PhaseSystemScopeContract =
  | "organization"
  | "user"
  | "conversation";

export interface PhaseSystemPreferenceDto {
  scope: PhaseSystemScopeContract;
  scopeId: string;
  phaseSystemKey: PhaseSystemKeyContract;
  enabled: boolean;
  updatedAt: string;
}

export interface SetPhaseSystemPreferenceRequest {
  scope: PhaseSystemScopeContract;
  scopeId: string;
  phaseSystemKey: PhaseSystemKeyContract;
  enabled?: boolean;
}


export type MutationDecision = "accept" | "reject";

export interface MutationConfirmationRequest {
  mutationId: string;
  decision: MutationDecision;
  userId: string;
  reason?: string;
}

export interface PendingMutationDto {
  id: string;
  conversationId?: string;
  userId?: string;
  profileId?: string;
  mutation: ProposedMutation;
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
  resolvedAt?: string;
  resolvedByUserId?: string;
  reason?: string;
}


export interface AdvisorChatRequest {
  conversationId: string;
  advisorUserId: string;
  candidateUserId: string;
  message: string;
}

export interface ConversationDto {
  id: string;
  userId?: string;
  title: string;
  type: ConversationType;
  createdAt: string;
  updatedAt: string;
}

export interface MessageDto {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  chatbotKey?: ChatbotKey;
  advisorUserId?: string;
  metadata: Readonly<Record<string, unknown>>;
  createdAt: string;
}

export interface DetectorSnapshotDto {
  id: string;
  profileId: string;
  conversationId?: string;
  input: Readonly<Record<string, unknown>>;
  output: Readonly<Record<string, unknown>>;
  rulesVersion: string;
  createdAt: string;
}

export interface RouteRecommendationDto {
  routeId: string;
  title: string;
  slug: string;
  requiredAnswerIds: readonly string[];
  stepIds: readonly string[];
}


export type UserRole =
  | "candidate"
  | "advisor"
  | "administrator"
  | "superuser";

export interface AuthenticatedUserDto {
  id: string;
  email: string;
  roles: readonly UserRole[];
}

export interface AuthSessionDto {
  accessToken: string;
  expiresAt: string;
  user: AuthenticatedUserDto;
}

export interface ProfileDto {
  id: string;
  userId: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  bio?: string;
  preferredSector?: string;
  currentPhaseCode?: string;
  knownSlots: Readonly<Record<string, unknown>>;
  testCompleted: boolean;
  testResults?: unknown;
  avatarObjectKey?: string;
  cvObjectKey?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateProfileRequest {
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  bio?: string | null;
  preferredSector?: string | null;
}

export interface UserNoteDto {
  id: string;
  userId: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoredFileDto {
  objectKey: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
}
