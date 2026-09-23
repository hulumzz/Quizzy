import { authenticateRequest } from '../../middleware/firebase-auth.js';
import { AttendanceRepository } from '../../repositories/attendance-repository.js';
import { ClassRepository } from '../../repositories/class-repository.js';
import { DiscussionRepository } from '../../repositories/discussion-repository.js';
import { MaterialRepository } from '../../repositories/material-repository.js';
import { QuizRepository } from '../../repositories/quiz-repository.js';
import { LiveQuizRepository } from '../../repositories/live-quiz-repository.js';
import { CloudinaryUploadSigner } from '../../services/cloudinary-upload-signer.js';
import { LiveQuizAnswerQueue } from '../../services/live-quiz-answer-queue.js';
import { createAttendanceHandler } from '../attendance/handler.js';
import { createDiscussionsHandler } from '../discussions/handler.js';
import { createMaterialsHandler } from '../materials/handler.js';
import { createQuizzesHandler } from '../quizzes/handler.js';
import { createLiveQuizzesHandler } from '../live-quizzes/handler.js';
import { createUploadsHandler } from '../uploads/handler.js';
import { createClassesHandler } from './handler.js';

const classRepository = new ClassRepository();
const materialRepository = new MaterialRepository({ classRepository });
const discussionRepository = new DiscussionRepository({ materialRepository });
const attendanceRepository = new AttendanceRepository({ classRepository });
const quizRepository = new QuizRepository({ classRepository });
const liveQuizRepository = new LiveQuizRepository({ quizRepository });
const uploadSigner = new CloudinaryUploadSigner({ classRepository });
const liveQuizAnswerQueue = new LiveQuizAnswerQueue();

const classesHandler = createClassesHandler({ authenticate: authenticateRequest, repository: classRepository });
const materialsHandler = createMaterialsHandler({ authenticate: authenticateRequest, repository: materialRepository });
const discussionsHandler = createDiscussionsHandler({ authenticate: authenticateRequest, repository: discussionRepository });
const attendanceHandler = createAttendanceHandler({ authenticate: authenticateRequest, repository: attendanceRepository });
const quizzesHandler = createQuizzesHandler({ authenticate: authenticateRequest, repository: quizRepository });
const liveQuizzesHandler = createLiveQuizzesHandler({ authenticate: authenticateRequest, repository: liveQuizRepository, answerQueue: liveQuizAnswerQueue });
const uploadsHandler = createUploadsHandler({ authenticate: authenticateRequest, signer: uploadSigner });

export function handler(event, context) {
  const path = event?.rawPath || event?.path || '/';
  if (path.includes('/live-sessions') || path.startsWith('/live-quizzes/')) return liveQuizzesHandler(event, context);
  if (path.includes('/attendance')) return attendanceHandler(event, context);
  if (path.includes('/discussions')) return discussionsHandler(event, context);
  if (path.includes('/quizzes')) return quizzesHandler(event, context);
  if (path.includes('/uploads/')) return uploadsHandler(event, context);
  return path.includes('/materials') || path.startsWith('/learning/')
    ? materialsHandler(event, context)
    : classesHandler(event, context);
}
